// cronJobs/processCampaigns.ts
import supabase from '../../db/supabaseClient'
import { sendMessageWithTemplate } from '../../api/whatsapp'
import { logError } from '../../utils/errorLogger'
import { CronJob } from 'cron'
import { Database } from '../../database.types'

const campaignQueue: Campaign[] = []

function processQueue() {
  // console.log('Processing queue:', campaignQueue)
  if (campaignQueue.length === 0) {
    // console.log('Queue is empty, nothing to process.')
    return
  }
  const campaign = campaignQueue.shift() as Campaign
  // console.log('Processing campaign from queue:', campaign.campaign_id)
  processCampaigns(campaign)
    .catch((error) => logError(error as Error, 'Error processing campaign'))
    .finally(() => {
      // console.log('Finished processing campaign:', campaign.campaign_id)
      processQueue()
    })
}

export type Campaign = Database['public']['Tables']['campaigns']['Row'] & {
  read_count: number
}

export interface TemplateMessagePayload {
  messaging_product: string
  recipient_type: string
  to: string
  type: string
  template: any
}

const processCampaigns = async (campaign: Campaign) => {
  const { data: updatedCampaignStatus, error: updateStatusError } =
    await supabase
      .from('campaigns')
      .update({ status: 'PROCESSING' })
      .eq('campaign_id', campaign.campaign_id)

  if (updateStatusError) {
    logError(
      updateStatusError as unknown as Error,
      'Error updating campaign status'
    )
    return
  }

  let successCount = 0
  let failedCount = 0

  // Fetch contact list members by using campaign id -> contact_list_id -> contact_list_members
  const { data: contactListMembers, error: contactListMembersError } =
    await supabase
      .from('contact_list_members')
      .select('*, contacts(*)')
      .eq('contact_list_id', campaign.contact_list_id)

  if (contactListMembersError) {
    logError(
      contactListMembersError as unknown as Error,
      'Error fetching contact list members'
    )
    return
  }

  // Fetch new phone numbers by using campaign id in campaign_phone_numbers
  const { data: newPhoneNumbers, error: newPhoneNumbersError } = await supabase
    .from('campaign_phone_numbers')
    .select('*, phone_numbers(*)')
    .eq('campaign_id', campaign.campaign_id)

  if (newPhoneNumbersError) {
    logError(
      newPhoneNumbersError as unknown as Error,
      'Error fetching new phone numbers'
    )
    return
  }

  for (const contact_list_member of contactListMembers) {
    // Trim any extraneous whitespace or control characters from wa_id
    contact_list_member.contacts.wa_id =
      contact_list_member.contacts.wa_id.trim()

    console.log('Processing contact:', contact_list_member.contacts.contact_id)
    // Check wa_id if it starts with 60 for malaysian numbers
    // If not, add the missing parts it could start with 0 or 1
    if (contact_list_member.contacts.wa_id.startsWith('60')) {
      contact_list_member.contacts.wa_id =
        '' + contact_list_member.contacts.wa_id
    } else if (contact_list_member.contacts.wa_id.startsWith('1')) {
      contact_list_member.contacts.wa_id =
        '60' + contact_list_member.contacts.wa_id
    } else if (contact_list_member.contacts.wa_id.startsWith('0')) {
      contact_list_member.contacts.wa_id =
        '6' + contact_list_member.contacts.wa_id
    }

    // Ensure that there is only number present in the string ( as we have '\r' at the end for some numbers)
    contact_list_member.contacts.wa_id =
      contact_list_member.contacts.wa_id.replace(/\D/g, '')

    console.log('Sending message to:', contact_list_member.contacts.wa_id)

    let templatePayload: TemplateMessagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: contact_list_member.contacts.wa_id,
      type: 'template',
      template: campaign.template_payload as TemplateMessagePayload['template'],
    }

    // Check template payload for %name%, %date%, %time% and replace with actual values
    templatePayload.template.components.forEach((component: any) => {
      component.parameters.forEach((parameter: { text: string }) => {
        if (parameter.text) {
          parameter.text = parameter.text.replace(
            /%name%/g,
            contact_list_member.contacts.name
          )
          // parameter.text = parameter.text.replace(/%date%/g, campaign.created_at);
          // parameter.text = parameter.text.replace(/%time%/g, campaign.time);

          // Check if the parameter.text has spintax, if so, replace it with a random value
          const spintaxRegex = /{([^{}]*)}/g
          const spintaxMatch = parameter.text.match(spintaxRegex)
          if (spintaxMatch) {
            spintaxMatch.forEach((spintax: any) => {
              const options = spintax
                .substring(1, spintax.length - 1)
                .split('|')
              const randomIndex = Math.floor(Math.random() * options.length)
              parameter.text = parameter?.text?.replace(
                spintax,
                options[randomIndex]
              )
            })
          }
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
        selectedPhoneNumber
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

      // Add the message to the database under the table messages
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert([
          {
            wa_message_id: messageResponse.messages[0].id || '',
            campaign_id: campaign.campaign_id,
            phone_number_id: newPhoneNumbers.find(
              (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
            ).phone_numbers.phone_number_id,
            contact_id: contact_list_member.contacts.contact_id,
            message_type: 'TEMPLATE',
            content: textContent,
            direction: 'outgoing',
            status: messageResponse.messages.message_status || 'failed',
            project_id: campaign.project_id,
          },
        ])

      // Update last_contacted_by for the contact using the phone_number_id
      const { data: updatedContact, error: updateContactError } = await supabase
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

      // Update the status to COMPLETED
      const { data: updatedCampaign, error: updateCampaignError } =
        await supabase
          .from('campaigns')
          .update({ status: 'COMPLETED' })
          .eq('campaign_id', campaign.campaign_id)
    } catch (error) {
      console.log('Error sending message:', error)
      logError(error as Error, 'Error sending message')
    }
  }

  // Update campaign status
  const { data: updatedCampaign, error: updateError } = await supabase
    .from('campaigns')
    .update({
      status: 'COMPLETED',
      sent: successCount,
      failed: failedCount,
    })
    .eq('campaign_id', campaign.campaign_id)

  if (updateError) {
    logError(updateError as unknown as Error, 'Error updating campaign status')
    return
  }
}

export function setupRealtimeCampaignProcessing() {
  const subscription = supabase
    .channel('campaigns')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'campaigns' },
      (payload) => {
        const campaign = payload.new as Campaign
        if (campaign.status === 'PENDING') {
          scheduleCampaign(campaign)
        } else if (campaign.status === 'PROCESSING') {
          // Remove from queue if already in queue
          const index = campaignQueue.findIndex(
            (c) => c.campaign_id === campaign.campaign_id
          )
          if (index !== -1) {
            campaignQueue.splice(index, 1)
          }
        }
      }
    )
    .subscribe()

  return () => {
    subscription.unsubscribe()
  }
}

function scheduleCampaign(campaign: Campaign) {
  const currentTime = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kuala_Lumpur',
  })

  // Offset by 8 hours to match Malaysia timezone
  const currentTimeMillis = new Date(currentTime).getTime()
  const postTime = new Date(campaign.post_time).getTime()
  // console.log('Current time:', currentTime, 'Post time:', postTime)

  if (isNaN(postTime)) {
    console.error(
      'Invalid post time for campaign:',
      campaign.campaign_id,
      campaign.post_time
    )
    return
  }

  // Safeguard: Check if the campaign is already in the queue
  if (campaignQueue.some((c) => c.campaign_id === campaign.campaign_id)) {
    console.warn(`Campaign ${campaign.campaign_id} is already in the queue.`)
    return
  }

  const delay = postTime - currentTimeMillis
  console.log(
    'Scheduling campaign:',
    campaign.campaign_id,
    'in',
    delay,
    'ms (current time:',
    currentTime,
    'post time:',
    postTime,
    ')'
  )

  if (delay < 0) {
    console.warn(
      'Post time is in the past for campaign:',
      campaign.campaign_id,
      '. Adding to the queue immediately.'
    )
    campaignQueue.push(campaign)
    processQueue()
  } else {
    setTimeout(() => {
      console.log('Timeout reached for campaign:', campaign.campaign_id)
      campaignQueue.push(campaign)
      processQueue()
    }, delay)
  }
}

export const reschedulePendingCampaigns = async () => {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    // Check for both PENDING and PROCESSING statuses
    .in('status', ['PENDING', 'PROCESSING'])

  if (error) {
    logError(error as unknown as Error, 'Error fetching pending campaigns')
    return
  }

  if (!campaigns) {
    console.log('No pending campaigns found')
    return
  }

  campaigns.forEach((campaign) => {
    // console.log('=====================================')
    // console.log('Rescheduling campaign:', campaign.campaign_id)
    scheduleCampaign(campaign)
  })

  processQueue()
}
