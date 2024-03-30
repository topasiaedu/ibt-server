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

const handleMessages = async (req: Request, res: Response) => {
  // Assuming the structure of the incoming payload matches your example
  const { entry } = req.body;
  const changes = entry[0].changes[0];
  const metadata = changes.value.metadata;
  const message = changes.value.messages[0];
  const contact = changes.value.contacts[0];

  console.log('Handling messages', req.body);

  // Example pseudo-code for finding or creating a contact in your database
  // This step depends on your database schema and needs actual implementation
  let contactId = await findOrCreateContact(contact);
  let phoneNumberId = await supabase
    .from('phone_numbers')
    .select('phone_number_id')
    .eq('number', metadata.display_phone_number)
    .single().then(({ data, error }) => {
      if (error) {
        console.error('Error finding phone number in database:', error);
        throw error;
      }

      return data.phone_number_id;
    });

  // Assuming 'phone_number_id' should correspond to the 'phone_number_id' from metadata
  const messageData = {
    user_id: null, // This depends on your application logic
    phone_number_id: phoneNumberId.phone_number_id,
    contact_id: contactId, // Adjusted to use the actual contact ID (you need to implement findOrCreateContact)
    direction: 'inbound',
    message_type: message.type,
    content: message.text ? message.text.body : '', // Making sure to check if it's a text message
    status: 'received',
    timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
  };

  // Insert message into the database
  const { error } = await supabase
    .from('messages')
    .insert([messageData]);

  if (error) {
    console.error('Error saving message to database:', error);
    return res.status(500).send('Failed to save message');
  }

  return res.status(200).send('Message handled successfully');
};

async function findOrCreateContact(contact : any) {
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
