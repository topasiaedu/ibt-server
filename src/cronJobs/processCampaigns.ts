// cronJobs/processCampaigns.ts
import  supabase  from '../db/supabaseClient';
import { sendMessageWithTemplate } from '../api/whatsapp';
import { TemplateMessage } from '../models/whatsapp/templateTypes';
import { CronJob } from 'cron';


const processCampaigns = async () => {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      templates (*),
      campaign_contacts!inner(*, contacts!inner(*))
    `)
    .eq('status', 'pending'); // Assuming 'pending' is the status for not completed

  if (error) {
    console.error('Error fetching campaigns:', error);
    return;
  }

  for (const campaign of campaigns) {
    for (const contact of campaign.campaign_contacts) {
      const payload: TemplateMessage = {
        messaging_product: "whatsapp",
        to: contact.contacts.phone,
        type: "template",
        template: {
          name: campaign.templates.name,
          language: {
            code: "en", // Adjust language code as necessary
          },
          components: [] // Include this only if necessary
        }
      };
      

      try {
        await sendMessageWithTemplate(payload);
        console.log(`Message sent to ${contact.contacts.phone} for campaign ${campaign.name}`);
      } catch (error) {
        console.error(`Failed to send message for campaign ${campaign.name} to ${contact.contacts.phone}:`, error);
      }
    }

    // Optionally, update the campaign status to 'completed'
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ status: 'completed' }) // Adjust based on your status field values
      .eq('id', campaign.id);

    if (updateError) {
      console.error(`Failed to update campaign ${campaign.name}:`, updateError);
    }
  }
};

// Schedule the task to run every second
const job = new CronJob('* * * * * *', processCampaigns, null, true, 'Asia/Kuala_Lumpur');
job.start();

console.log('Cron job started. Processing campaigns every second.');
