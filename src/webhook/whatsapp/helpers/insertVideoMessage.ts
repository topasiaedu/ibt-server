import { fetchMedia } from '../../../api/whatsapp'
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
import {
  fetchPhoneNumberBMAccessTokenByNumber,
  fetchPhoneNumberByNumber,
  PhoneNumber,
} from '../../../db/phoneNumbers'
import { logError } from '../../../utils/errorLogger'
import { withRetry } from '../../../utils/withRetry'

const insertVideoMessage = async (
  message: any,
  display_phone_number: string,
  project_id: number,
  contacts: any[]
) => {
  try {
    const { from, id, timestamp, type, video, context } = message
    const { id: imageId, caption } = video
    const name = contacts[0].profile?.name
    const wa_id = contacts[0].wa_id

    const exist: Message | null = await withRetry(
      () => fetchMessageByWAMID(id),
      'insertVideoMessage > fetchMessageByWAMID'
    )

    if (exist) {
      // console.log('Message exists', exist.message_id)
      // console.log('Message already exists in the database')
      return
    }

    const contact: Contact = await withRetry(
      () => findOrCreateContact(wa_id, name, project_id),
      'insertVideoMessage > findOrCreateContact'
    )
    console.log('Contact found or created', contact.contact_id)

    const phoneNumber: PhoneNumber = await withRetry(
      () => fetchPhoneNumberByNumber(display_phone_number),
      'insertVideoMessage > fetchPhoneNumberByNumber'
    )

    const accessToken: string = await withRetry(
      () => fetchPhoneNumberBMAccessTokenByNumber(display_phone_number),
      'insertVideoMessage > fetchPhoneNumberBMAccessTokenByNumber'
    )

    // Generate random file name
    const fileName =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)

    const media = await fetchMedia(imageId, fileName, accessToken)

    if (!media) {
      throw new Error('Error fetching media from WhatsApp API')
    }

    const conversation: Conversation = await withRetry(
      () =>
        fetchConversation(
          contact.contact_id,
          phoneNumber.phone_number_id,
          project_id
        ),
      'insertVideoMessage > fetchConversation'
    )

    console.log('Conversation found or created', conversation.id)

    let messageInsert: MessageInsert = {
      contact_id: contact.contact_id,
      message_type: type,
      content: caption,
      phone_number_id: phoneNumber.phone_number_id,
      wa_message_id: id,
      direction: 'inbound',
      media_url: media,
      project_id,
      status: 'received',
      conversation_id: conversation?.id,
    }

    if (context) {
      const contextMessage: Message | null = await withRetry(
        () => fetchMessageByWAMID(context.id),
        'insertVideoMessage > fetchMessageByWAMID'
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
      'insertVideoMessage > insertMessage'
    )

    await withRetry(
      () =>
        updateConversationLastMessageId(conversation.id, newMessage.message_id),
      'insertVideoMessage > updateConversationLastMessageId'
    )
  } catch (error) {
    logError(
      error as Error,
      'Error inserting inbound text message into database. Data: ' +
        JSON.stringify(message, null, 2) +
        '\n Error: ' +
        error
    )
    return 'Error inserting inbound text message into database'
  }
}

export default insertVideoMessage
