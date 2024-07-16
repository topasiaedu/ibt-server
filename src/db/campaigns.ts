import { Database } from '../database.types'
import supabase from './supabaseClient'

export type Campaign = Database['public']['Tables']['campaigns']['Row'] & {
  read_count: number
}

export const fetchCampaign = async (campaignId: number): Promise<Campaign> => {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('campaign_id', campaignId)
    .single()
  
  if (error) throw error
  return data as Campaign
}
