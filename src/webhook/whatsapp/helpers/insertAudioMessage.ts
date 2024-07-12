import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'
import { fetchMedia } from '../../../api/whatsapp'

const insertAudioMessage = async (
  message: any,
  display_phone_number: string,
  project_id: string
) => {
  console.log('Inserting audio message into database')
  try {
    const { from, id, timestamp, type, audio } = message
    const { id: audioId, caption } = audio

    console.log('message', message)

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

    // Generate random file name
    const fileName =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)

    const media = await fetchMedia(audioId, fileName, access_token)

    if (!media) {
      throw new Error('Error fetching media from WhatsApp API')
    }
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
        'Error inserting inbound audio message into database. Data: ' +
          JSON.stringify(message, null, 2) +
          '\n Error: ' +
          JSON.stringify(messageError, null, 2)
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
        'Inside insertAudioMessage function in insertAudioMessage.ts'
    )
    return 'Error inserting inbound text message into database'
  }
}

export default insertAudioMessage
