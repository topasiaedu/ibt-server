
import supabase from '../../db/supabaseClient';
import { logError } from '../../utils/errorLogger';
import { Database } from '../../database.types';

async function findOrCreateContact(contact: any) {
  const { wa_id, profile } = contact;
  const name = profile.name;

  // Attempt to find the contact in the database by wa_id
  let { data: existingContact, error: findError } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('wa_id', wa_id)
    .single();

  // If the contact is found, return the existing contact_id
  if (existingContact) {
    return existingContact.contact_id;
  }

  // If not found, create a new contact
  let { data: newContact, error: createError } = await supabase
    .from('contacts')
    .insert([{ wa_id, name }])
    .single()

  if (createError) {
    console.error('Error creating new contact in database:', createError);
    throw createError;
  }

  // Check if newContact is not null before attempting to access its properties
  if (newContact) {
    const contact = newContact as Database['public']['Tables']['contacts']['Row'];
    return contact.contact_id
  } else {
    throw new Error('Failed to create a new contact ' + newContact);
  }
}

export default findOrCreateContact;