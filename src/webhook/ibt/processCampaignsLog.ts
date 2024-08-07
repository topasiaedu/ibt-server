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
import {
  fetchConversation,
  updateConversationLastMessageId,
} from '../../db/conversations'
import { insertTemplateMessage } from '../../db/messages'
import { withRetry } from '../../utils/withRetry'

const campaignLogQueue: CampaignLog[] = []

let CONCURRENCY_LIMIT = 10
const BATCH_SIZE = 1000 // Adjust as needed
let activeProcesses = 0

function processQueue() {
  if (campaignLogQueue.length === 0 || activeProcesses >= CONCURRENCY_LIMIT) {
    return
  }
  activeProcesses++
  const campaignLog = campaignLogQueue.shift() as CampaignLog
  processCampaignLog(campaignLog)
    .catch((error) => logError(error as Error, 'Error processing campaign log'))
    .finally(() => {
      activeProcesses--
      processQueue()
    })
}

export type Campaign = Database['public']['Tables']['campaigns']['Row'] & {
  read_count: number
}

export type CampaignLog = Database['public']['Tables']['campaign_logs']['Row']
export type CampaignLogsInsert =
  Database['public']['Tables']['campaign_logs']['Insert']

export interface TemplateMessagePayload {
  messaging_product: string
  recipient_type: string
  to: string
  type: string
  template: any
}

const processCampaignLog = async (campaignLog: CampaignLog) => {
  try {
    const contact = await withRetry(
      () => fetchContact(campaignLog.contact_id),
      'processCampaignLog > fetchContact'
    )
    console.log('Sending to contact', contact.name, 'with wa_id', contact.wa_id)

    const campaign = await withRetry(
      () => fetchCampaign(campaignLog.campaign_id),
      'processCampaignLog > fetchCampaign'
    )
    await withRetry(
      () => updateCampaignLogStatus(campaignLog.id, 'PROCESSING'),
      'processCampaignLog > updateCampaignLogStatus'
    )

    contact.wa_id = formatPhoneNumber(contact.wa_id)

    const { processedPayload, mediaUrl } = processTemplatePayload(
      campaign,
      contact
    )

    const { selectedPhoneNumber, accessToken, phone_number_id } =
      await withRetry(
        () => getCampaignPhoneNumber(campaign.campaign_id),
        'processCampaignLog > getCampaignPhoneNumber'
      )

    const template = await withRetry(
      () => fetchTemplate(campaign.template_id),
      'processCampaignLog > fetchTemplate'
    )
    const textContent = generateMessageContent(template, processedPayload)

    const conversation = await withRetry(
      () =>
        fetchConversation(
          contact.contact_id,
          phone_number_id,
          campaign.project_id || 5
        ),
      'processCampaignLog > fetchConversation'
    )

    console.log('Sending message to conversation', conversation.id)

    const { data: messageResponse } = await withRetry(
      () =>
        sendMessageWithTemplate(
          processedPayload,
          selectedPhoneNumber,
          accessToken
        ),
      'processCampaignLog > sendMessageWithTemplate'
    )

    if (!messageResponse) {
      throw new Error('Message sending failed')
    }

    const newMessage = await withRetry(
      () =>
        insertTemplateMessage({
          messageResponse,
          campaignLog,
          phoneNumberId: phone_number_id,
          textContent,
          conversationId: conversation.id,
          projectId: campaign.project_id || 5,
          mediaUrl,
          contactId: contact.contact_id,
        }),
      'processCampaignLog > insertTemplateMessage'
    )

    console.log('Message created successfully:', newMessage.message_id)

    await withRetry(
      () =>
        updateConversationLastMessageId(conversation.id, newMessage.message_id),
      'processCampaignLog > updateConversationLastMessageId'
    )
    await withRetry(
      () => updateContactLastContactedBy(contact.wa_id, phone_number_id),
      'processCampaignLog > updateContactLastContactedBy'
    )
    await withRetry(
      () => updateCampaignLogStatus(campaignLog.id, 'COMPLETED'),
      'processCampaignLog > updateCampaignLogStatus'
    )
  } catch (error) {
    console.error('Error sending message:', error)
    logError(error as Error, 'Error sending message')
    await updateCampaignLogStatus(campaignLog.id, 'FAILED', error as string)
  }
}

export function setupRealtimeCampaignLogProcessing() {
  const subscription = supabase
    .channel('campaign_logs')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'campaign_logs' },
      (payload) => {
        // console.log('Campaign log Event Detected');
        const campaignLog = payload.new as CampaignLog
        if (
          campaignLog.status === 'PENDING' ||
          campaignLog.status === 'TESTING'
        ) {
          scheduleCampaignLog(campaignLog)
        } else if (campaignLog.status === 'PROCESSING') {
          const index = campaignLogQueue.findIndex(
            (c) => c.id === campaignLog.id
          )
          if (index !== -1) {
            campaignLogQueue.splice(index, 1)
          }
        }
      }
    )
    .subscribe()

  return () => {
    subscription.unsubscribe()
  }
}

function scheduleCampaignLog(campaignLog: CampaignLog) {
  campaignLogQueue.push(campaignLog)
  processQueue()
}

export const reschedulePendingCampaignLogs = async () => {
  let campaignLogs: CampaignLog[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('campaign_logs')
      .select('*')
      .in('status', ['PENDING', 'TESTING'])
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      logError(
        error as unknown as Error,
        'Error fetching pending campaign logs'
      )
      return
    }

    if (!data || data.length === 0) {
      break
    }

    campaignLogs = campaignLogs.concat(data)
    offset += BATCH_SIZE
  }

  if (campaignLogs.length === 0) {
    console.error('No pending campaign logs found')
    return
  }

  campaignLogs.forEach((campaignLog) => {
    scheduleCampaignLog(campaignLog)
  })

  processQueue()
}
