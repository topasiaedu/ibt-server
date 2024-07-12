import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'
import { fetchImageURL, fetchMedia } from '../../../api/whatsapp'

const insertStickerMessage = async (
  message: any,
  display_phone_number: string,
  project_id: string
) => {
  try {
    console.log('Inserting sticker message into database')
    const { from, id, timestamp, type, sticker } = message
    const { id: imageId, caption } = sticker

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
      .select('*, whatsapp_business_accounts(*, business_manager(*))')
      .eq('number', display_phone_number)
      .neq('quality_rating', 'UNKNOWN')
      .single()

    const myPhoneNumber = myPhoneNumberId?.data?.phone_number_id
    const access_token =
      myPhoneNumberId?.data?.whatsapp_business_accounts?.business_manager
        ?.access_token
    // Look Up conversation_id
    let { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
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
    // Generate random file name
    const fileName =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)

    const media = await fetchMedia(imageId, fileName, access_token)

    if (!media) {
      throw new Error('Error fetching media from WhatsApp API')
    }

    // Insert the message into the database
    let { data: newMessage, error: messageError } = await supabase
      .from('messages')
      .insert([
        {
          contact_id: senderId,
          message_type: type,
          content: caption,
          phone_number_id: myPhoneNumber,
          wa_message_id: id,
          direction: 'inbound',
          media_url: media,
          project_id,
          status: 'received',
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

    if (messageError) {
      logError(
        messageError as unknown as Error,
        'Error inserting inbound image message into database. Data: ' +
          JSON.stringify(message, null, 2) +
          '\n Error: ' +
          messageError
      )
    }
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

export default insertStickerMessage
