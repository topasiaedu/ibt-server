
import supabase from '../../../db/supabaseClient';
import { logError } from '../../../utils/errorLogger';
import { fetchMedia } from '../../../api/whatsapp';

const insertImageMessage = async (message: any, display_phone_number: string, project_id: string) => {
  console.log('Inserting image message into database'	)
  try {
    const { from, id, timestamp, type, image } = message;
    const { id: imageId, caption } = image;

    // Check if the database has the same wa_message_id
    let { data: existingMessage, error: findError } = await supabase
      .from('messages')
      .select('wa_message_id')
      .eq('wa_message_id', id)
      .single()

    if (existingMessage?.wa_message_id === id) {
      return 'Message already exists in the database';
    }

    // Find the contact_id of the sender
    let { data: sender, error: senderError } = await supabase
      .from('contacts')
      .select('contact_id')
      .eq('wa_id', from)
      .eq('project_id', project_id)
      .single();

    if (senderError) {
      console.error('Error finding sender in database:', senderError);
      throw senderError;
    }

    if (!sender) {
      throw new Error('Sender not found in database');
    }

    const senderId = sender.contact_id;

    const myPhoneNumberId = await supabase
      .from('phone_numbers')
      .select('phone_number_id')
      .eq('number', display_phone_number)
      .single();

    const myPhoneNumber = myPhoneNumberId?.data?.phone_number_id;

    // Generate random file name 
    const fileName = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const media = await fetchMedia(imageId, fileName);

    if (!media) {
      throw new Error('Error fetching media from WhatsApp API');
    }

    // Insert the message into the database
    let { error: messageError } = await supabase
      .from('messages')
      .insert([{
        contact_id: senderId,
        message_type: type,
        content: caption,
        phone_number_id: myPhoneNumber,
        wa_message_id: id,
        direction: 'inbound',
        media_url: media,
        project_id,
        status: 'received',
      }])
      .single();

    if (messageError) {
      logError(messageError as unknown as Error, 'Error inserting inbound image message into database. Data: ' + JSON.stringify(message, null, 2) + '\n Error: ' + JSON.stringify(messageError, null, 2));
    }
  } catch (error) {
    logError(error as Error, 'Error inserting inbound text message into database. Data: ' + JSON.stringify(message, null, 2) + '\n Error: ' + error);
    return 'Error inserting inbound text message into database';
  }
}

export default insertImageMessage;