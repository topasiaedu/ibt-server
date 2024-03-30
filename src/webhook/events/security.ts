import { Request, Response } from 'express';
import supabase from '../../db/supabaseClient';

// Example Response:
// {
//   "field": "security",
//   "value": {
//     "display_phone_number": "16505551111",
//     "event": "PIN_CHANGED",
//     "requester": "1000"
//   }
// }

const handleSecurity = async (req: Request, res: Response) => {
  // Handle security events
  console.log('Handling security events', req.body);
}

export default handleSecurity;