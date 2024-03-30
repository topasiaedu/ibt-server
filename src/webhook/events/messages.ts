import { Request, Response } from 'express';
import supabase from '../../db/supabaseClient';

// Example Response:
// {
//   "field": "messages",
//   "value": {
//     "messaging_product": "whatsapp",
//     "metadata": {
//       "display_phone_number": "16505551111",
//       "phone_number_id": "123456123"
//     },
//     "contacts": [
//       {
//         "profile": {
//           "name": "test user name"
//         },
//         "wa_id": "16315551181"
//       }
//     ],
//     "messages": [
//       {
//         "from": "16315551181",
//         "id": "ABGGFlA5Fpa",
//         "timestamp": "1504902988",
//         "type": "text",
//         "text": {
//           "body": "this is a text message"
//         }
//       }
//     ]
//   }
// }

const handleMessages = async (req: Request, res: Response) => {
  const { messages, contacts } = req.body.entry[0].changes[0].value;

  console.log('Handling messages', req.body);

  // Assuming you're receiving a single message for simplicity
  const message = messages[0];
  const contact = contacts[0];

  // Prepare data for insertion
  const messageData = {
    user_id: null, // Set this according to your user identification logic
    phone_number_id: message.to, // Ensure this maps correctly to your `phone_numbers` table
    contact_id: contact.profile.name, // You might want to first check if the contact exists and create one if not
    direction: 'inbound', // Assuming inbound message
    message_type: message.type,
    content: message.text.body, // Adjust according to message type
    status: 'received', // Example status
    timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
  };

  // Insert message into database
  const { error } = await supabase
    .from('messages')
    .insert([messageData]);

  if (error) {
    console.error('Error saving message to database:', error);
    return res.status(500).send('Failed to save message');
  }

  return res.status(200).send('Message handled successfully');
};

export default handleMessages;
