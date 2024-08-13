import { CronJob } from 'cron'
import { CampaignList, fetchCampaignList } from '../../db/campaignLists'
import { CampaignLogsInsert, insertCampaignLogs } from '../../db/campaignLogs'
import { Campaign, updateCampaignStatus } from '../../db/campaigns'
import {
  ContactListMembers,
  fetchContactListMembers,
} from '../../db/contactListMembers'
import supabase from '../../db/supabaseClient'
import { logError } from '../../utils/errorLogger'
import { withRetry } from '../../utils/withRetry'

const campaignQueue: Campaign[] = []

const CONCURRENCY_LIMIT = 5
let activeProcesses = 0

function processQueue() {
  if (campaignQueue.length === 0 || activeProcesses >= CONCURRENCY_LIMIT) {
    return
  }
  activeProcesses++
  const campaign = campaignQueue.shift() as Campaign
  processCampaigns(campaign)
    .catch((error) => logError(error as Error, 'Error processing campaign'))
    .finally(() => {
      activeProcesses--
      processQueue()
    })
}

const processCampaigns = async (campaign: Campaign) => {
  try {
    await withRetry(() =>
      updateCampaignStatus(campaign.campaign_id, 'PROCESSING')
    , 'processCampaigns > updateCampaignStatus')

    // Fetch Campaign List
    const campaignLists: CampaignList[] = await withRetry(() =>
      fetchCampaignList(campaign.campaign_id), 'processCampaigns > fetchCampaignList'
    )

    if (!campaignLists) {
      console.error(
        'No campaign list found for campaign:',
        campaign.campaign_id
      )
      return
    }

    // Generate campaign logs
    let campaignLogs: CampaignLogsInsert[] = []

    // Process includes
    const includePromises = campaignLists.map(async (campaignList) => {
      switch (campaignList.type) {
        case 'include-list':
          if (!campaignList.contact_list_id) {
            console.error('No contact list id found for list:', campaignList.id)
            return []
          }

          const contactListMembers: ContactListMembers[] = await withRetry(() =>
            fetchContactListMembers(campaignList.contact_list_id || 0), 'processCampaigns > fetchContactListMembers'
          )

          if (!contactListMembers) {
            console.error(
              'No contact list members found for list:',
              campaignList.id
            )
            return []
          }

          return contactListMembers.map((contactListMember) => ({
            campaign_id: campaign.campaign_id,
            contact_id: contactListMember.contact_id,
            status: 'PENDING',
          }))

        case 'include-contact':
          if (!campaignList.contact_id) {
            console.error('No contact id found for list:', campaignList.id)
            return []
          }
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
          if (!campaignList.contact_list_id) {
            console.error('No contact list id found for list:', campaignList.id)
            return []
          }

          const excludedContactListMembers: ContactListMembers[] =
            await withRetry(() =>
              fetchContactListMembers(campaignList.contact_list_id || 0) , 'processCampaigns > fetchContactListMembers'
            )
          if (!excludedContactListMembers) {
            console.error(
              'No excluded contact list members found for list:',
              campaignList.id
            )
            return []
          }
          return excludedContactListMembers.map((contact) => contact.contact_id)

        case 'exclude-contact':
          if (!campaignList.contact_id) {
            console.error('No contact id found for list:', campaignList.id)
            return []
          }
          return [campaignList.contact_id]

        default:
          return []
      }
    })

    // Wait for all exclude operations to complete
    const excludeResults = await Promise.all(excludePromises)
    const excludedContactIds = excludeResults.flat()

    // Remove excluded contacts from campaign logs
    campaignLogs = campaignLogs.filter(
      (log) => !excludedContactIds.includes(log.contact_id)
    )

    // Insert campaign logs into the database
    if (campaignLogs.length > 0) {
      await withRetry(() => insertCampaignLogs(campaignLogs), 'processCampaigns > insertCampaignLogs')
    }

    // Update campaign status
    await withRetry(() =>
      updateCampaignStatus(campaign.campaign_id, 'COMPLETED'), 'processCampaigns > updateCampaignStatus'
    )
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

  const job = new CronJob(new Date(postTime), () => {
    console.log('Cron job triggered for campaign:', campaign.campaign_id)
    campaignQueue.push(campaign)
    processQueue()
  })

  job.start()
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
