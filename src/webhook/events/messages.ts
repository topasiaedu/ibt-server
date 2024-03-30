import { Request, Response } from 'express';
import supabase from '../../db/supabaseClient';
import { Database } from '../../database.types';
import { logError } from '../../utils/errorLogger';

// Example Response:
// {
//   "object": "whatsapp_business_account",
//   "entry": [
//     {
//       "id": "0",
//       "changes": [
//         {
//           "field": "messages",
//           "value": {
//             "messaging_product": "whatsapp",
//             "metadata": {
//               "display_phone_number": "16505551111",
//               "phone_number_id": "123456123"
//             },
//             "contacts": [
//               {
//                 "profile": { "name": "test user name" },
//                 "wa_id": "16315551181"
//               }
//             ],
//             "messages": [
//               {
//                 "from": "16315551181",
//                 "id": "ABGGFlA5Fpa",
//                 "timestamp": "1504902988",
//                 "type": "text",
//                 "text": { "body": "this is a text message" }
//               }
//             ]
//           }
//         }
//       ]
//     }
//   ]
// }

const handleMessages = async (value: any) => {
  try {
    // Assuming the structure of the incoming payload matches your example
    const { metadata, contacts, messages } = value;
    const { display_phone_number, phone_number_id } = metadata;

    contacts.forEach(async (contact: any) => {
      await findOrCreateContact(contact);
    });

    messages.forEach(async (message: any) => {
      const { from, id, timestamp, type, text } = message;
      const { body } = text;

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
        .insert([{ contact_id: senderId, wa_message_id: id, content: body, message_type: type, phone_number_id: myPhoneNumber }])
        .single();

      if (messageError) {
        logError(messageError as unknown as Error, 'Error inserting message into database. Data: ' + JSON.stringify(value, null, 2) + '\n');
      }
    });

    return 'Messages processed successfully';
  } catch (error) {
    logError(error as Error, 'Error processing messages. Data: ' + JSON.stringify(value, null, 2) + '\n');
    return 'Error processing messages';
  }
};

async function findOrCreateContact(contact: any) {
  const { wa_id, profile } = contact;
  const name = profile.name;

  // Attempt to find the contact in the database by wa_id
  let { data: existingContact, error: findError } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('wa_id', wa_id)
    .single();

  // If the contact is found, return the existing contact_id
  if (existingContact) {
    return existingContact.contact_id;
  }

  // If not found, create a new contact
  let { data: newContact, error: createError } = await supabase
    .from('contacts')
    .insert([{ wa_id, name }])
    .single()

  if (createError) {
    console.error('Error creating new contact in database:', createError);
    throw createError;
  }

  // Check if newContact is not null before attempting to access its properties
  if (newContact) {
    const contact = newContact as Database['public']['Tables']['contacts']['Row'];
    return contact.contact_id
  } else {
    throw new Error('Failed to create a new contact ' + newContact);
  }
}

export default handleMessages;
