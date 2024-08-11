import { Database } from '../database.types'
import supabase from './supabaseClient'

export type Action = Database['public']['Tables']['actions']['Row']
export type ActionUpdate = Database['public']['Tables']['actions']['Update']
export type ActionInsert = Database['public']['Tables']['actions']['Insert']

// CRUD
export const createAction = async (action: ActionInsert): Promise<Action> => {
  const { data, error } = await supabase
    .from('actions')
    .insert(action)
    .single()

  if (error) throw error
  return data as Action
}

export const fetchAction = async (actionId: string): Promise<Action> => {
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .eq('id', actionId)
    .single()

  if (error) throw error
  return data as Action
}

export const updateAction = async (
  actionId: string,
  update: ActionUpdate
): Promise<Action> => {
  const { data, error } = await supabase
    .from('actions')
    .update(update)
    .eq('id', actionId)
    .single()

  if (error) throw error
  return data as Action
}

export const deleteAction = async (actionId: string): Promise<Action> => {
  const { data, error } = await supabase
    .from('actions')
    .delete()
    .eq('id', actionId)
    .single()

  if (error) throw error
  return data as Action
}

export const fetchActiveActions = async (workflowId: string): Promise<Action[]> => {
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .eq('workflow_id', workflowId)

  if (error) throw error
  return data as Action[]
}