// cronJobs/processWorkflowLogs.ts
import supabase from '../../db/supabaseClient';
import { logError } from '../../utils/errorLogger';
import { Database } from '../../database.types';
import { Request, Response } from 'express';
import { generateWorkflowLog } from './helper/generateWorkflowLogs';

type WorkflowLog = Database['public']['Tables']['campaigns']['Row']
type Contact = Database['public']['Tables']['contacts']['Row']
type Workflow = Database['public']['Tables']['workflows']['Row']
type Trigger = Database['public']['Tables']['triggers']['Row']
type Action = Database['public']['Tables']['actions']['Row']
type Template = Database['public']['Tables']['templates']['Row']

export const handleIBTWebhook = async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.id;
    const webhookData = req.body;


    const { data: actionData, error: actionError } = await supabase
      .from('actions')
      .select('*')
      .eq('workflow_id', workflowId);

    if (actionError) {
      logError(actionError as unknown as Error, 'Error fetching action');
      return;
    }

    let contact: Contact | Contact[] | null = null;
    const { data, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('wa_id', webhookData.phone)
      .eq('project_id', actionData[0].project_id);

    if (contactError) {
      const { data: newContact, error: newContactError } = await supabase
        .from('contacts')
        .insert([
          {
            wa_id: webhookData.phone,
            name: webhookData.name,
            project_id: actionData[0].project_id,
          }
        ]).select('*');

      if (newContactError) {
        logError(newContactError as unknown as Error, 'Error creating new contact');
        return;
      }

      contact = newContact;
    } else {
      contact = data[0]
    }
    actionData.forEach(async (action: Action) => {
      generateWorkflowLog(action, contact as Contact);
    })

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
