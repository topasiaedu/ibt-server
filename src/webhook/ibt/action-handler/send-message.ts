import { MessagePayload } from '../../../api/whatsapp'
import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'
import { sendMessage as sendMessageWhatsApp } from '../../../api/whatsapp'

export const sendMessage = async (payload: any, workflowLogId: string) => {
  const { message, contact_id, workflow_id, postTime, timePostType, postDate } =
    payload

  const { data: newPhoneNumbers, error: newPhoneNumbersError } = await supabase
    .from('workflow_phone_numbers')
    .select(
      '*, phone_numbers(*,whatsapp_business_accounts(*,business_manager(*)))'
    )
    .eq('workflow_id', workflow_id)

  if (newPhoneNumbersError) {
    logError(
      newPhoneNumbersError as unknown as Error,
      'Error fetching new phone numbers'
    )
    return
  }

  const { data: contactData, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('contact_id', contact_id)
    .single()

  if (contactError) {
    logError(contactError as unknown as Error, 'Error fetching contact')
    return
  }

  const contact = contactData

  if (contact.wa_id.startsWith('60')) {
    contact.wa_id = '' + contact.wa_id
  } else if (contact.wa_id.startsWith('1')) {
    contact.wa_id = '60' + contact.wa_id
  } else if (contact.wa_id.startsWith('0')) {
    contact.wa_id = '6' + contact.wa_id
  }

  let messagePayload: MessagePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: contact.wa_id,
    type: 'text',
    text: {
      body: message,
    },
  }

  // Check message for spintax and replace with random value and %name% with actual name
  const spintaxRegex = /{[^{}]*}/g
  const matches = message.match(spintaxRegex)
  if (matches) {
    matches.forEach((spintax: string) => {
      const spintaxOptions = spintax.slice(1, -1).split('|')
      const randomOption =
        spintaxOptions[Math.floor(Math.random() * spintaxOptions.length)]
      messagePayload.text.body = messagePayload.text.body.replace(
        spintax,
        randomOption
      )
    })
  }

  messagePayload.text.body = messagePayload.text.body.replace(
    /%name%/g,
    contact.name
  )

  const getWeightForRating = (rating: string) => {
    const weights: { [key: string]: number } = {
      GREEN: 6, // Higher probability for GREEN
      YELLOW: 3, // Moderate probability for YELLOW
      RED: 1, // Lower probability for RED
    }
    return weights[rating] || 1 // Default to 1 if undefined
  }

  // Create a weighted list of phone numbers
  const weightedPhoneNumbers = newPhoneNumbers.flatMap((phone: any) => {
    const weight = getWeightForRating(phone.phone_numbers.quality_rating)
    return Array(weight).fill(phone.phone_numbers.wa_id) // Fill an array with the wa_id repeated by its weight
  })

  // Random selection from the weighted list
  const randomIndex = Math.floor(Math.random() * weightedPhoneNumbers.length)
  const selectedPhoneNumber = weightedPhoneNumbers[randomIndex]

  try {
    const response = await sendMessageWhatsApp(
      messagePayload,
      selectedPhoneNumber,
      newPhoneNumbers.find(
        (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
      ).phone_numbers.whatsapp_business_accounts.business_manager.access_token
    )

    // Look Up conversation_id
    let { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contact.contact_id)
      .eq('phone_number_id', selectedPhoneNumber)
      .single()

    if (conversationError) {
      console.error(
        'Error finding conversation in database:',
        conversationError
      )
      return 'Error finding conversation in database'
    }

    // Add the message to the database under the table messages
    const { data: newMessage, error: newMessageError } = await supabase
      .from('messages')
      .insert({
        contact_id,
        message: messagePayload.text.body,
        phone_number_id: selectedPhoneNumber,
        workflow_id,
        post_time: postTime,
        time_post_type: timePostType,
        post_date: postDate,
        message_id: response.data.message_id,
        conversation_id: conversation?.id,
      })
      .select('*')
      .single()

    if (newMessageError) {
      logError(
        newMessageError as unknown as Error,
        'Error saving message to database'
      )
      return
    }

    // Update last_message_id and updated_at in the conversation
    const { data: updatedConversation, error: updateConversationError } =
      await supabase
        .from('conversations')
        .update({
          last_message_id: newMessage?.id,
          updated_at: new Date(),
        })
        .eq('id', conversation?.id)

    if (updateConversationError) {
      logError(
        updateConversationError as unknown as Error,
        'Error updating conversation'
      )
      return
    }

    const { data: updatedWorkflowLogStatus, error: updateStatusError } =
      await supabase
        .from('workflow_logs')
        .update({ status: 'COMPLETED' })
        .eq('id', workflowLogId)

    if (updateStatusError) {
      logError(
        updateStatusError as unknown as Error,
        'Error updating workflow log status'
      )
      return
    }
  } catch (error) {
    logError(error as Error, 'Error sending message')

    const { data: updatedWorkflowLog, error: updateError } = await supabase
      .from('workflow_logs')
      .update({ status: 'ERROR' })
      .eq('id', workflowLogId)
  }
}
