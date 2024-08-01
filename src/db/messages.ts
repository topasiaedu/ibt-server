import supabase from './supabaseClient'
import { CampaignLog } from './campaignLogs'
import { Database } from '../database.types';

export type Message = Database['public']['Tables']['messages']['Row']

interface InsertMessageParams {
  messageResponse?: any;
  campaignLog?: CampaignLog;
  contactId:number;
  phoneNumberId: number;
  textContent: string;
  conversationId: string;
  projectId: number;
  mediaUrl?: string;
}

export const insertMessage = async (params: InsertMessageParams): Promise<Message> => {
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
