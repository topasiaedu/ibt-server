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
      new_phone_numbers: campaign_phone_numbers!campaign_id (*,
        phone_numbers (*)
      )
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

    let successCount = 0;
    let failedCount = 0;

    for (const contact_list_member of campaign.contact_list.contact_list_members) {
      // Check wa_id if it starts with 60 for malaysian numbers
      // If not, add the missing parts it could start with 0 or 1
      if (contact_list_member.contacts.wa_id.startsWith('60')) {
        contact_list_member.contacts.wa_id = '' + contact_list_member.contacts.wa_id;
      } else if (contact_list_member.contacts.wa_id.startsWith('1')) {
        contact_list_member.contacts.wa_id = '60' + contact_list_member.contacts.wa_id;
      } else if (contact_list_member.contacts.wa_id.startsWith('0')) {
        contact_list_member.contacts.wa_id = '6' + contact_list_member.contacts.wa_id;
      }


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

            // Check if the parameter.text has spintax, if so, replace it with a random value
            const spintaxRegex = /{([^{}]*)}/g;
            const spintaxMatch = parameter.text.match(spintaxRegex);
            if (spintaxMatch) {
              spintaxMatch.forEach((spintax) => {
                const options = spintax.substring(1, spintax.length - 1).split('|');
                const randomIndex = Math.floor(Math.random() * options.length);
                parameter.text = parameter?.text?.replace(spintax, options[randomIndex]);
              });
            }
          }
        });
      });

      const getWeightForRating = (rating: string) => {
        const weights: { [key: string]: number } = {
          GREEN: 6, // Higher probability for GREEN
          YELLOW: 3, // Moderate probability for YELLOW
          RED: 1, // Lower probability for RED
        };
        return weights[rating] || 1; // Default to 1 if undefined
      };

      // Create a weighted list of phone numbers
      const weightedPhoneNumbers = campaign.new_phone_numbers.flatMap((phone: any) => {
        const weight = getWeightForRating(phone.phone_numbers.quality_rating);
        return Array(weight).fill(phone.phone_numbers.wa_id); // Fill an array with the wa_id repeated by its weight
      });

      // Random selection from the weighted list
      const randomIndex = Math.floor(Math.random() * weightedPhoneNumbers.length);
      const selectedPhoneNumber = weightedPhoneNumbers[randomIndex];

      try {
        const { data: messageResponse } = await sendMessageWithTemplate(templatePayload, selectedPhoneNumber);
        console.log('Message sent:', messageResponse);

        // Lookup template to get the text and the image if any
        const { data: template, error: templateError } = await supabase
          .from('templates')
          .select('*')
          .eq('template_id', campaign.template_id)
          .single();

        let textContent = template?.components.data.map((component: any) => {
          if (component.type === 'BODY') {
            return component.text;
          }
        }).join(' ');

        if (textContent) {

          const textComponent = templatePayload?.template.components.find((component) => component.type === 'BODY');
          // Get the parameter text values into an array
          const bodyInputValues = textComponent?.parameters.map((parameter) => parameter.text) ?? [];

          // Replace {{index}} in the text content with the parameter text with the appropriate index
          textContent = textContent.replace(/{{\d+}}/g, (match: any) => {
            const index = parseInt(match.match(/\d+/g)![0]);
            return bodyInputValues[index - 1];
          });

        }

        // Add the message to the database under the table messages
        const { data: newMessage, error: messageError } = await supabase
          .from('messages')
          .insert([{
            wa_message_id: messageResponse.messages[0].id,
            campaign_id: campaign.campaign_id,
            phone_number_id: campaign.new_phone_numbers.find((phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber).phone_numbers.phone_number_id,
            contact_id: contact_list_member.contacts.contact_id,
            message_type: 'TEMPLATE',
            content: textContent,
            direction: 'outgoing',
            status: messageResponse.messages.message_status,
            project_id: campaign.project_id,
          }])
          .single();


      } catch (error) {
        console.error('Error sending message:', error);
        logError(error as Error, 'Error sending message');
      }

    }

    // Update campaign status
    const { data: updatedCampaign, error: updateError } = await supabase
      .from('campaigns')
      .update({ 
        status: 'COMPLETED',
        sent: successCount,
        failed: failedCount,})
      .eq('campaign_id', campaign.campaign_id);

    if (updateError) {
      logError(updateError as unknown as Error, 'Error updating campaign status');
      return;
    }
  }
};

export const campaignJob = new CronJob('*/10 * * * * *', processCampaigns); // Run every second