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

    const exist: Message | null = await withRetry(
      () => fetchMessageByWAMID(id),
      'insertTextMessage > fetchMessageByWAMID'
    )

    if (exist) {
      console.log('Message exists', exist.message_id)
      console.log('Message already exists in the database')
      return
    }

    const contact: Contact = await withRetry(
      () => findOrCreateContact(wa_id, name, project_id),
      'insertTextMessage > findOrCreateContact'
    )

    const phoneNumber: PhoneNumber = await withRetry(
      () => fetchPhoneNumberByNumber(display_phone_number),
      'insertTextMessage > fetchPhoneNumberByNumber'
    )

    const conversation: Conversation = await withRetry(
      () =>
        fetchConversation(
          contact.contact_id,
          phoneNumber.phone_number_id,
          project_id
        ),
      'insertTextMessage > fetchConversation'
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
      const contextMessage: Message | null = await withRetry(
        () => fetchMessageByWAMID(context.id),
        'insertTextMessage > fetchMessageByWAMID'
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
      'insertTextMessage > insertMessage'
    )

    await withRetry(
      () =>
        updateConversationLastMessageId(conversation.id, newMessage.message_id),
      'insertTextMessage > updateConversationLastMessageId'
    )
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
