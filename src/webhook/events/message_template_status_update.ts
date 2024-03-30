import { Request, Response } from 'express';
import supabase from '../../db/supabaseClient';

// Example Response:
// {
//   "field": "message_template_status_update",
//   "value": {
//     "event": "APPROVED",
//     "message_template_id": 12345678,
//     "message_template_name": "my_message_template",
//     "message_template_language": "pt-BR",
//     "reason": null
//   }
// }

const handleMessageTemplateStatusUpdate = async (req: Request, res: Response) => {
  // Handle message template status updates
  console.log('Handling message template status updates', req.body);
}

export default handleMessageTemplateStatusUpdate;