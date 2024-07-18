import supabase from '../../db/supabaseClient'
import { sendMessageWithTemplate } from '../../api/whatsapp'
import { logError } from '../../utils/errorLogger'
import { CronJob } from 'cron'
import { Database } from '../../database.types'
import { fetchCampaign } from '../../db/campaigns'
import { updateCampaignLogStatus } from '../../db/campaignLogs'
import { fetchContact, updateContactLastContactedBy } from '../../db/contacts'
import { formatPhoneNumber } from './helper/formatPhoneNumber'
import {
  generateMessageContent,
  processTemplatePayload,
} from '../../utils/templateUtils'
import { getCampaignPhoneNumber } from './helper/getCampaignPhoneNumber'
import { fetchTemplate } from '../../db/templates'
import { fetchConversation, updateConversation } from '../../db/conversations'
import { insertMessage } from '../../db/messages'

const campaignLogQueue: CampaignLog[] = []

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retrying due to error: ${error}. Retries left: ${retries}`);
      await new Promise(res => setTimeout(res, RETRY_DELAY));
      return withRetry(fn, retries - 1);
    } else {
      throw error;
    }
  }
}

function processQueue() {
  if (campaignLogQueue.length === 0) {
    return;
  }
  const campaignLog = campaignLogQueue.shift() as CampaignLog;
  processCampaignLog(campaignLog)
    .catch((error) => logError(error as Error, 'Error processing campaign log'))
    .finally(() => {
      processQueue();
    });
}

export type Campaign = Database['public']['Tables']['campaigns']['Row'] & {
  read_count: number;
};

export type CampaignLog = Database['public']['Tables']['campaign_logs']['Row'];
export type CampaignLogsInsert =
  Database['public']['Tables']['campaign_logs']['Insert'];

export interface TemplateMessagePayload {
  messaging_product: string;
  recipient_type: string;
  to: string;
  type: string;
  template: any;
}

const processCampaignLog = async (campaignLog: CampaignLog) => {
  if (campaignLog.status === 'TESTING') {
    console.log(`Processing test campaign log with id: ${campaignLog.id}`);
    await new Promise((resolve) => setTimeout(resolve, 10000)); // 10-second timeout to mimic processing
    console.log(`Processed test campaign log with id: ${campaignLog.id}`);
    updateCampaignLogStatus(campaignLog.id, 'TESTING-COMPLETED');
    return;
  }

  const contact = await withRetry(() => fetchContact(campaignLog.contact_id));
  console.log('Sending to contact', contact.name, 'with wa_id', contact.wa_id);

  const campaign = await withRetry(() => fetchCampaign(campaignLog.campaign_id));
  updateCampaignLogStatus(campaignLog.id, 'PROCESSING');

  contact.wa_id = formatPhoneNumber(contact.wa_id);

  const { processedPayload, mediaUrl } = processTemplatePayload(campaign, contact);

  const { selectedPhoneNumber, accessToken, phone_number_id } =
    await withRetry(() => getCampaignPhoneNumber(campaign.campaign_id));

  const template = await withRetry(() => fetchTemplate(campaign.template_id));
  const textContent = generateMessageContent(template, processedPayload);

  const conversation = await withRetry(() => fetchConversation(
    contact.contact_id,
    phone_number_id,
    campaign.project_id || 5
  ));

  console.log('Sending message to conversation', conversation.id);

  try {
    const { data: messageResponse } = await withRetry(() => sendMessageWithTemplate(
      processedPayload,
      selectedPhoneNumber,
      accessToken
    ));

    const newMessage = await withRetry(() => insertMessage({
      messageResponse,
      campaignLog,
      phoneNumberId: phone_number_id,
      textContent,
      conversationId: conversation.id,
      campaign,
      mediaUrl,
    }));

    console.log('Message created successfully:', newMessage.message_id);

    await withRetry(() => updateConversation(conversation.id, newMessage.message_id));
    await withRetry(() => updateContactLastContactedBy(contact.wa_id, phone_number_id));
    await updateCampaignLogStatus(campaignLog.id, 'COMPLETED');
  } catch (error) {
    console.error('Error sending message:', error);
    logError(error as Error, 'Error sending message');
    await updateCampaignLogStatus(campaignLog.id, 'FAILED');

    const failedMessage = await insertMessage({
      campaignLog,
      phoneNumberId: phone_number_id,
      textContent: textContent,
      conversationId: conversation.id,
      campaign,
      mediaUrl,
    });

    await updateConversation(conversation.id, failedMessage.message_id);
    return;
  }
};

export function setupRealtimeCampaignLogProcessing() {
  const subscription = supabase
    .channel('campaign_logs')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'campaign_logs' },
      (payload) => {
        const campaignLog = payload.new as CampaignLog;
        if (
          campaignLog.status === 'PENDING' ||
          campaignLog.status === 'TESTING'
        ) {
          scheduleCampaignLog(campaignLog);
        } else if (campaignLog.status === 'PROCESSING') {
          const index = campaignLogQueue.findIndex(
            (c) => c.id === campaignLog.id
          );
          if (index !== -1) {
            campaignLogQueue.splice(index, 1);
          }
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

function scheduleCampaignLog(campaignLog: CampaignLog) {
  campaignLogQueue.push(campaignLog);
  processQueue();
}

export const reschedulePendingCampaignLogs = async () => {
  const { data: campaignLogs, error } = await supabase
    .from('campaign_logs')
    .select('*')
    // Check for both PENDING and PROCESSING statuses
    .in('status', ['PENDING', 'TESTING'])

  if (error) {
    logError(error as unknown as Error, 'Error fetching pending campaign logs')
    return
  }

  if (!campaignLogs) {
    console.error('No pending campaign logs found')
    return
  }

  campaignLogs.forEach((campaignLog) => {
    scheduleCampaignLog(campaignLog)
  })

  processQueue()
}
