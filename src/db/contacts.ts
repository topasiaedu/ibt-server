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

export const findOrCreateContact = async (
  waId: string,
  name: string,
  projectId: number
): Promise<Contact> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('wa_id', waId)
    .eq('project_id', projectId)

  // If None found, create a new contact
  // If multiple found, return the first one and delete the rest
  if (error) {
    const { data, error } = await supabase
      .from('contacts')
      .insert([
        {
          wa_id: waId,
          name,
          project_id: projectId,
        },
      ])
      .select('*')
    if (error) throw error
    return data[0]
  }

  if (data.length > 1) {
    const contactId = data[0].contact_id
    const contactIds = data.map((contact: any) => contact.contact_id)

    const { error } = await supabase
      .from('conversations')
      .update({ contact_id: contactId })
      .in('contact_id', contactIds)
    if (error) throw error

    const { error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .in('contact_id', contactIds)
    if (deleteError) throw deleteError
  }

  return data[0]
}
