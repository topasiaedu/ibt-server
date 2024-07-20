import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'
import { Database } from '../../../database.types'

async function findOrCreateContact(contact: any, project_id: string) {
  const { wa_id, profile } = contact
  const name = profile.name
  const email = profile.email || null

  // Attempt to find the contact in the database by wa_id
  let { data: existingContact, error: findError } = await supabase
    .from('contacts')
    .select('*')
    .eq('wa_id', wa_id)
    .eq('project_id', project_id)
    .single()

  // If the contact is found, return the existing contact_id
  if (existingContact) {
    if (email) {
      // Update the email if it is not already set
      if (!existingContact.email) {
        let { error: updateError } = await supabase
          .from('contacts')
          .update({ email })
          .eq('contact_id', existingContact.contact_id)
        if (updateError) {
          console.error('Error updating contact email in database:', updateError)
          logError(
            updateError,
            'Error updating contact email in database' +
              JSON.stringify(contact) +
              'Inside findOrCreateContact function in findOrCreateContact.ts'
          )
          return existingContact.contact_id
        }
      }
    }

    return existingContact.contact_id
  }

  // If not found, create a new contact
  let { data: newContact, error: createError } = await supabase
    .from('contacts')
    .insert([{ wa_id, name, project_id, email }])
    .select('*')
    .single()

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
  return newContact.contact_id
}

export default findOrCreateContact
