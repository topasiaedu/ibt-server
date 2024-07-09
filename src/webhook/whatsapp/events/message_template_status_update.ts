import { Request, Response } from 'express';
import supabase from '../../../db/supabaseClient';
import { fetchTemplatesFunction } from '../../../cronJobs/fetchTemplates';
import { logError } from '../../../utils/errorLogger';

// Example Value:
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

const handleMessageTemplateStatusUpdate = async (value:any) => {
  const { event, message_template_id, message_template_name, message_template_language, reason } = value;
  console.log('Message Template Status Update Event Received: ' + event + '\n' + 'Template ID: ' + message_template_id + '\n' + 'Template Name: ' + message_template_name + '\n' + 'Template Language: ' + message_template_language + '\n' + 'Reason: ' + reason + '\n')

  // Try to update the message template status in the database, if it failed call the function fetchTemplatesFunction
  const { data: updatedTemplate, error: updateError } = await supabase
    .from('templates')
    .update({ 
      status: event,
      rejected_reason: reason
    })
    .eq('wa_template_id', message_template_id)
    .single()

  if (updateError) {
    console.error('Error updating template in database. Template ID: ' + message_template_id + '\n');
    console.error(JSON.stringify(updateError, null, 2));
    logError(updateError as unknown as Error, 'Error updating template in database. Template ID: ' + message_template_id + '\n');
    fetchTemplatesFunction();
  }
}

export default handleMessageTemplateStatusUpdate;