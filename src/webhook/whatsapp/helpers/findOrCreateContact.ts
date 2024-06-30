import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'
import { Database } from '../../../database.types'

async function findOrCreateContact(contact: any, project_id: string) {
  const { wa_id, profile } = contact
  const name = profile.name

  // Attempt to find the contact in the database by wa_id
  let { data: existingContact, error: findError } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('wa_id', wa_id)
    .eq('project_id', project_id)
    .single()

  if (findError) {
    console.error('Error finding contact in database:', findError)
    logError(
      findError,
      'Error finding contact in database' +
        JSON.stringify(contact) +
        'Inside findOrCreateContact function in findOrCreateContact.ts'
    )
    return
  }

  // If the contact is found, return the existing contact_id
  if (existingContact) {
    return existingContact.contact_id
  }

  // If not found, create a new contact
  let { data: newContact, error: createError } = await supabase
    .from('contacts')
    .insert([{ wa_id, name, project_id }])

  if (createError) {
    console.error('Error creating new contact in database:', createError)
    logError(
      createError,
      'Error creating new contact in database' +
        JSON.stringify(contact) +
        'Inside findOrCreateContact function in findOrCreateContact.ts'
    )
    return
  }

  console.log('newContact:', newContact)
}

export default findOrCreateContact
