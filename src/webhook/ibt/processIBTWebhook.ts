// cronJobs/processWorkflowLogs.ts
import { Request, Response } from 'express'
import { generateWorkflowLog } from './helper/generateWorkflowLogs'
import { withRetry } from '../../utils/withRetry'
import { Contact, findOrCreateContact } from '../../db/contacts'
import { fetchWorkflow, Workflow } from '../../db/workflow'
import { Action, fetchActiveActions } from '../../db/action'

export const handleIBTWebhook = async (req: Request, res: Response) => {
  try {
    console.log('IBT Webhook received')

    const workflowId = req.params.id
    const webhookData = req.body.customData || req.body

    // Fetch the workflow and check if the run is true
    const workflow: Workflow = await withRetry(
      () => fetchWorkflow(workflowId),
      'handleIBTWebhook > fetchWorkflow'
    )

    if (!workflow?.run) {
      console.error('Workflow is not running')
      return
    }

    const actions: Action[] = await withRetry(
      () => fetchActiveActions(workflowId),
      'handleIBTWebhook > fetchActions'
    )

    let contact: Contact = await withRetry(
      () =>
        findOrCreateContact(
          webhookData.phone,
          webhookData.name,
          workflow.project_id,
          webhookData.email
        ),
      'handleIBTWebhook > findOrCreateContact'
    )

    actions.forEach(async (action: Action) => {
      await withRetry(
        () => generateWorkflowLog(action, contact as Contact),
        'handleIBTWebhook > generateWorkflowLog'
      )
    })

    res.status(200).send('OK')
  } catch (error) {
    console.error('Error processing webhook:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
