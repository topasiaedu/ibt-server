import { Database } from '../database.types'
import supabase from './supabaseClient'

export type WorkflowLog = Database['public']['Tables']['workflow_logs']['Row']
export type WorkflowLogUpdate = Database['public']['Tables']['workflow_logs']['Update']
export type WorkflowLogInsert = Database['public']['Tables']['workflow_logs']['Insert']

// CRUD
export const createWorkflowLog = async (workflowLog: WorkflowLogInsert): Promise<WorkflowLog> => {
  const { data, error } = await supabase
    .from('workflow_logs')
    .insert(workflowLog)
    .single()

  if (error) throw error
  return data as WorkflowLog
}

export const fetchWorkflowLog = async (workflowLogId: string): Promise<WorkflowLog> => {
  const { data, error } = await supabase
    .from('workflow_logs')
    .select('*')
    .eq('id', workflowLogId)
    .single()

  if (error) throw error
  return data as WorkflowLog
}

export const updateWorkflowLog = async (
  workflowLogId: string,
  update: WorkflowLogUpdate
): Promise<WorkflowLog> => {
  const { data, error } = await supabase
    .from('workflow_logs')
    .update(update)
    .eq('id', workflowLogId)
    .single()

  if (error) throw error
  return data as WorkflowLog
}

export const deleteWorkflowLog = async (workflowLogId: string): Promise<WorkflowLog> => {
  const { data, error } = await supabase
    .from('workflow_logs')
    .delete()
    .eq('id', workflowLogId)
    .single()

  if (error) throw error
  return data as WorkflowLog
}

