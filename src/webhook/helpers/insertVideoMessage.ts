import supabase from '../../db/supabaseClient';
import { logError } from '../../utils/errorLogger';
import { fetchImageURL } from '../../api/whatsapp';

const insertVideoMessage = async (message: any, display_phone_number: string) => {
  const { from, id, timestamp, type, video } = message;
  const { id: imageId, caption } = video;

  // Check if the database has the same wa_message_id
  let { data: existingMessage, error: findError } = await supabase
    .from('messages')
    .select('wa_message_id')
    .eq('wa_message_id', id)
    .single()

  if (existingMessage?.wa_message_id === id) {
    return 'Message already exists in the database';
  }

  // Fetch the image URL
  const { data: imageData } = await fetchImageURL(imageId);
  const url = imageData.url;

  // Find the contact_id of the sender
  let { data: sender, error: senderError } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('wa_id', from)
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

  // Change timestamp to DateTime format
  const date = new Date(parseInt(timestamp) * 1000);
  const formattedDate = date.toISOString();

  // Insert the message into the database
  let { data: newMessage, error: messageError } = await supabase
    .from('messages')
    .insert([{
      contact_id: senderId,
      message_type: type,
      content: caption,
      phone_number_id: myPhoneNumber,
      wa_message_id: id,
      direction: 'inbound',
      media_url: url,
    }])
    .single();

  if (messageError) {
    logError(messageError as unknown as Error, 'Error inserting inbound image message into database. Data: ' + JSON.stringify(message, null, 2) + '\n Error: ' + messageError);
  }
}

export default insertVideoMessage;