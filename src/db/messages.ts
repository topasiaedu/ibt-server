import supabase from './supabaseClient'
import { CampaignLog } from './campaignLogs'
import { Database } from '../database.types';

export type Message = Database['public']['Tables']['messages']['Row']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
export type MessageUpdate = Database['public']['Tables']['messages']['Update']

interface InsertTemplateMessageParams {
  messageResponse?: any;
  campaignLog?: CampaignLog;
  contactId:number;
  phoneNumberId: number;
  textContent: string;
  conversationId: string;
  projectId: number;
  mediaUrl?: string;
}

export const insertTemplateMessage = async (params: InsertTemplateMessageParams): Promise<Message> => {
  const {
    messageResponse,
    campaignLog,
    contactId,
    phoneNumberId,
    textContent,
    conversationId,
    projectId: project_id,
    mediaUrl
  } = params

  console.log('Inserting message:', messageResponse)
  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        wa_message_id: messageResponse.messages[0].id || '',
        campaign_id: campaignLog ? campaignLog.campaign_id : null,
        phone_number_id: phoneNumberId,
        contact_id: contactId,
        message_type: 'TEMPLATE',
        content: textContent,
        direction: 'outgoing',
        status: messageResponse.messages[0].message_status || 'failed',
        project_id: project_id,
        media_url: mediaUrl,
        conversation_id: conversationId,
      },
    ])
    .select('*')
    .single()

  if (error) {
    console.error('Error inserting message in database:', error)
    console.error('Failed message:', messageResponse)
  }
  return data
}

export const fetchMessage = async (messageId: number): Promise<Message> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('message_id', messageId)
    .single()
  if (error) throw error
  return data
}

export const fetchMessageByWAMID = async (waMessageId: string): Promise<Message | null> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('wa_message_id', waMessageId)
  if (error) throw error

  // If more than 1 delete duplicates, save the oldest one
  if (data.length > 1) {
    const sortedData = data.sort((a, b) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
    const [oldestMessage, ...rest] = sortedData
    const restIds = rest.map((r) => r.message_id)
    await supabase
      .from('messages')
      .delete()
      .in('message_id', restIds)
  }

  if (data.length === 0) return null

  return data[0]
}

export const insertMessage = async (message: MessageInsert): Promise<Message> => {
  const { data, error } = await supabase
    .from('messages')
    .insert([message])
    .select('*')
    .single()
  if (error) throw error
  return data
}