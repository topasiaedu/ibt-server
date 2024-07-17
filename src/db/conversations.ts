import supabase from './supabaseClient'

export const fetchConversation = async (
  contactId: number,
  phoneNumberId: number,
  projectId: number
) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('phone_number_id', phoneNumberId)
    .single()
  // If not found Create a new conversation
  if (error) {
    const { data, error } = await supabase
      .from('conversations')
      .insert([
        {
          contact_id: contactId,
          phone_number_id: phoneNumberId,
          project_id: projectId,
        },
      ])
      .select('id')
      .single()
    if (error) throw error
    return data
  }

  return data
}

export const insertConversation = async (
  contactId: string,
  phoneNumberId: string,
  projectId: string
) => {
  const { data, error } = await supabase
    .from('conversations')
    .insert([
      {
        contact_id: contactId,
        phone_number_id: phoneNumberId,
        project_id: projectId,
      },
    ])
    .single()
  if (error) throw error
  return data
}

export const updateConversation = async (
  conversationId: string,
  messageId: number
) => {
  const { error } = await supabase
    .from('conversations')
    .update({ last_message_id: messageId, updated_at: new Date() })
    .eq('id', conversationId)
  if (error) throw error
}
