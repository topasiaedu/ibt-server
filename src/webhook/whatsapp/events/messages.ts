import { Contact, updateContactLastContactedBy } from '../../../db/contacts'
import {
  Conversation,
  fetchConversation,
  updateConversation,
} from '../../../db/conversations'
import {
  fetchMessageByWAMID,
  Message,
  updateMessage
} from '../../../db/messages'
import { fetchPhoneNumberByWAId, PhoneNumber } from '../../../db/phoneNumbers'
import supabase from '../../../db/supabaseClient'
import {
  fetchWhatsAppBusinessAccount,
  WhatsAppBusinessAccount,
} from '../../../db/whatsappBusinessAccounts'
import { logError } from '../../../utils/errorLogger'
import { withRetry } from '../../../utils/withRetry'
import { generateWorkflowLog } from '../../ibt/helper/generateWorkflowLogs'
import insertAudioMessage from '../helpers/insertAudioMessage'
import insertButtonMessage from '../helpers/insertButtonMessage'
import insertImageMessage from '../helpers/insertImageMessage'
import insertStickerMessage from '../helpers/insertStickerMessage'
import insertTextMessage from '../helpers/insertTextMessage'
import insertVideoMessage from '../helpers/insertVideoMessage'

const handleMessages = async (value: any) => {
  try {
    // Check if its Outgoing or Incoming message
    if (value?.statuses) {
      return handleOutgoingMessage(value)
    } else {
      return handleIncomingMessage(value)
    }
  } catch (error) {
    console.error('Error handling messages:', error)
    logError(
      error as Error,
      'Error handling messages. Data: ' +
        JSON.stringify(value, null, 2) +
        '\n' +
        'Inside handleMessages function in messages.ts'
    )
    return 'Error handling messages'
  }
}

const handleOutgoingMessage = async (value: any) => {
  // console.log('Outgoing message:', JSON.stringify(value, null, 2));
  try {
    const { statuses } = value

    statuses.forEach(async (status: any) => {
      const message: Message | null = await withRetry(
        () => fetchMessageByWAMID(status.id),
        'handleOutgoingMessage > fetchMessageByWAMID'
      )
      if (!message) {
        console.error('Message not found in the database')
        return
      }

      await withRetry(
        () => updateMessage(message.message_id, { status: status.status }),
        'handleOutgoingMessage > updateMessage'
      )

      // Update Contact Last Contacted By
      await withRetry(
        () => updateContactLastContactedBy(message.contact_id, message.phone_number_id),
        'handleOutgoingMessage > updateContactLastContactedBy'
      )

      if (status.conversation) {
        if (status.conversation.expiration_timestamp) {
          const date = new Date(
            parseInt(status.conversation.expiration_timestamp) * 1000
          ).toISOString()

          const conversation: Conversation = await withRetry(
            () =>
              fetchConversation(
                message.contact_id,
                message.phone_number_id,
                message.project_id
              ),
            'handleOutgoingMessage > fetchConversation'
          )

          if (!conversation || status.conversation.id === conversation.id) {
            await withRetry(
              () =>
                updateConversation(conversation.id, {
                  close_at: date,
                  last_message_id: message.message_id,
                  updated_at: new Date().toISOString(),
                  ...(conversation.wa_conversation_id !== status.conversation.id
                    ? { wa_conversation_id: status.conversation.id }
                    : {})
                }),
              'handleOutgoingMessage > updateConversation'
            );
          } else {
            console.warn(`wa_conversation_id ${status.conversation.id} already exists in another record.`);
          }
          
        }
      }

      if (status.errors) {
        // Update the message status in the database using id
        let { error: updateError } = await supabase
          .from('messages')
          .update({ status: 'failed', error: status.errors[0] })
          .eq('wa_message_id', status.id)

        if (updateError) {
          logError(
            updateError as unknown as Error,
            'Error updating outgoing message status in database. Data: ' +
              JSON.stringify(value, null, 2) +
              '\n Error: ' +
              JSON.stringify(updateError, null, 2) +
              '\n' +
              'Inside handleOutgoingMessage function in messages.ts'
          )
        }
      }
    })
  } catch (error) {
    console.error('Error processing outgoing messages:', error)
    logError(
      error as Error,
      'Error processing outgoing messages. Data: ' +
        JSON.stringify(value, null, 2) +
        '\n Error: ' +
        JSON.stringify(error, null, 2) +
        '\n' +
        'Inside handleOutgoingMessage function in messages.ts'
    )
    return 'Error processing messages'
  }
}

const handleIncomingMessage = async (value: any) => {
  // console.log('Incoming message:', JSON.stringify(value, null, 2))
  try {
    const { metadata, contacts, messages } = value
    const { display_phone_number, phone_number_id } = metadata

    const phoneNumber: PhoneNumber = await withRetry(
      () => fetchPhoneNumberByWAId(phone_number_id),
      'handleIncomingMessage > fetchPhoneNumberByWAId'
    )

    const whatsAppBusinessAccount: WhatsAppBusinessAccount = await withRetry(
      () => fetchWhatsAppBusinessAccount(phoneNumber.waba_id),
      'handleIncomingMessage > fetchWhatsAppBusinessAccount'
    )

    messages.forEach(async (message: any) => {
      const { type } = message

      switch (type) {
        case 'text':
          await handleKeywordTrigger(value).then(() => {
            insertTextMessage(
              message,
              display_phone_number,
              whatsAppBusinessAccount.project_id,
              contacts
            )
          })
          break
        case 'image':
          await insertImageMessage(
            message,
            display_phone_number,
            whatsAppBusinessAccount.project_id,
            contacts
          )
          break
        case 'video':
          await insertVideoMessage(
            message,
            display_phone_number,
            whatsAppBusinessAccount.project_id,
            contacts
          )
          break
        case 'button':
          await insertButtonMessage(
            message,
            display_phone_number,
            whatsAppBusinessAccount.project_id,
            contacts
          )
          break
        case 'sticker':
          await insertStickerMessage(
            message,
            display_phone_number,
            whatsAppBusinessAccount.project_id,
            contacts
          )
          break
        case 'audio':
          await insertAudioMessage(
            message,
            display_phone_number,
            whatsAppBusinessAccount.project_id,
            contacts
          )
          break
        default:
          console.error('Unsupported message type:', type)
      }
    })

    return 'Messages processed successfully'
  } catch (error) {
    console.error('Error processing messages:', error)
    logError(
      error as Error,
      'Error processing inbound messages. Data: ' +
        JSON.stringify(value, null, 2) +
        '\n Error: ' +
        JSON.stringify(error, null, 2) +
        '\n' +
        'Inside handleIncomingMessage function in messages.ts'
    )
    return 'Error processing messages'
  }
}

export default handleMessages

const handleKeywordTrigger = async (value: any) => {
  const { metadata, contacts, messages } = value
  const { display_phone_number, phone_number_id } = metadata
  const { wa_id, profile } = contacts[0]
  const { name } = profile

  const { data, error } = await supabase.rpc('get_triggers_with_details')

  if (error) {
    logError(
      error as unknown as Error,
      'Error fetching triggers' +
        '\n' +
        'Inside handleKeywordTrigger function in messages.ts'
    )
    return
  }

  // Check if the id already exist in the database
  const { data: messageData, error: messageError } = await supabase
    .from('messages')
    .select('*')
    .eq('wa_message_id', messages[0].id)

  if (messageError) {
    logError(
      messageError as unknown as Error,
      'Error fetching messages' +
        '\n' +
        'Inside handleKeywordTrigger function in messages.ts'
    )
    return
  }

  if (messageData.length > 0) {
    console.error('Message already exists in the database')
    return
  }

  for (const trigger of data) {
    if (trigger.trigger.type === 'keyword') {
      const { keywords } = trigger.trigger.details
      const { phone_numbers } = trigger

      for (const phone of phone_numbers) {
        if (phone.wa_id === phone_number_id) {
          for (const message of messages) {
            const { text } = message
            const { body } = text

            const normalizedBody = body.trim().toLowerCase()

            // Convert keywords to lower case for comparison
            const lowerCaseKeywords = keywords.map((kw: string) =>
              kw.toLowerCase().trim()
            )

            if (lowerCaseKeywords.includes(normalizedBody)) {
              // Check if the Contact exists in the database
              const { data: contact, error: contactError } = await supabase
                .from('contacts')
                .select('*')
                .eq('wa_id', wa_id)
                .eq('project_id', trigger.trigger.project_id)
                .single()

              if (contactError) {
                // Create a new contact if it does not exist
                const { data: newContact, error: newContactError } =
                  await supabase
                    .from('contacts')
                    .insert([
                      {
                        wa_id: wa_id,
                        name: name,
                        project_id: trigger.trigger.project_id,
                      },
                    ])
                    .select('*')
                    .single()

                if (newContactError) {
                  logError(
                    newContactError as unknown as Error,
                    'Error creating new contact'
                  )
                  return
                }

                if (newContact) {
                  for (const action of trigger.actions) {
                    if (action.active) {
                      await generateWorkflowLog(
                        action,
                        newContact as unknown as Contact
                      )
                    }
                  }
                }
              }

              if (contact) {
                for (const action of trigger.actions) {
                  if (action.active) {
                    await generateWorkflowLog(action, contact as Contact)
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
