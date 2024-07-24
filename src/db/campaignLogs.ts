import { Database } from '../database.types'
import supabase from './supabaseClient'

export type CampaignLog = Database['public']['Tables']['campaign_logs']['Row']
export type CampaignLogsInsert =
  Database['public']['Tables']['campaign_logs']['Insert']

export const updateCampaignLogStatus = async (campaignLogId: string, status: string, error?:string) => {
  const { error:UpdateError } = await supabase.from('campaign_logs').update({ status, error }).eq('id', campaignLogId)
  if (UpdateError) throw UpdateError
}
