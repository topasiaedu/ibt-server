import { Database } from '../database.types'
import supabase from './supabaseClient'

export type PemniVipLogs = Database['public']['Tables']['pemni_vip_logs']['Row']
export type PemniVipLogsInsert =
  Database['public']['Tables']['pemni_vip_logs']['Insert']
export type PemniVipLogsUpdate =
  Database['public']['Tables']['pemni_vip_logs']['Update']

export const createPemniVipLog = async (
  log: PemniVipLogsInsert
): Promise<PemniVipLogs> => {
  const { data, error } = await supabase
    .from('pemni_vip_logs')
    .insert(log)
    .single()
  if (error) throw error
  return data as PemniVipLogs
}

export const fetchPemniVipLogs = async (): Promise<PemniVipLogs[]> => {
  const { data, error } = await supabase.from('pemni_vip_logs').select('*')
  if (error) throw error
  return data as PemniVipLogs[]
}

export const fetchPemniVipLog = async (id: number): Promise<PemniVipLogs> => {
  const { data, error } = await supabase
    .from('pemni_vip_logs')
    .select('*')
    .eq('id', id)
  if (error) throw error
  return data[0] as PemniVipLogs
}

export const updatePemniVipLog = async (
  id: string,
  log: PemniVipLogsUpdate
): Promise<PemniVipLogs> => {
  const { data, error } = await supabase
    .from('pemni_vip_logs')
    .update(log)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as PemniVipLogs
}

export const deletePemniVipLog = async (id: number): Promise<PemniVipLogs> => {
  const { data, error } = await supabase
    .from('pemni_vip_logs')
    .delete()
    .eq('id', id)
    .single()
  if (error) throw error
  return data as PemniVipLogs
}
