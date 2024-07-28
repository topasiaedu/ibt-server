import supabase from './supabaseClient'

export const fetchConversation = async (
  contactId: number,
  phoneNumberId: number,
  projectId: number
) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contactId)
    .eq('phone_number_id', phoneNumberId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  // If not found Create a new conversation
  if (error || !data || data.length === 0) {
    const { data, error } = await supabase
      .from('conversations')
      .insert([
        {
          contact_id: contactId,
          phone_number_id: phoneNumberId,
          project_id: projectId,
        },
      ])
      .select('*')
      .single()
    if (error) throw error

    return data
  }

  // If multiple is returned, return the latest one
  // Remove the rest, and correct all the messages to point to the latest conversation
  if (data.length > 1) {
    const conversationId = data[0].id
    const conversationIds = data.map((conversation: any) => conversation.id)

    const { error } = await supabase
      .from('messages')
      .update({ conversation_id: conversationId })
      .in('conversation_id', conversationIds)
    if (error) throw error

    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .in('id', conversationIds)
    if (deleteError) throw deleteError
  }

  return data[0]
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
