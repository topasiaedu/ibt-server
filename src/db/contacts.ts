import { Database } from '../database.types'
import supabase from './supabaseClient'

export type Contact = Database['public']['Tables']['contacts']['Row']

export const fetchContact = async (contactId: number): Promise<Contact> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('contact_id', contactId)
    .single()
  if (error) throw error
  return data
}

export const updateContactLastContactedBy = async (
  waId: string,
  phoneNumberId: number
) => {
  const { error } = await supabase
    .from('contacts')
    .update({ last_contacted_by: phoneNumberId })
    .eq('wa_id', waId)
  if (error) throw error
}
