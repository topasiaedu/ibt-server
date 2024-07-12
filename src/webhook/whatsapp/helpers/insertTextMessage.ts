import { Request, Response } from 'express'
import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'

async function insertTextMessage(
  message: any,
  display_phone_number: string,
  project_id: string
) {
  try {
    const { from, id, timestamp, type, text } = message
    const { body } = text

    // Check if the database has the same wa_message_id
    let { data: existingMessage, error: findError } = await supabase
      .from('messages')
      .select('wa_message_id')
      .eq('wa_message_id', id)
      .single()

    if (existingMessage?.wa_message_id === id) {
      return 'Message already exists in the database'
    }

    // Find the contact_id of the sender
    let { data: sender, error: senderError } = await supabase
      .from('contacts')
      .select('contact_id')
      .eq('wa_id', from)
      .eq('project_id', project_id)
      .single()

    if (senderError) {
      console.error('Error finding sender in database:', senderError)
      throw senderError
    }

    if (!sender) {
      throw new Error('Sender not found in database')
    }

    const senderId = sender.contact_id

    const myPhoneNumberId = await supabase
      .from('phone_numbers')
      .select('phone_number_id')
      .eq('number', display_phone_number)
      .single()

    const myPhoneNumber = myPhoneNumberId?.data?.phone_number_id

    // Look Up conversation_id
    let { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('*')
      .eq('contact_id', senderId)
      .eq('phone_number_id', myPhoneNumber)
      .single()

    if (conversationError) {
      console.error(
        'Error finding conversation in database:',
        conversationError
      )
      return 'Error finding conversation in database'
    }

    // Change timestamp to DateTime format
    const date = new Date(parseInt(timestamp) * 1000)

    // Insert the message into the database
    let { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert([
        {
          contact_id: senderId,
          message_type: type,
          content: body,
          phone_number_id: myPhoneNumber,
          wa_message_id: id,
          direction: 'inbound',
          project_id,
          status: 'received',
          conversation_id: conversation?.id,
        },
      ])
      .select('*')
      .single()

    console.log(
      'Type of unread_messages: ',
      typeof conversation?.unread_messages
    )

    console.log('Value of unread_messages: ', conversation?.unread_messages)

    // Update last_message_id and updated_at in the conversation
    const { data: updatedConversation, error: updateConversationError } =
      await supabase
        .from('conversations')
        .update({
          last_message_id: newMessage?.message_id,
          unread_messages: conversation?.unread_messages + 1,
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

    if (messageError) {
      logError(
        messageError as unknown as Error,
        'Error inserting inbound text message into database. Data: ' +
          JSON.stringify(message, null, 2) +
          '\n Error: ' +
          JSON.stringify(messageError, null, 2) +
          '\n' +
          'Inside insertTextMessage function in insertTextMessage.ts'
      )
      console.error(
        'Error inserting inbound text message into database:',
        messageError
      )
    }

    console.log('Text Message inserted into database')
  } catch (error) {
    logError(
      error as Error,
      'Error inserting inbound text message into database. Data: ' +
        JSON.stringify(message, null, 2) +
        '\n Error: ' +
        JSON.stringify(error, null, 2) +
        '\n' +
        'Inside insertTextMessage function in insertTextMessage.ts'
    )
    return 'Error inserting inbound text message into database'
  }
}

export default insertTextMessage
