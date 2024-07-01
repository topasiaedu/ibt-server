// cronJobs/processCampaigns.ts
import supabase from '../../db/supabaseClient'
import { sendMessageWithTemplate } from '../../api/whatsapp'
import { logError } from '../../utils/errorLogger'
import { CronJob } from 'cron'
import { Database } from '../../database.types'

const campaignQueue: Campaign[] = []

function processQueue() {
  if (campaignQueue.length === 0) {
    return
  }
  const campaign = campaignQueue.shift() as Campaign
  processCampaigns(campaign)
    .catch((error) => logError(error as Error, 'Error processing campaign'))
    .finally(() => {
      processQueue()
    })
}

export type Campaign = Database['public']['Tables']['campaigns']['Row'] & {
  read_count: number
}

export type CampaignList = Database['public']['Tables']['campaign_lists']['Row']
export type CampaignLogsInsert =
  Database['public']['Tables']['campaign_logs']['Insert']

export interface TemplateMessagePayload {
  messaging_product: string
  recipient_type: string
  to: string
  type: string
  template: any
}

const processCampaigns = async (campaign: Campaign) => {
  console.log('Processing campaign:', campaign.campaign_id)

  try {
    const { error: updateStatusError } = await supabase
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

    // Fetch Campaign List
    const { data: campaignLists, error: campaignListError } = await supabase
      .from('campaign_lists')
      .select('*')
      .eq('campaign_id', campaign.campaign_id)

    if (campaignListError) {
      logError(
        campaignListError as unknown as Error,
        'Error fetching campaign list'
      )
      return
    }

    if (!campaignLists) {
      console.error(
        'No campaign list found for campaign:',
        campaign.campaign_id
      )
      return
    }

    console.log('Campaign lists:', campaignLists)

    // Generate campaign logs
    let campaignLogs: CampaignLogsInsert[] = []

    // Process includes
    const includePromises = campaignLists.map(async (campaignList) => {
      switch (campaignList.type) {
        case 'include-list':
          const { data: contactListMembers, error: contactListMembersError } =
            await supabase
              .from('contact_list_members')
              .select('contact_id')
              .eq('contact_list_id', campaignList.contact_list_id)

          if (contactListMembersError) {
            logError(
              contactListMembersError as unknown as Error,
              'Error fetching contact list members'
            )
            return []
          }

          if (!contactListMembers) {
            console.error(
              'No contact list members found for list:',
              campaignList.list_id
            )
            return []
          }

          return contactListMembers.map((contact) => ({
            campaign_id: campaign.campaign_id,
            contact_id: contact.contact_id,
            status: 'PENDING',
          }))

        case 'include-contact':
          return [
            {
              campaign_id: campaign.campaign_id,
              contact_id: campaignList.contact_id,
              status: 'PENDING',
            },
          ]

        default:
          return []
      }
    })

    // Wait for all include operations to complete
    const includeResults = await Promise.all(includePromises)
    includeResults.forEach((result) => {
      campaignLogs.push(...result)
    })

    // Process excludes
    const excludePromises = campaignLists.map(async (campaignList) => {
      switch (campaignList.type) {
        case 'exclude-list':
          const { data: excludedContactListMembers, error: excludedError } =
            await supabase
              .from('contact_list_members')
              .select('contact_id')
              .eq('list_id', campaignList.contact_list_id)

          if (excludedError) {
            logError(
              excludedError as unknown as Error,
              'Error fetching excluded contact list members'
            )
            return []
          }

          if (!excludedContactListMembers) {
            console.error(
              'No excluded contact list members found for list:',
              campaignList.list_id
            )
            return []
          }

          const excludedContactIds = excludedContactListMembers.map(
            (contact) => contact.contact_id
          )

          return excludedContactIds

        case 'exclude-contact':
          return [campaignList.contact_id]

        default:
          return []
      }
    })

    // Wait for all exclude operations to complete
    const excludeResults = await Promise.all(excludePromises)
    const excludedContactIds = excludeResults.flat()

    console.log('Excluded contact IDs:', excludedContactIds)
    console.log('Campaign logs:', campaignLogs)
    // Remove excluded contacts from campaign logs
    campaignLogs = campaignLogs.filter(
      (log) => !excludedContactIds.includes(log.contact_id)
    )

    // Insert campaign logs into the database
    if (campaignLogs.length > 0) {
      const { error: insertError } = await supabase
        .from('campaign_logs')
        .insert(campaignLogs)

      if (insertError) {
        logError(
          insertError as unknown as Error,
          'Error inserting campaign logs'
        )
        return
      }
    }

    // Update campaign status
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'COMPLETED',
      })
      .eq('campaign_id', campaign.campaign_id)

    if (updateError) {
      logError(
        updateError as unknown as Error,
        'Error updating campaign status'
      )
      return
    }
  } catch (error) {
    logError(error as Error, 'Error processing campaign')
    console.error('Error processing campaign:', campaign.campaign_id)
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
      console.error('Timeout reached for campaign:', campaign.campaign_id)
      campaignQueue.push(campaign)
      processQueue()
    }, delay)
  }
}

export const reschedulePendingCampaigns = async () => {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .in('status', ['PENDING', 'PROCESSING'])

  if (error) {
    logError(error as unknown as Error, 'Error fetching pending campaigns')
    return
  }

  if (!campaigns) {
    console.error('No pending campaigns found')
    return
  }

  campaigns.forEach((campaign) => {
    scheduleCampaign(campaign)
  })

  processQueue()
}
