import { Database } from '../database.types'
import supabase from './supabaseClient'

export type Workflow = Database['public']['Tables']['workflows']['Row']
export type WorkflowUpdate = Database['public']['Tables']['workflows']['Update']
export type WorkflowInsert = Database['public']['Tables']['workflows']['Insert']

// CRUD
export const createWorkflow = async (workflow: WorkflowInsert): Promise<Workflow> => {
  const { data, error } = await supabase
    .from('workflows')
    .insert(workflow)
    .single()

  if (error) throw error
  return data as Workflow
}

export const fetchWorkflow = async (workflowId: string): Promise<Workflow> => {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', workflowId)
    .single()

  if (error) throw error
  return data as Workflow
}

export const updateWorkflow = async (
  workflowId: string,
  update: WorkflowUpdate
): Promise<Workflow> => {
  const { data, error } = await supabase
    .from('workflows')
    .update(update)
    .eq('id', workflowId)
    .single()

  if (error) throw error
  return data as Workflow
}

export const deleteWorkflow = async (workflowId: string): Promise<Workflow> => {
  const { data, error } = await supabase
    .from('workflows')
    .delete()
    .eq('id', workflowId)
    .single()

  if (error) throw error
  return data as Workflow
}