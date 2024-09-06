import { Database } from '../database.types'
import supabase from './supabaseClient'

export type Contact = Database['public']['Tables']['contacts']['Row']

export const fetchContact = async (contactId: number): Promise<Contact> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('contact_id', contactId)
    .single()

  if (error)
    throw new Error(
      `Failed to fetch contact with ID ${contactId}: ${error.message}`
    )
  return data as Contact
}

export const updateContactLastContactedByUsingWaID = async (
  waId: string,
  phoneNumberId: number
) => {
  const { error } = await supabase
    .from('contacts')
    .update({ last_contacted_by: phoneNumberId })
    .eq('wa_id', waId)

  if (error)
    throw new Error(
      `Failed to update contact for waId ${waId}: ${error.message}`
    )
}

export const updateContactLastContactedBy = async (
  contactId: number,
  phoneNumberId: number
) => {
  const { error } = await supabase
    .from('contacts')
    .update({ last_contacted_by: phoneNumberId })
    .eq('contact_id', contactId)

  if (error)
    throw new Error(
      `Failed to update contact for contactId ${contactId}: ${error.message}`
    )
}

export const findOrCreateContact = async (
  waId: string,
  name: string,
  projectId: number,
  email?: string
): Promise<Contact> => {
  // Fetch contacts by waId and projectId
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('wa_id', waId)
    .eq('project_id', projectId)

  if (error)
    throw new Error(
      `Failed to fetch contacts for waId ${waId} and projectId ${projectId}: ${error.message}`
    )

  // Handle case where multiple contacts are found
  if (data?.length > 1) {
    const contactId = data[0].contact_id
    const contactIds = data.map((contact: any) => contact.contact_id)

    const { error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .in(
        'contact_id',
        contactIds.filter((id) => id !== contactId)
      )

    if (deleteError)
      throw new Error(
        `Failed to delete duplicate contacts: ${deleteError.message}`
      )

    // Update the first contact if necessary
    const contact = data[0]
    if (contact.email !== email) {
      const { error: updateError } = await supabase
        .from('contacts')
        .update({ name, email })
        .eq('contact_id', contactId)

      if (updateError)
        throw new Error(
          `Failed to update contact with ID ${contactId}: ${updateError.message}`
        )
    } else {
      // update only name
      const { error: updateError } = await supabase
        .from('contacts')
        .update({ name })
        .eq('contact_id', contactId)

      if (updateError)
        throw new Error(
          `Failed to update contact with ID ${contactId}: ${updateError.message}`
        )
    }

    return contact
  }

  // Handle case where no contacts are found
  if (data?.length === 0) {
    const { data: newData, error: createError } = await supabase
      .from('contacts')
      .insert([
        {
          wa_id: waId,
          name,
          email,
          project_id: projectId,
        },
      ])
      .select('*')
      .single()

    if (createError)
      throw new Error(`Failed to create new contact: ${createError.message}`)
    return newData as Contact
  }

  // Handle case where exactly one contact is found
  const contact = data[0]
  if (contact.name !== name || contact.email !== email) {
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ name, email })
      .eq('contact_id', contact.contact_id)

    if (updateError)
      throw new Error(
        `Failed to update contact with ID ${contact.contact_id}: ${updateError.message}`
      )
  }

  return contact
}
