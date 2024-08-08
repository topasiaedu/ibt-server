import supabase from '../../../db/supabaseClient'
import { Contact, findOrCreateContact } from '../../../db/contacts'
import {
  Conversation,
  fetchConversation,
  updateConversationLastMessageId,
} from '../../../db/conversations'
import {
  fetchMessageByWAMID,
  insertMessage,
  Message,
  MessageInsert,
} from '../../../db/messages'
import { fetchPhoneNumberByNumber, PhoneNumber } from '../../../db/phoneNumbers'
import { logError } from '../../../utils/errorLogger'
import { withRetry } from '../../../utils/withRetry'

async function insertButtonMessage(
  message: any,
  display_phone_number: string,
  project_id: number,
  contacts: any[]
) {
  try {
    const { from, id, timestamp, type, button, context } = message
    const { text } = button
    const name = contacts[0].profile?.name
    const wa_id = contacts[0].wa_id

    const exist: Message | null = await withRetry(
      () => fetchMessageByWAMID(id),
      'insertButtonMessage > fetchMessageByWAMID'
    )

    if (exist) {
      console.log('Message exists', exist.message_id)
      console.log('Message already exists in the database')
      return
    }

    const contact: Contact = await withRetry(
      () => findOrCreateContact(wa_id, name, project_id),
      'insertButtonMessage > findOrCreateContact'
    )

    const phoneNumber: PhoneNumber = await withRetry(
      () => fetchPhoneNumberByNumber(display_phone_number),
      'insertButtonMessage > fetchPhoneNumberByNumber'
    )

    const conversation: Conversation = await withRetry(
      () =>
        fetchConversation(
          contact.contact_id,
          phoneNumber.phone_number_id,
          project_id
        ),
      'insertButtonMessage > fetchConversation'
    )

    let messageInsert: MessageInsert = {
      contact_id: contact.contact_id,
      message_type: type,
      content: text,
      phone_number_id: phoneNumber.phone_number_id,
      wa_message_id: id,
      direction: 'inbound',
      project_id,
      status: 'received',
      conversation_id: conversation?.id,
    }

    if (context) {
      const contextMessage: Message | null = await withRetry(
        () => fetchMessageByWAMID(context.id),
        'insertButtonMessage > fetchMessageByWAMID'
      )
      if (contextMessage) {
        messageInsert = {
          ...messageInsert,
          context: contextMessage.message_id,
        }
      }
    }

    const newMessage: Message = await withRetry(
      () => insertMessage(messageInsert),
      'insertButtonMessage > insertMessage'
    )

    await withRetry(
      () =>
        updateConversationLastMessageId(conversation.id, newMessage.message_id),
      'insertButtonMessage > updateConversationLastMessageId'
    )
  } catch (error) {
    logError(
      error as Error,
      'Error inserting inbound text message into database. Data: ' +
        JSON.stringify(message, null, 2) +
        '\n Error: ' +
        JSON.stringify(error, null, 2) +
        '\n' +
        'Inside insertButtonMessage function in insertButtonMessage.ts'
    )
    return 'Error inserting inbound text message into database'
  }
}

export default insertButtonMessage
