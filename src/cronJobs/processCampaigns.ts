// cronJobs/processCampaigns.ts
import supabase from '../db/supabaseClient';
import { sendMessageWithTemplate } from '../api/whatsapp';
import { logError } from '../utils/errorLogger';
import { CronJob } from 'cron';
import { TemplateMessagePayload } from '../models/whatsapp/templateTypes';

const processCampaigns = async () => {
  console.log('Processing campaigns...');
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      contact_list: contact_lists!contact_list_id (
        *,
        contact_list_members: contact_list_members (*,
          contacts (*)
        )
      ),
      templates: templates!template_id (*),
      phone_numbers: phone_numbers!phone_number_id (*)
    `)
    .eq('status', 'PENDING'); // Assuming 'pending' is the status for not completed

  if (error) {
    console.error('Error fetching campaigns:', error);
    return;
  }

  if (!campaigns) {
    console.log('No campaigns to process');
    return;
  }

  for (const campaign of campaigns) {
    for (const contact_list_member of campaign.contact_list.contact_list_members) {
      // Send message to contact
      console.log(`Sending message to ${contact_list_member.contacts.wa_id}`);

      // Send message logic here
      const templatePayload: TemplateMessagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: contact_list_member.contacts.wa_id,
        type: 'template',
        template: campaign.template_payload,
      };

    const { data: messageResponse } = await sendMessageWithTemplate(templatePayload, campaign.phone_numbers.wa_id);
    }
  }

  const { data: updatedCampaigns, error: updateError } = await supabase
    .from('campaigns')
    .update({ status: 'COMPLETED' }) // Update the status to completed
    .in('campaign_id', campaigns.map(campaign => campaign.campaign_id)); // Update only the processed campaigns

  if (updateError) {
    console.error('Error updating campaigns:', updateError);
    return;
  }

  console.log('Campaigns processed successfully');
};

export const campaignJob = new CronJob('*/30 * * * * *', processCampaigns); // Run every second