
import supabase from '../../db/supabaseClient';
import { logError } from '../../utils/errorLogger';

async function insertButtonMessage(message: any, display_phone_number: string, project_id: string) {
  try {
    const { from, id, timestamp, type, button } = message;
    const { text } = button;

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
      // Create a new contact if not found
      let { data: sender, error: contactError } = await supabase
        .from('contacts')
        .insert([{ wa_id: from }])
        .single();
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
        content: text,
        phone_number_id: myPhoneNumber,
        wa_message_id: id,
        direction: 'inbound',
        project_id,
      }])
      .single();

    if (messageError) {
      logError(messageError as unknown as Error, 'Error inserting inbound button message into database. Data: ' + JSON.stringify(message, null, 2) + '\n Error: ' + messageError);
    }
  } catch (error) {
    logError(error as Error, 'Error inserting inbound text message into database. Data: ' + JSON.stringify(message, null, 2) + '\n Error: ' + error);
    return 'Error inserting inbound text message into database';
  }
}

export default insertButtonMessage;