import { Request, Response } from 'express';
import supabase from '../../db/supabaseClient';

// Example Response:
// {
//   "field": "flows",
//   "value": {
//     "event": "FLOW_STATUS_CHANGE",
//     "message": "Flow {FlowName} changed status from DRAFT to PUBLISHED",
//     "flow_id": "1000"
//   }
// }

const handleFlows = async (req: Request, res: Response) => {
  // Handle flows
  console.log('Handling flows', req.body);
};

export default handleFlows;