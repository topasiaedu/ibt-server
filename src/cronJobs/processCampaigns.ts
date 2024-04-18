// cronJobs/processCampaigns.ts
import supabase from '../db/supabaseClient';
import { sendMessageWithTemplate } from '../api/whatsapp';
import { logError } from '../utils/errorLogger';
import { CronJob } from 'cron';
import { TemplateMessagePayload } from '../models/whatsapp/templateTypes';

const processCampaigns = async () => {
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
    const { data: updatedCampaignStatus, error: updateStatusError } = await supabase
      .from('campaigns')
      .update({ status: 'PROCESSING' })
      .eq('campaign_id', campaign.campaign_id);

    if (updateStatusError) {
      logError(updateStatusError as unknown as Error, 'Error updating campaign status');
      return;
    }

    for (const contact_list_member of campaign.contact_list.contact_list_members) {
      let templatePayload: TemplateMessagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: contact_list_member.contacts.wa_id,
        type: 'template',
        template: campaign.template_payload,
      };

      // Check template payload for %name%, %date%, %time% and replace with actual values
      templatePayload.template.components.forEach((component) => {
        component.parameters.forEach((parameter) => {
          if (parameter.text) {
            parameter.text = parameter.text.replace(/%name%/g, contact_list_member.contacts.name);
            parameter.text = parameter.text.replace(/%date%/g, campaign.date);
            parameter.text = parameter.text.replace(/%time%/g, campaign.time);
          }
        });
      });
      
      try {
        const { data: messageResponse } = await sendMessageWithTemplate(templatePayload, campaign.phone_numbers.wa_id);
        console.log('Message sent:', messageResponse);

        // Update campaign success count in the field sent
        const { data: updatedCampaignSentCount, error: updateSentCountError } = await supabase
          .from('campaigns')
          .update({ sent: campaign.sent + 1 })
          .eq('campaign_id', campaign.campaign_id);

        if (updateSentCountError) {
          logError(updateSentCountError as unknown as Error, 'Error updating campaign sent count');
          return;
        }

      } catch (error) {
        logError(error as Error, 'Error sending message');
        // Update campaign failed count in the field failed
        const { data: updatedCampaignFailedCount, error: updateFailedCountError } = await supabase
          .from('campaigns')
          .update({ failed: campaign.failed + 1 })
          .eq('campaign_id', campaign.campaign_id);

        if (updateFailedCountError) {
          logError(updateFailedCountError as unknown as Error, 'Error updating campaign failed count');
          return;
        }

      }

    }

    // Update campaign status
    const { data: updatedCampaign, error: updateError } = await supabase
      .from('campaigns')
      .update({ status: 'COMPLETED' })
      .eq('campaign_id', campaign.campaign_id);

    if (updateError) {
      logError(updateError as unknown as Error, 'Error updating campaign status');
      return;
    }
  }
};

export const campaignJob = new CronJob('* * * * * *', processCampaigns); // Run every second