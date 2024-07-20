// cronJobs/processWorkflowLogs.ts
import supabase from '../../db/supabaseClient'
import { logError } from '../../utils/errorLogger'
import { Database } from '../../database.types'
import { Request, Response } from 'express'
import { generateWorkflowLog } from './helper/generateWorkflowLogs'

type Contact = Database['public']['Tables']['contacts']['Row']
type Action = Database['public']['Tables']['actions']['Row']

export const handleIBTWebhook = async (req: Request, res: Response) => {
  try {
    res.status(200).send('OK')
    console.log('IBT Webhook received')
    
    const workflowId = req.params.id
    const webhookData = req.body

    // Fetch the workflow and check if the run is true
    const { data: workflowData, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single()

    if (workflowError) {
      logError(workflowError as unknown as Error, 'Error fetching workflow')
      return
    }

    if (!workflowData?.run) {
      console.error('Workflow is not running')
      return
    }

    const { data: actionData, error: actionError } = await supabase
      .from('actions')
      .select('*')
      .eq('workflow_id', workflowId)

    if (actionError) {
      logError(actionError as unknown as Error, 'Error fetching action')
      return
    }

    let contact: Contact | null = null
    const { data, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('wa_id', webhookData.phone)
      .eq('project_id', actionData[0].project_id)
      .single()

    if (contactError) {
      console.error('Error fetching contact:', contactError)

      const { data: newContact, error: newContactError } = await supabase
        .from('contacts')
        .insert([
          {
            wa_id: webhookData.phone,
            name: webhookData.name,
            project_id: actionData[0].project_id,
          },
        ])
        .select('*')
        .single()

      if (newContactError) {
        console.error('Error creating new contact:', newContactError)
        logError(
          newContactError as unknown as Error,
          'Error creating new contact'
        )
        return
      }

      contact = newContact
    } else {
      contact = data
    }

    console.log("Action data", actionData)
    console.log("Contact data", contact)

    actionData.forEach(async (action: Action) => {
      generateWorkflowLog(action, contact as Contact)
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
