// cronJobs/processWorkflowLogs.ts
import supabase from '../../db/supabaseClient'
import { logError } from '../../utils/errorLogger'
import { Database } from '../../database.types'
import { Request, Response } from 'express'
import { generateWorkflowLog } from './helper/generateWorkflowLogs'
import { withRetry } from '../../utils/withRetry'
import { findOrCreateContact } from '../../db/contacts'

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

    let contact: Contact = await withRetry(() =>
      findOrCreateContact(
        webhookData.phone,
        webhookData.name,
        actionData[0].project_id,
        webhookData.email
      ), 'handleIBTWebhook > findOrCreateContact'
    )

    actionData.forEach(async (action: Action) => {
      await withRetry(() => generateWorkflowLog(action, contact as Contact), 'handleIBTWebhook > generateWorkflowLog')
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
