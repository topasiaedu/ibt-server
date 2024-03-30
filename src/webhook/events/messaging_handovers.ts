import { Request, Response } from 'express';
import supabase from '../../db/supabaseClient';

// Example Response:
// {
//   "field": "messaging_handovers",
//   "value": {
//     "messaging_product": "whatsapp",
//     "recipient": {
//       "display_phone_number": "16505553333",
//       "phone_number_id": "123456789"
//     },
//     "sender": {
//       "phone_number": "151005553333"
//     },
//     "timestamp": "1697041663",
//     "control_passed": {
//       "metadata": "Information about the conversation"
//     }
//   }
// }

const handleMessagingHandovers = async (req: Request, res: Response) => {
  // Handle messaging handovers
  console.log('Handling messaging handovers', req.body);
}

export default handleMessagingHandovers;