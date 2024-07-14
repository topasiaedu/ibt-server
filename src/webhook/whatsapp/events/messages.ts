import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'
import insertTextMessage from '../helpers/insertTextMessage'
import insertImageMessage from '../helpers/insertImageMessage'
import insertVideoMessage from '../helpers/insertVideoMessage'
import insertButtonMessage from '../helpers/insertButtonMessage'
import findOrCreateContact from '../helpers/findOrCreateContact'
import insertStickerMessage from '../helpers/insertStickerMessage'
import insertAudioMessage from '../helpers/insertAudioMessage'
import { generateWorkflowLog } from '../../ibt/helper/generateWorkflowLogs'
import { Database } from '../../../database.types'

type Contact = Database['public']['Tables']['contacts']['Row']

const handleMessages = async (value: any) => {
  // console.log('Message:', JSON.stringify(value, null, 2));
  try {
    // Check if its Outgoing or Incoming message
    if (value?.statuses) {
      return handleOutgoingMessage(value)
    } else {
      return handleIncomingMessage(value)
    }
  } catch (error) {
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
  console.log('Outgoing message received!')
  // console.log('Outgoing message:', JSON.stringify(value, null, 2));
  try {
    const { statuses } = value

    statuses.forEach(async (status: any) => {
      // Update the message status in the database using id
      let { data: message, error: updateError } = await supabase
        .from('messages')
        .update({ status: status.status })
        .eq('wa_message_id', status.id)
        .select('*')
        .single()

      // console.log('====================================')
      // console.log('status', status.id)
      // console.log('message', message)
      // console.log('====================================')

      if (updateError) {
        return 'Error updating outgoing message status in database'
      }

      if (status.conversation) {
        if (status.conversation.expiration_timestamp) {
          let { data: existingConversation, error: findError } = await supabase
            .from('conversation')
            .select('*')
            .or(
              `(phone_number_id.eq.${message.phone_number_id},contact_id.eq.${message.contact_id},project_id.eq.${message.project_id}),wa_conversation_id.eq.${status.conversation.id}`
            )
            .single()

          if (
            existingConversation?.conversation_id === status.conversation.id
          ) {
            return 'Conversation already exists in the database'
          }

          if (findError) {
            // Change the data from 1717424940 to Date format
            const date = new Date(
              parseInt(status.conversation.expiration_timestamp) * 1000
            )
            const formattedDate = date.toISOString()
            // insert the message window
            let { error: insertError } = await supabase
              .from('conversation')
              .insert([
                {
                  phone_number_id: message.phone_number_id,
                  contact_id: message.contact_id,
                  wa_conversation_id: status.conversation.id,
                  close_at: formattedDate,
                  updated_at: new Date().toISOString(),
                  last_message_id: message.id,
                  project_id: message.project_id,
                },
              ])

            if (insertError) {
              logError(
                insertError as unknown as Error,
                'Error inserting conversation into database' +
                  '\n' +
                  'Inside handleOutgoingMessage function in messages.ts'
              )
            }
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
  console.log('Incoming message received!')
  // console.log('Incoming message:', JSON.stringify(value, null, 2))
  try {
    // Assuming the structure of the incoming payload matches your example
    const { metadata, contacts, messages } = value
    const { display_phone_number, phone_number_id } = metadata

    // Based on phone number id, find the phone number in the database in which we use to find the project id
    const { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('waba_id')
      .eq('wa_id', phone_number_id)
      .single()

    if (phoneError) {
      console.error('Error finding phone number in database:', phone_number_id)
      throw phoneError
    }

    if (!phoneNumber) {
      throw new Error('Phone number not found in database')
    }

    const WABA_ID = phoneNumber.waba_id

    // Find the project id using the WABA ID
    const { data: project, error: projectError } = await supabase
      .from('whatsapp_business_accounts')
      .select('project_id')
      .eq('account_id', WABA_ID)
      .single()

    if (projectError) {
      console.error('Error finding project in database:', projectError)
      throw projectError
    }

    if (!project) {
      logError(
        new Error('Project not found in database'),
        'Project not found in database' +
          '\n' +
          'Inside handleIncomingMessage function in messages.ts'
      )
      throw new Error('Project not found in database')
    }

    contacts.forEach(async (contact: any) => {
      await findOrCreateContact(contact, project.project_id)
    })

    messages.forEach(async (message: any) => {
      const { type } = message

      switch (type) {
        case 'text':
          await handleKeywordTrigger(value).then(() => {
            insertTextMessage(message, display_phone_number, project.project_id)
          })
          break
        case 'image':
          await insertImageMessage(
            message,
            display_phone_number,
            project.project_id
          )
          break
        case 'video':
          await insertVideoMessage(
            message,
            display_phone_number,
            project.project_id
          )
          break
        case 'button':
          await insertButtonMessage(
            message,
            display_phone_number,
            project.project_id
          )
          break
        case 'sticker':
          await insertStickerMessage(
            message,
            display_phone_number,
            project.project_id
          )
          break
        case 'audio':
          await insertAudioMessage(
            message,
            display_phone_number,
            project.project_id
          )
          break
        default:
          console.error('Unsupported message type:', type)
      }
    })

    return 'Messages processed successfully'
  } catch (error) {
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

  console.log('Checking for keyword triggers')

  data.forEach(async (trigger: any) => {
    if (trigger.trigger.type === 'keyword') {
      const { keywords } = trigger.trigger.details
      const { phone_numbers } = trigger

      phone_numbers.forEach(async (phone: any) => {
        if (phone.wa_id === phone_number_id) {
          messages.forEach(async (message: any) => {
            const { text } = message
            const { body } = text
            if (keywords.includes(body)) {
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
                  trigger.actions.forEach(async (action: any) => {
                    generateWorkflowLog(
                      action,
                      newContact as unknown as Contact
                    )
                  })
                }
              }

              if (contact) {
                trigger.actions.forEach(async (action: any) => {
                  generateWorkflowLog(action, contact as Contact)
                })
              }
            }
          })
        }
      })
    }
  })
}
