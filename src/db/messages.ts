import supabase from './supabaseClient'
import { CampaignLog } from './campaignLogs'
import { Campaign } from './campaigns'
import { Database } from '../database.types';

export type Message = Database['public']['Tables']['messages']['Row']

interface InsertMessageParams {
  messageResponse?: any;
  campaignLog: CampaignLog;
  phoneNumberId: number;
  textContent: string;
  conversationId: string;
  campaign: Campaign;
  mediaUrl: string;
}

export const insertMessage = async (params: InsertMessageParams): Promise<Message> => {
  const {
    messageResponse,
    campaignLog,
    phoneNumberId,
    textContent,
    conversationId,
    campaign,
    mediaUrl
  } = params

  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        wa_message_id: messageResponse.messages[0].id || '',
        campaign_id: campaignLog.campaign_id,
        phone_number_id: phoneNumberId,
        contact_id: campaignLog.contact_id,
        message_type: 'TEMPLATE',
        content: textContent,
        direction: 'outgoing',
        status: messageResponse.messages[0].message_status || 'failed',
        project_id: campaign.project_id,
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
