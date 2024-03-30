import { Request, Response } from 'express';
import supabase from '../../db/supabaseClient';

// Example Response:
// {
//   "field": "template_category_update",
//   "value": {
//     "message_template_id": 12345678,
//     "message_template_name": "my_message_template",
//     "message_template_language": "en-US",
//     "previous_category": "SHIPPING_UPDATE",
//     "new_category": "UTILITY"
//   }
// }

const handleTemplateCategoryUpdate = async (req: Request, res: Response) => {
  // Handle template category updates
  console.log('Handling template category updates', req.body);
}

export default handleTemplateCategoryUpdate;