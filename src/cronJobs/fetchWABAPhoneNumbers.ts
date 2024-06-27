import supabase from '../db/supabaseClient'
import { fetchWABAPhoneNumbersService } from '../api/whatsapp'
import { logError } from '../utils/errorLogger'
import { CronJob } from 'cron'

const fetchWABAPhoneNumbers = async () => {
  // console.log('Fetching WABA phone numbers...')
  const wabaIds = await supabase
    .from('whatsapp_business_accounts')
    .select('*, business_managers(*)')

  if (!wabaIds) {
    console.error('No WhatsApp Business Accounts found Data:', wabaIds)
    return
  }

  if (!wabaIds.data) {
    console.error('No WhatsApp Business Accounts found Data:', wabaIds)
    return
  }

  for (const wabaId of wabaIds.data) {
    try {
      const { data: phoneNumbers } = await fetchWABAPhoneNumbersService(
        wabaId.waba_id,
        wabaId.business_managers.access_token
      )
      // console.log(`Phone numbers for ${wabaId.waba_id}:`, phoneNumbers);

      // Update or insert phone numbers to the database
      if (!phoneNumbers) {
        console.error('No phone numbers found. Data:', phoneNumbers)
        return
      }

      for (const phoneNumber of phoneNumbers.data) {
        const {
          id,
          verified_name,
          display_phone_number,
          quality_rating,
          throughput,
        } = phoneNumber

        const { data: existingPhoneNumber, error } = await supabase
          .from('phone_numbers')
          .select('wa_id')
          .eq('wa_id', id)
          .single()

        // Format the phone number to remove the +, -, and spaces
        const number = display_phone_number.replace(/[-\s+]/g, '')

        console.error(
          '(existingPhoneNumber?.wa_id === id)',
          existingPhoneNumber?.wa_id === id
        )
        if (existingPhoneNumber?.wa_id === id) {
          const { error: updateError } = await supabase
            .from('phone_numbers')
            .update({
              name: verified_name,
              number,
              quality_rating,
              throughput_level: throughput.level,
            })
            .eq('wa_id', id)
            .single()

          if (updateError) {
            logError(
              updateError as unknown as Error,
              'Error updating phone number in database. Phone number ID: ' +
                id +
                '\n'
            )
            console.error(
              'Error updating phone number in database. Phone number ID: ' +
                id +
                '\n'
            )
          }
        } else {
          const { error: insertError } = await supabase
            .from('phone_numbers')
            .insert({
              name: verified_name,
              number,
              quality_rating,
              wa_id: id,
              throughput_level: throughput.level,
              waba_id: wabaId.account_id,
            })

          if (insertError) {
            logError(
              insertError as unknown as Error,
              'Error inserting phone number in database. Phone number ID: ' +
                id +
                '\n'
            )
            console.error(
              'Error inserting phone number in database. Phone number ID: ' +
                id +
                '\n'
            )
          }
        }
      }
    } catch (error) {
      logError(error as Error, 'Error fetching phone numbers')
    }
  }
}

export const fetchWABAPhoneNumbersFunction = fetchWABAPhoneNumbers
export const fetchWABAPhoneNumbersJob = new CronJob(
  '* */30 * * * *',
  fetchWABAPhoneNumbers
) // Run every second
