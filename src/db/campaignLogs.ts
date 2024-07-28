import { Database } from '../database.types'
import supabase from './supabaseClient'

export type CampaignLog = Database['public']['Tables']['campaign_logs']['Row']
export type CampaignLogsInsert =
  Database['public']['Tables']['campaign_logs']['Insert']

export const updateCampaignLogStatus = async (
  campaignLogId: string,
  status: string,
  error?: string
) => {
  const { error: UpdateError } = await supabase
    .from('campaign_logs')
    .update({ status, error })
    .eq('id', campaignLogId)
  if (UpdateError) throw UpdateError
}


export const insertCampaignLogs = async (
  campaignLogs: CampaignLogsInsert[]
) => {
  try {
    const logsToInsert: CampaignLogsInsert[] = [];

    for (const log of campaignLogs) {
      // Check if a log with the same campaign_id and contact_id already exists
      const { data: existingLogs, error: fetchError } = await supabase
        .from('campaign_logs')
        .select('id')
        .eq('campaign_id', log.campaign_id)
        .eq('contact_id', log.contact_id);

      if (fetchError) {
        console.error(`Error checking existence for campaign_id: ${log.campaign_id}, contact_id: ${log.contact_id}`, fetchError);
        continue; // Skip this log if there's an error
      }

      if (!existingLogs || existingLogs.length === 0) {
        logsToInsert.push(log); // Only add to insert list if no existing log is found
      }
    }

    if (logsToInsert.length > 0) {
      const { error } = await supabase
        .from('campaign_logs')
        .insert(logsToInsert);
      if (error) throw error;

      console.log(`${logsToInsert.length} new logs inserted.`);
    } else {
      console.log('No new logs to insert.');
    }
  } catch (error) {
    console.error('Error inserting campaign logs:', error);
    throw error;
  }
}


export const insertCampaignLog = async (
  campaignLog: CampaignLogsInsert
) => {
  const { error } = await supabase
    .from('campaign_logs')
    .insert([campaignLog])
  if (error) throw error
}