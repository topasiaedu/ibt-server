import { Request, Response } from 'express'
import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'
import { withRetry } from '../../../utils/withRetry'
import {
  Conversation,
  fetchConversation,
  updateConversationLastMessageId,
} from '../../../db/conversations'
import { fetchPhoneNumberByNumber, PhoneNumber } from '../../../db/phoneNumbers'
import { Contact, findOrCreateContact } from '../../../db/contacts'
import {
  fetchMessageByWAMID,
  insertMessage,
  Message,
  MessageInsert,
} from '../../../db/messages'

async function insertTextMessage(
  message: any,
  display_phone_number: string,
  project_id: number,
  contacts: any[]
) {
  try {
    const { from, id, timestamp, type, text, context } = message
    const { body } = text
    const name = contacts[0].profile?.name
    const wa_id = contacts[0].wa_id

    const exist: Message = await withRetry(() => fetchMessageByWAMID(id))

    if (exist) {
      console.log('Message already exists in the database')
      return
    }

    const contact: Contact = await withRetry(() =>
      findOrCreateContact(wa_id, name, project_id)
    )

    const phoneNumber: PhoneNumber = await withRetry(() =>
      fetchPhoneNumberByNumber(display_phone_number)
    )

    const conversation: Conversation = await withRetry(() =>
      fetchConversation(
        contact.contact_id,
        phoneNumber.phone_number_id,
        project_id
      )
    )

    let messageInsert: MessageInsert = {
      contact_id: contact.contact_id,
      message_type: type,
      content: body,
      phone_number_id: phoneNumber.phone_number_id,
      wa_message_id: id,
      direction: 'inbound',
      project_id,
      status: 'received',
      conversation_id: conversation?.id,
    }

    if (context) {
      const contextMessage: Message = await withRetry(() =>
        fetchMessageByWAMID(context.id)
      )

      messageInsert = {
        ...messageInsert,
        context: contextMessage.message_id,
      }
    }

    const newMessage: Message = await withRetry(() =>
      insertMessage(messageInsert)
    )

    await withRetry(() =>
      updateConversationLastMessageId(conversation.id, newMessage.message_id)
    )

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
