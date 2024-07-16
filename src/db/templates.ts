import { Database } from '../database.types'
import supabase from './supabaseClient'

export type Template = Database['public']['Tables']['templates']['Row']

export const fetchTemplate = async (templateId: number): Promise<Template> => {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('template_id', templateId)
    .single()
  if (error) throw error
  return data
}