import { insertContactListMembers } from '../../../db/contactListMembers'
import { updateWorkflowLog } from '../../../db/workflowLogs'
import { withRetry } from '../../../utils/withRetry'

export const addToContactList = async (payload: any, workflowLogId: string) => {
  const { contact_list_id, contact_id } = payload

  await withRetry(
    () => insertContactListMembers([{ contact_list_id, contact_id }]),
    'addToContactList > insertContactListMembers'
  )

  // Update workflow log status to completed
  await withRetry(
    () => updateWorkflowLog(workflowLogId, { status: 'COMPLETED' }),
    'addToContactList > updateWorkflowLog'
  )
}
