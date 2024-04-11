import supabase from "../db/supabaseClient";
import { fetchWABAPhoneNumbersService } from "../api/whatsapp";
import { logError } from "../utils/errorLogger";
import { CronJob } from "cron";

const fetchWABAPhoneNumbers = async () => {
  const wabaIds = await supabase
    .from('whatsapp_business_accounts')
    .select('account_id, waba_id');

  if (!wabaIds) {
    console.log('No WhatsApp Business Accounts found Data:', wabaIds);
    return;
  }

  if (!wabaIds.data) {
    console.log('No WhatsApp Business Accounts found Data:', wabaIds);
    return;
  }

  for (const wabaId of wabaIds.data) {
    try {
      const { data: phoneNumbers } = await fetchWABAPhoneNumbersService(wabaId.waba_id);
      // console.log(`Phone numbers for ${wabaId.waba_id}:`, phoneNumbers);

      // Update or insert phone numbers to the database
      if (!phoneNumbers) {
        console.log('No phone numbers found. Data:', phoneNumbers);
        return;
      }

      for (const phoneNumber of phoneNumbers.data) {
        const { id, verified_name, display_phone_number, quality_rating } = phoneNumber;

        const { data: existingPhoneNumber, error } = await supabase
          .from('phone_numbers')
          .select('wa_id')
          .eq('wa_id', id)
          .single();

        if (error) {
          logError(error as unknown as Error, 'Error fetching phone number from database. Phone number ID: ' + id + '\n');
          continue;
        }

        // Format the phone number to remove the +, -, and spaces
        const number = display_phone_number.replace(/[-\s+]/g, '');
        if (existingPhoneNumber?.wa_id === id) {          
          const { error: updateError } = await supabase
            .from('phone_numbers')
            .update({
              name: verified_name,
              number,
              quality_rating
            })
            .eq('wa_id', id)
            .single();

          if (updateError) {
            logError(updateError as unknown as Error, 'Error updating phone number in database. Phone number ID: ' + id + '\n');
          }
        } else {
          const { error: insertError } = await supabase
            .from('phone_numbers')
            .insert({
              name: verified_name,
              number,
              quality_rating,
              wa_id: id,
              waba_id: wabaId.account_id
            });

          if (insertError) {
            logError(insertError as unknown as Error, 'Error inserting phone number in database. Phone number ID: ' + id + '\n');
            console.log('Error inserting phone number in database. Phone number ID: ' + id + '\n');
          }
        }
      }

    } catch (error) {
      logError(error as Error, 'Error fetching phone numbers');
    }
  }
}

export const fetchWABAPhoneNumbersJob = new CronJob('* */5 * * * *', fetchWABAPhoneNumbers); // Run every second

// Database Schema:
// phone_numbers
// - created_at: string | null
// - number: string
// - phone_number_id: number
// - quality_rating: string | null
// - waba_id: number | null

// Example Incoming Response:
// {
//   data: [
//     {
//       verified_name: 'Clinixero Support By NM',
//       code_verification_status: 'EXPIRED',
//       display_phone_number: '+60 10-317 9016',
//       quality_rating: 'UNKNOWN',      
//       platform_type: 'NOT_APPLICABLE',
//       throughput: [Object],
//       webhook_configuration: [Object],
//       id: '174921645704413'
//     }
//   ],
//   paging: {
//     cursors: {
//       before: 'QVFIUl9NQmN6Vm0wRm1rVXFyR2xWUmY4RzRsWFMyOTdLM0EzZAU1Vbk5hTEVmTkd2cTNmckpvYko4TFhtRTR5d1JPVXIZD',   
//       after: 'QVFIUl9NQmN6Vm0wRm1rVXFyR2xWUmY4RzRsWFMyOTdLM0EzZAU1Vbk5hTEVmTkd2cTNmckpvYko4TFhtRTR5d1JPVXIZD'     
//     }
//   }
// }