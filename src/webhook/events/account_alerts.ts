import { Request, Response } from 'express';
import supabase from '../../db/supabaseClient';

// Example Response:
// {
//   "field": "account_alerts",
//   "value": {
//     "entity_type": "WABA",
//     "entity_id": 123456,
//     "alert_severity": "INFORMATIONAL",
//     "alert_status": "NONE",
//     "alert_type": "OBA_APPROVED",
//     "alert_description": "Sample alert description, informational in nature with no status"
//   }
// }

const handleAccountAlerts = async (req: Request, res: Response) => {
  // Handle account alerts
  console.log('Handling account alerts', req.body);
}

export default handleAccountAlerts;