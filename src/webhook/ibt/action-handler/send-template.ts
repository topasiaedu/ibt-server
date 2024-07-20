import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'
import { TemplateMessagePayload } from '../processCampaigns'
import { Database } from '../../../database.types'
import { sendMessageWithTemplate } from '../../../api/whatsapp'

export const sendTemplate = async (payload: any, workflowLogId: string) => {
  const { workflow_id, contact_id, template_payload, selected_template } =
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

  // Fetch Contact
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
  // Check wa_id if it starts with 60 for malaysian numbers
  // If not, add the missing parts it could start with 0 or 1
  if (contact.wa_id.startsWith('60')) {
    contact.wa_id = '' + contact.wa_id
  } else if (contact.wa_id.startsWith('1')) {
    contact.wa_id = '60' + contact.wa_id
  } else if (contact.wa_id.startsWith('0')) {
    contact.wa_id = '6' + contact.wa_id
  }

  let templatePayload: TemplateMessagePayload = JSON.parse(
    JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: contact.wa_id,
      type: 'template',
      template: template_payload as TemplateMessagePayload['template'],
    })
  )

  let mediaUrl = ''

  // Check template payload for %name%, %date%, %time% and replace with actual values
  templatePayload.template.components.forEach((component: any) => {
    component.parameters.forEach((parameter: any) => {
      if (parameter.text) {
        parameter.text = parameter.text.replace(/%name%/g, contact.name)
        // parameter.text = parameter.text.replace(/%date%/g, campaign.created_at);
        // parameter.text = parameter.text.replace(/%time%/g, campaign.time);

        // Check if the parameter.text has spintax, if so, replace it with a random value
        const spintaxRegex = /{([^{}]*)}/g
        const spintaxMatch = parameter.text.match(spintaxRegex)
        if (spintaxMatch) {
          spintaxMatch.forEach((spintax: any) => {
            const options = spintax.substring(1, spintax.length - 1).split('|')
            const randomIndex = Math.floor(Math.random() * options.length)
            parameter.text = parameter?.text?.replace(
              spintax,
              options[randomIndex]
            )
          })
        }
      } else if (
        parameter.type === 'image' ||
        parameter.type === 'document' ||
        parameter.type === 'video'
      ) {
        mediaUrl = parameter[parameter.type].link
      }
    })
  })

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
    // console.log(
    //   'Sending message with template payload:',
    //   JSON.stringify(templatePayload, null, 2)
    // )

    const { data: messageResponse } = await sendMessageWithTemplate(
      templatePayload,
      selectedPhoneNumber,
      newPhoneNumbers.find(
        (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
      ).phone_numbers.whatsapp_business_accounts.business_manager.access_token
    )

    console.log("Template Payload", JSON.stringify(templatePayload, null, 2) )
    console.log("Selected Phone Number", selectedPhoneNumber)
    console.log("Access Token", newPhoneNumbers.find(
      (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
    ).phone_numbers.whatsapp_business_accounts.business_manager.access_token)
    // Lookup template to get the text and the image if any
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('template_id', selected_template.template_id)
      .single()

    let textContent = template?.components.data
      .map((component: any) => {
        if (component.type === 'BODY') {
          return component.text
        }
      })
      .join(' ')

    if (textContent) {
      const textComponent = templatePayload?.template.components.find(
        (component: { type: string }) => component.type === 'BODY'
      )
      // Get the parameter text values into an array
      const bodyInputValues =
        textComponent?.parameters.map(
          (parameter: { text: any }) => parameter.text
        ) ?? []

      // Replace {{index}} in the text content with the parameter text with the appropriate index
      textContent = textContent.replace(/{{\d+}}/g, (match: any) => {
        const index = parseInt(match.match(/\d+/g)![0])
        return bodyInputValues[index - 1]
      })
    }

    const phoneNumberId = newPhoneNumbers.find(
      (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
    ).phone_numbers.phone_number_id

    // Look Up conversation_id
    let { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contact.contact_id)
      .eq('phone_number_id', phoneNumberId)
      .single()

    if (conversationError) {
      console.error(
        'Error finding conversation in database:',
        conversationError
      )
      return 'Error finding conversation in database'
    }

    // Add the message to the database under the table messages
    const { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert([
        {
          wa_message_id: messageResponse.messages[0].id || '',
          phone_number_id: phoneNumberId,
          contact_id: contact.contact_id,
          message_type: 'TEMPLATE',
          content: textContent,
          workflow_id: workflow_id,
          direction: 'outgoing',
          status: messageResponse.messages[0].message_status || 'failed',
          project_id: contact.project_id,
          media_url: mediaUrl,
          conversation_id: conversation?.id,
        },
      ])
      .select('*')
      .single()

    // Update last_message_id and updated_at in the conversation
    const { data: updatedConversation, error: updateConversationError } =
      await supabase
        .from('conversations')
        .update({
          last_message_id: newMessage?.message_id,
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

    // Update last_contacted_by for the contact using the phone_number_id
    const { data: updatedContact, error: updateContactError } = await supabase
      .from('contacts')
      .update({
        last_contacted_by: newPhoneNumbers.find(
          (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
        ).phone_number_id,
      })
      .eq('wa_id', selectedPhoneNumber)

    // Update the workflow log status to completed
    const { data: updatedWorkflowLogStatus, error: updateStatusError } =
      await supabase
        .from('workflow_logs')
        .update({ status: 'COMPLETED' })
        .eq('id', workflowLogId)
  } catch (error) {
    console.error('Error sending message:', error)
    logError(error as Error, 'Error sending message')

    const { data: updatedWorkflowLogStatus, error: updateStatusError } =
      await supabase
        .from('workflow_logs')
        .update({ status: 'FAILED' })
        .eq('id', workflowLogId)
  }
}
