import supabase from '../../../db/supabaseClient'
import { logError } from '../../../utils/errorLogger'
import { PhoneNumber } from '../../../db/phoneNumbers'
import { Contact } from '../../../db/contacts'

const getWeightForRating = (rating: string) => {
  const weights: { [key: string]: number } = {
    GREEN: 6, // Higher probability for GREEN
    YELLOW: 3, // Moderate probability for YELLOW
    RED: 1, // Lower probability for RED
  }
  return weights[rating] || 1 // Default to 1 if undefined
}

export const getCampaignPhoneNumber = async (
  campaignId: number,
  contact: Contact
): Promise<{
  selectedPhoneNumber: string
  accessToken: string
  phone_number_id: number
}> => {
  // Check if contact has been contacted by a phone number
  if (contact.last_contacted_by) {
    // Fetch phone number by using phone_number_id in phone_numbers
    const { data: lastContactedPhoneNumber, error: lastContactedPhoneNumberError } =
      await supabase
        .from('phone_numbers')
        .select(
          '*,whatsapp_business_accounts(*,business_manager(*))'
        )
        .eq('wa_id', contact.last_contacted_by)

    if (lastContactedPhoneNumberError) {
      logError(
        lastContactedPhoneNumberError as unknown as Error,
        'Error fetching last contacted phone number'
      )
      console.error(
        'Error fetching last contacted phone number:',
        lastContactedPhoneNumberError
      )
      throw new Error('Error fetching last contacted phone number')
    }

    return {
      selectedPhoneNumber: lastContactedPhoneNumber[0].wa_id,
      accessToken: lastContactedPhoneNumber[0].whatsapp_business_accounts.business_manager
        .access_token,
      phone_number_id: lastContactedPhoneNumber[0].phone_number_id,
    }
  }

  // Fetch new phone numbers by using campaign id in campaign_phone_numbers
  const { data: newPhoneNumbers, error: newPhoneNumbersError } = await supabase
    .from('campaign_phone_numbers')
    .select(
      '*, phone_numbers(*,whatsapp_business_accounts(*,business_manager(*)))'
    )
    .eq('campaign_id', campaignId)

  if (newPhoneNumbersError) {
    logError(
      newPhoneNumbersError as unknown as Error,
      'Error fetching new phone numbers'
    )
    console.error('Error fetching new phone numbers:', newPhoneNumbersError)
    throw new Error('Error fetching new phone numbers')
  }

  // Create a weighted list of phone numbers
  const weightedPhoneNumbers = newPhoneNumbers.flatMap((phone: any) => {
    const weight = getWeightForRating(phone.phone_numbers.quality_rating)
    return Array(weight).fill(phone.phone_numbers.wa_id) // Fill an array with the wa_id repeated by its weight
  })

  // Random selection from the weighted list
  const randomIndex = Math.floor(Math.random() * weightedPhoneNumbers.length)
  const selectedPhoneNumber = weightedPhoneNumbers[randomIndex]

  return {
    selectedPhoneNumber,
    accessToken: newPhoneNumbers.find(
      (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
    ).phone_numbers.whatsapp_business_accounts.business_manager.access_token,
    phone_number_id: newPhoneNumbers.find(
      (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
    ).phone_number_id,
  }
}

export const getWorkflowPhoneNumber = async (
  workflowId: number,
  contact: Contact
): Promise<{
  selectedPhoneNumber: string
  accessToken: string
  phone_number_id: number
}> => {
  // Check if contact has been contacted by a phone number
  if (contact.last_contacted_by) {
    // Fetch phone number by using phone_number_id in phone_numbers
    const { data: lastContactedPhoneNumber, error: lastContactedPhoneNumberError } =
      await supabase
        .from('phone_numbers')
        .select(
          '*,whatsapp_business_accounts(*,business_manager(*))'
        )
        .eq('wa_id', contact.last_contacted_by)

    if (lastContactedPhoneNumberError) {
      logError(
        lastContactedPhoneNumberError as unknown as Error,
        'Error fetching last contacted phone number'
      )
      console.error(
        'Error fetching last contacted phone number:',
        lastContactedPhoneNumberError
      )
      throw new Error('Error fetching last contacted phone number')
    }

    return {
      selectedPhoneNumber: lastContactedPhoneNumber[0].wa_id,
      accessToken: lastContactedPhoneNumber[0].whatsapp_business_accounts.business_manager
        .access_token,
      phone_number_id: lastContactedPhoneNumber[0].phone_number_id,
    }
  }

  // Fetch new phone numbers by using workflow id in workflow_phone_numbers
  const { data: newPhoneNumbers, error: newPhoneNumbersError } = await supabase
    .from('workflow_phone_numbers')
    .select(
      '*, phone_numbers(*,whatsapp_business_accounts(*,business_manager(*)))'
    )
    .eq('workflow_id', workflowId)

  if (newPhoneNumbersError) {
    logError(
      newPhoneNumbersError as unknown as Error,
      'Error fetching new phone numbers'
    )
    console.error('Error fetching new phone numbers:', newPhoneNumbersError)
    throw new Error('Error fetching new phone numbers')
  }

  // Create a weighted list of phone numbers
  const weightedPhoneNumbers = newPhoneNumbers.flatMap((phone: any) => {
    const weight = getWeightForRating(phone.phone_numbers.quality_rating)
    return Array(weight).fill(phone.phone_numbers.wa_id) // Fill an array with the wa_id repeated by its weight
  })

  // Random selection from the weighted list
  const randomIndex = Math.floor(Math.random() * weightedPhoneNumbers.length)
  const selectedPhoneNumber = weightedPhoneNumbers[randomIndex]

  return {
    selectedPhoneNumber,
    accessToken: newPhoneNumbers.find(
      (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
    ).phone_numbers.whatsapp_business_accounts.business_manager.access_token,
    phone_number_id: newPhoneNumbers.find(
      (phone: any) => phone.phone_numbers.wa_id === selectedPhoneNumber
    ).phone_number_id,
  }
}