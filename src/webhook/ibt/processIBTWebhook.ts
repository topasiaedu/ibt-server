// cronJobs/processWorkflowLogs.ts
import supabase from '../../db/supabaseClient';
import { logError } from '../../utils/errorLogger';
import { Database } from '../../database.types';
import { Request, Response } from 'express';

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

const generateWorkflowLog = async (action: Action, contact: Contact) => {
  let payload = {};
  let action_time = new Date();
  const ActionNodeTypes = ['add-to-contact-list', 'send-message', 'send-template'];
  switch (action.type) {
    case 'add-to-contact-list':
      const addToContactListDetails = action.details as { listId?: string; }
      payload = {
        list_id: addToContactListDetails.listId,
        contact_id: contact.contact_id,
        workflow_id: action.workflow_id,
      };
      break;
    case 'send-message':
      const sendMessageDetails = action.details as { message?: string; postTime?: string; timePostType?: string; postDate?: Date; }
      payload = {
        message: sendMessageDetails.message,
        contact_id: contact.contact_id,
        workflow_id: action.workflow_id,
      };

      if (sendMessageDetails.timePostType !== 'immediately' && sendMessageDetails.postTime! && sendMessageDetails.postDate!) {
        // Example postDate: '2022-01-01T00:00:00.000Z'
        // Example postTime: '12:00'
        action_time = new Date(sendMessageDetails.postDate + 'T' + sendMessageDetails.postTime);
      } else {
        action_time = new Date();
      }
      break;
    case 'send-template':
      const sendTemplateDetails = action.details as {
        selectedTemplate?: Template | null;
        templatePayload?: JSON;
        timePostType?: string;
        postTime?: string;
        postDate?: Date;
      }

      console.log('contact', contact);
      payload = {
        selected_template: sendTemplateDetails.selectedTemplate,
        template_payload: sendTemplateDetails.templatePayload,
        contact_id: contact.contact_id,
        workflow_id: action.workflow_id,
      };

      if (sendTemplateDetails.timePostType !== 'immediately' && sendTemplateDetails.postTime! && sendTemplateDetails.postDate!) {
        // Example postDate: '2022-01-01T00:00:00.000Z'
        // Example postTime: '12:00'
        action_time = new Date(sendTemplateDetails.postDate + 'T' + sendTemplateDetails.postTime);
      } else {
        action_time = new Date();
      }
      break;
    default:
      break;
  }

  const { data: newWorkflowLog, error: newWorkflowLogError } = await supabase
    .from('workflow_logs')
    .insert([
      {
        action_id: action.id,
        status: 'PENDING',
        payload,
        action_time,
        type: action.type,
      }
    ]);

  if (newWorkflowLogError) {
    logError(newWorkflowLogError as unknown as Error, 'Error creating new workflow log');
    return;
  }

  return newWorkflowLog;
}