import { Request, Response } from 'express';
import supabase from '../../../db/supabaseClient';

// Example Response:
// {
//   "field": "message_echoes",
//   "value": {
//     "messaging_product": "whatsapp",
//     "metadata": {
//       "display_phone_number": "16505551111",
//       "phone_number_id": "123456123"
//     },
//     "message_echoes": [
//       {
//         "from": "16315551181",
//         "to": "11234567890",
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

const handleMessageEchoes = async (req: Request, res: Response) => {
  // Handle message echoes
  console.log('Handling message echoes', req.body);
}

export default handleMessageEchoes;