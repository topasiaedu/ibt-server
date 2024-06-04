// cronJobs/processWorkflowLogs.ts
import supabase from '../../db/supabaseClient'
import { sendMessageWithTemplate } from '../../api/whatsapp'
import { logError } from '../../utils/errorLogger'
import { CronJob } from 'cron'
import { Database } from '../../database.types'
import { sendTemplate } from './action-handler/send-template'
import { sendMessage } from './action-handler/send-message'
import { addToContactList } from './action-handler/add-to-contact-list'

const workflowLogQueue: WorkflowLog[] = []

function processQueue() {
  if (workflowLogQueue.length === 0) {
    return
  }
  const workflowLog = workflowLogQueue.shift() as WorkflowLog
  processWorkflowLogs(workflowLog)
    .catch((error) => logError(error as Error, 'Error processing workflow log'))
    .finally(() => processQueue())
}

export type WorkflowLog = Database['public']['Tables']['workflow_logs']['Row']

export interface TemplateMessagePayload {
  messaging_product: string
  recipient_type: string
  to: string
  type: string
  template: any
}

const processWorkflowLogs = async (workflowLog: WorkflowLog) => {
  const { data: updatedWorkflowLogStatus, error: updateStatusError } =
    await supabase
      .from('workflow_logs')
      .update({ status: 'PROCESSING' })
      .eq('id', workflowLog.id)

  if (updateStatusError) {
    logError(
      updateStatusError as unknown as Error,
      'Error updating workflowLog status'
    )
    return
  }

  try {
    switch (workflowLog.type) {
      case 'send-template':
        await sendTemplate(workflowLog.payload, workflowLog.id)
        break
      case 'send-message':
        await sendMessage(workflowLog.payload, workflowLog.id)
        break
      case 'add-to-contact-list':
        await addToContactList(workflowLog.payload, workflowLog.id)
        break
      default:
        console.warn(`Unknown workflow log type: ${workflowLog.type}`)
        break
    }
  } catch (error) {
    logError(
      error as Error,
      `Error processing workflow log type: ${workflowLog.type}`
    )

    const { data: updatedWorkflowLog, error: updateError } = await supabase
      .from('workflow_logs')
      .update({ status: 'ERROR' })
      .eq('id', workflowLog.id)
  }

  const { data: updatedWorkflowLog, error: updateError } = await supabase
    .from('workflow_logs')
    .update({ status: 'COMPLETED' })
    .eq('id', workflowLog.id)
}

export function setupRealtimeWorkflowLogProcessing() {
  const subscription = supabase
    .channel('workflow_logs')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'workflow_logs' },
      (payload) => {
        const workflowLog = payload.new as WorkflowLog
        if (workflowLog.status === 'PENDING') {
          scheduleWorkflowLog(workflowLog)
        }
      }
    )
    .subscribe()

  return () => {
    subscription.unsubscribe()
  }
}

function scheduleWorkflowLog(workflowLog: WorkflowLog) {
  const delay = new Date(workflowLog.action_time).getTime() - Date.now()
  if (delay < 0) {
    workflowLogQueue.push(workflowLog)
    processQueue()
  } else {
    setTimeout(() => {
      workflowLogQueue.push(workflowLog)
      processQueue()
    }, delay)
  }
}

export const reschedulePendingWorkflowLogs = async () => {
  const { data: workflowLogs, error } = await supabase
    .from('workflow_logs')
    .select('*')
    .in('status', ['PENDING', 'PROCESSING'])

  if (error) {
    logError(error as unknown as Error, 'Error fetching pending workflow logs')
    return
  }

  if (!workflowLogs) {
    return
  }

  workflowLogs.forEach((workflowLog) => {
    workflowLogQueue.push(workflowLog)
  })

  processQueue()
}
