import supabase  from "./supabaseClient";
import { Database } from "../database.types";

export type WhatsAppBusinessAccount = Database['public']['Tables']['whatsapp_business_accounts']['Row']
export type WhatsAppBusinessAccountInsert = Database['public']['Tables']['whatsapp_business_accounts']['Insert']
export type WhatsAppBusinessAccountUpdate = Database['public']['Tables']['whatsapp_business_accounts']['Update']

export const fetchWhatsAppBusinessAccountByWabaId = async (wabaId: number): Promise<WhatsAppBusinessAccount> => {
  const { data, error } = await supabase
    .from('whatsapp_business_accounts')
    .select('*')
    .eq('waba_id', wabaId)
    .single()
  if (error) throw error
  return data
}

export const fetchWhatsAppBusinessAccount = async (accountId: number): Promise<WhatsAppBusinessAccount> => {
  const { data, error } = await supabase
    .from('whatsapp_business_accounts')
    .select('*')
    .eq('account_id', accountId)
    .single()
  if (error) throw error
  return data
}