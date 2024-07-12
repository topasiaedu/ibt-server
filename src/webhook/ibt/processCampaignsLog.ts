// cronJobs/processCampaigns.ts
import supabase from '../../db/supabaseClient'
import { sendMessageWithTemplate } from '../../api/whatsapp'
import { logError } from '../../utils/errorLogger'
import { CronJob } from 'cron'
import { Database } from '../../database.types'

const campaignLogQueue: CampaignLog[] = []

function processQueue() {
  if (campaignLogQueue.length === 0) {
    return
  }
  const campaignLog = campaignLogQueue.shift() as CampaignLog
  processCampaignLog(campaignLog)
    .catch((error) => logError(error as Error, 'Error processing campaign log'))
    .finally(() => {
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
  // Fetch campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('campaign_id', campaignLog.campaign_id)
    .single()

  if (campaignError || !campaign) {
    logError(campaignError as unknown as Error, 'Error fetching campaign')
    return
  }

  // Update the campaign log status to PROCESSING
  const { error: updateStatusError } = await supabase
    .from('campaign_logs')
    .update({ status: 'PROCESSING' })
    .eq('id', campaignLog.id)

  if (updateStatusError) {
    logError(
      updateStatusError as unknown as Error,
      'Error updating campaign log status'
    )
    return
  }

  // Fetch the contact
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .eq('contact_id', campaignLog.contact_id)
    .single()

  if (contactError || !contact) {
    logError(contactError as unknown as Error, 'Error fetching contact')
    return
  }

  console.log('Processing campaign log:', campaignLog.id)
  console.log('Contact:', contact)
  console.log('Campaign:', campaign)
  console.log('Campaign Log:', campaignLog)
  console.log('Template:', campaign.template_payload)

  // Trim any extraneous whitespace or control characters from wa_id
  contact.wa_id = contact.wa_id.trim()

  // Check wa_id if it starts with 60 for Malaysian numbers
  // If not, add the missing parts it could start with 0 or 1
  if (contact.wa_id.startsWith('60')) {
    contact.wa_id = '' + contact.wa_id
  } else if (contact.wa_id.startsWith('1')) {
    contact.wa_id = '60' + contact.wa_id
  } else if (contact.wa_id.startsWith('0')) {
    contact.wa_id = '6' + contact.wa_id
  }

  // Ensure that there is only number present in the string (as we have '\r' at the end for some numbers)
  contact.wa_id = contact.wa_id.replace(/\D/g, '')

  // Create a fresh copy of the template payload
  let templatePayload: TemplateMessagePayload = JSON.parse(
    JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: contact.wa_id,
      type: 'template',
      template: campaign.template_payload as TemplateMessagePayload['template'],
    })
  )

  let mediaUrl = ''

  // Check template payload for %name%, %date%, %time% and replace with actual values
  templatePayload.template.components.forEach((component: any) => {
    component.parameters.forEach((parameter: any) => {
      if (parameter.text) {
        parameter.text = parameter.text.replace(/%name%/g, contact.name)

        // Check if the parameter.text has spintax, if so, replace it with a random value
        const spintaxRegex = /{([^{}]*)}/g
        const spintaxMatch = parameter.text.match(spintaxRegex)
        if (spintaxMatch) {
          spintaxMatch.forEach((spintax: any) => {
            const options = spintax.substring(1, spintax.length - 1).split('|')
            const randomIndex = Math.floor(Math.random() * options.length)
            parameter.text = parameter?.text?.replace(
              spintax,
              options[randomIndex]
            )
          })
        }
      } else if (
        parameter.type === 'image' ||
        parameter.type === 'document' ||
        parameter.type === 'video'
      ) {
        mediaUrl = parameter[parameter.type].link
      }
    })
  })

  const getWeightForRating = (rating: string) => {
    const weights: { [key: string]: number } = {
      GREEN: 6, // Higher probability for GREEN
      YELLOW: 3, // Moderate probability for YELLOW
      RED: 1, // Lower probability for RED
    }
    return weights[rating] || 1 // Default to 1 if undefined
  }

  // Fetch new phone numbers by using campaign id in campaign_phone_numbers
  const { data: newPhoneNumbers, error: newPhoneNumbersError } = await supabase
    .from('campaign_phone_numbers')
    .select(
      '*, phone_numbers(*,whatsapp_business_accounts(*,business_manager(*)))'
    )
    .eq('campaign_id', campaignLog.campaign_id)

  if (newPhoneNumbersError) {
    logError(
      newPhoneNumbersError as unknown as Error,
      'Error fetching new phone numbers'
    )
    console.error('Error fetching new phone numbers:', newPhoneNumbersError)
    return
  }

  console.log('New phone numbers:', newPhoneNumbers)

  // Create a weighted list of phone numbers
  const weightedPhoneNumbers = newPhoneNumbers.flatMap((phone: any) => {
    const weight = getWeightForRating(phone.phone_numbers.quality_rating)
    return Array(weight).fill(phone.phone_numbers.wa_id) // Fill an array with the wa_id repeated by its weight
  })

  // Random selection from the weighted list
  const randomIndex = Math.floor(Math.random() * weightedPhoneNumbers.length)
  const selectedPhoneNumber = weightedPhoneNumbers[randomIndex]

  try {
    const { data: messageResponse } = await sendMessageWithTemplate(
      templatePayload,
      selectedPhoneNumber,
      newPhoneNumbers.find(
        (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
      ).phone_numbers.whatsapp_business_accounts.business_manager.access_token
    )

    console.log('Message response:', messageResponse)

    // Lookup template to get the text and the image if any
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .select('*')
      .eq('template_id', campaign.template_id)
      .single()

    let textContent = template?.components.data
      .map((component: any) => {
        if (component.type === 'BODY') {
          return component.text
        }
      })
      .join(' ')

    if (textContent) {
      const textComponent = templatePayload?.template.components.find(
        (component: { type: string }) => component.type === 'BODY'
      )
      // Get the parameter text values into an array
      const bodyInputValues =
        textComponent?.parameters.map(
          (parameter: { text: any }) => parameter.text
        ) ?? []

      // Replace {{index}} in the text content with the parameter text with the appropriate index
      textContent = textContent.replace(/{{\d+}}/g, (match: any) => {
        const index = parseInt(match.match(/\d+/g)![0])
        return bodyInputValues[index - 1]
      })
    }

    const phoneNumberId = newPhoneNumbers.find(
      (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
    ).phone_numbers.phone_number_id

    // Look Up conversation_id
    let { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', campaignLog.contact_id)
      .eq('phone_number_id', phoneNumberId)
      .single()

    if (conversationError) {
      console.error(
        'Error finding conversation in database:',
        conversationError
      )
      return 'Error finding conversation in database'
    }

    // Add the message to the database under the table messages
    const { data: newMessage, error: messageError } = await supabase
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
          conversation_id: conversation?.id,
        },
      ])
      .select('*')
      .single()

    // Update last_message_id and updated_at in the conversation
    const { data: updatedConversation, error: updateConversationError } =
      await supabase
        .from('conversations')
        .update({
          last_message_id: newMessage?.message_id,
          updated_at: new Date(),
        })
        .eq('id', conversation?.id)

    if (updateConversationError) {
      logError(
        updateConversationError as unknown as Error,
        'Error updating conversation'
      )
      return
    }

    // Update last_contacted_by for the contact using the phone_number_id
    const { error: updateContactError } = await supabase
      .from('contacts')
      .update({
        last_contacted_by: newPhoneNumbers.find(
          (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
        ).phone_numbers.phone_number_id,
      })
      .eq('wa_id', selectedPhoneNumber)

    if (updateContactError) {
      logError(
        updateContactError as unknown as Error,
        'Error updating contact last_contacted_by'
      )
    }

    // Update the campaign log status to COMPLETED
    const { error: updateLogStatusError } = await supabase
      .from('campaign_logs')
      .update({ status: 'COMPLETED' })
      .eq('id', campaignLog.id)

    if (updateLogStatusError) {
      logError(
        updateLogStatusError as unknown as Error,
        'Error updating campaign log status'
      )
      return
    }
  } catch (error) {
    console.error('Error sending message:', error)
    logError(error as Error, 'Error sending message')

    // Update the campaign log status to FAILED
    const { error: updateLogStatusError } = await supabase
      .from('campaign_logs')
      .update({ status: 'FAILED' })
      .eq('id', campaignLog.id)

    if (updateLogStatusError) {
      logError(
        updateLogStatusError as unknown as Error,
        'Error updating campaign log status'
      )
      return
    }
  }
}

export function setupRealtimeCampaignLogProcessing() {
  const subscription = supabase
    .channel('campaign_logs')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'campaign_logs' },
      (payload) => {
        const campaignLog = payload.new as CampaignLog
        if (campaignLog.status === 'PENDING') {
          scheduleCampaignLog(campaignLog)
        } else if (campaignLog.status === 'PROCESSING') {
          // Remove from queue if already in queue
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
  const { data: campaignLogs, error } = await supabase
    .from('campaign_logs')
    .select('*')
    // Check for both PENDING and PROCESSING statuses
    .in('status', ['PENDING', 'PROCESSING'])

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
