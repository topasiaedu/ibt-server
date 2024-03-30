import { Request, Response } from 'express';
import supabase from '../../db/supabaseClient';
import { Database } from '../../database.types';

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
  // Assuming the structure of the incoming payload matches your example
  const { metadata, contacts, messages } = value;
  const { display_phone_number, phone_number_id } = metadata;

  contacts.forEach(async (contact: any) => {
    const { wa_id, profile } = contact;
    const { name } = profile;
    const { from, id, timestamp, type, text } = messages[0];
    const { body } = text;

    // Find or create the contact in the database
    const contact_id = await findOrCreateContact(contact);

    // Find the phone number in the database
    let { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('phone_number_id')
      .eq('number', display_phone_number)
      .single();

    if (phoneError) {
      console.error('Error finding phone number in database:', phoneError);
      throw phoneError;
    }

    let phoneNumberId = phoneNumber ? phoneNumber.phone_number_id : null;

    // Insert the message into the database
    let { data: newMessage, error: createError } = await supabase
      .from('messages')
      .insert([{ contact_id, wa_id, phoneNumberId, from, id, timestamp, type, body }])
      .single();

    if (createError) {
      console.error('Error creating new message in database:', createError);
      throw createError;
    }

    console.log('Message inserted successfully:', newMessage);
  });

  return 'Messages processed successfully';
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

  if (findError) {
    console.error('Error finding contact in database:', findError);
    throw findError;
  }

  // If the contact is found, return the existing contact_id
  if (existingContact) {
    return existingContact.contact_id;
  }

  // If not found, create a new contact
  let { data: newContact, error: createError } = await supabase
    .from('contacts')
    .insert([{ wa_id, name }])
    .single();

  if (createError) {
    console.error('Error creating new contact in database:', createError);
    throw createError;
  }

  // Check if newContact is not null before attempting to access its properties
  if (newContact) {
    const contact = newContact as Database['public']['Tables']['contacts']['Row'];
    return contact.contact_id
  } else {
    throw new Error('Failed to create a new contact');
  }
}

export default handleMessages;
