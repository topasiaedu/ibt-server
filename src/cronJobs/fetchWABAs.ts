import supabase from '../db/supabaseClient';
import { fetchWABAsService } from '../api/whatsapp';
import { logError } from '../utils/errorLogger';
import { CronJob } from 'cron';

const fetchWABAs = async () => {
  const { data: wabas } = await fetchWABAsService();

  if (!wabas) {
    console.log('No WABAs found');
    return;
  }

  // Check if the WABA exists in the database using the id against waba_id
  // If it exists, update the record
  // If it doesn't exist, insert the record
  for (const waba of wabas.data) {
    const { id, name, timezone_id, message_template_namespace, currency } = waba;

    const { data: existingWABA, error } = await supabase
      .from('whatsapp_business_accounts')
      .select('waba_id')
      .eq('waba_id', id)
      .single();

    if (error) {
      logError(error as unknown as Error, 'Error fetching WABA from database. WABA ID: ' + id + '\n');
      continue;
    }

    if (existingWABA?.waba_id === id) {
      const { data: updatedWABA, error: updateError } = await supabase
        .from('whatsapp_business_accounts')
        .update({
          name,
          timezone_id,
          message_template_namespace,
          currency
        })
        .eq('waba_id', id)
        .single();

      if (updateError) {
        logError(updateError as unknown as Error, 'Error updating WABA in database. WABA ID: ' + id + '\n');
      }
    } else {
      const { data: newWABA, error: insertError } = await supabase
        .from('whatsapp_business_accounts')
        .insert({
          waba_id: id,
          name,
          timezone_id,
          message_template_namespace,
          currency
        });
        
      if (insertError) {
        logError(insertError as unknown as Error, 'Error inserting WABA in database. WABA ID: ' + id + '\n');
        console.log('Error inserting WABA in database. WABA ID: ' + id + '\n');
      }
    }
  }
}

export const fetchWABAsJob = new CronJob('* */5 * * * *', fetchWABAs); // Run every second

// Database Schema:
// whatsapp_business_accounts
// - account_id: number
// - created_at: string | null
// - currency: string | null
// - message_template_namespace: string | null
// - name: string | null
// - timezone_id: string | null
// - updated_at: string | null
// - waba_id: string

// Example Incoming Response:
// {
//   data: [
//     {
//       id: '283388954854392',
//       name: 'Clinixero Academy Support',
//       timezone_id: '42',
//       message_template_namespace: '2f9c73a7_6733_42ee_af48_de59c961e13d'
//     },
//     {
//       id: '278010752057306',
//       name: 'Clinixero Academy',
//       currency: 'USD',
//       timezone_id: '95',
//       message_template_namespace: '68a01041_2476_4665_9c2c_f8aa6d47ef80'
//     },
//     {
//       id: '209964115544791',
//       name: 'Jeii Pong Support',
//       currency: 'USD',
//       timezone_id: '95',
//       message_template_namespace: 'f6ebdf50_cf07_4bc6_91bc_126cfa3c80b5'
//     },
//     {
//       id: '262869723570786',
//       name: 'Clinixero',
//       currency: 'USD',
//       timezone_id: '95',
//       message_template_namespace: 'e60e9124_9758_4a84_8f1f_15a303a0a64b'
//     },
//     {
//       id: '199640063238604',
//       name: 'Pemni Support by NM',
//       currency: 'USD',
//       timezone_id: '95',
//       message_template_namespace: '82893c35_9ede_4898_a55b_2b11d399479c'
//     },
//     {
//       id: '221306414394634',
//       name: 'Spark Support by NM',
//       currency: 'USD',
//       timezone_id: '95',
//       message_template_namespace: 'f803065f_d753_4d84_809e_3ebc880215ff'
//     },
//     {
//       id: '103057586059372',
//       name: 'Clinixero Support',
//       currency: 'USD',
//       timezone_id: '95',
//       message_template_namespace: 'a94f7ff8_3e05_49d6_87e1_d94955e4f187'
//     },
//     {
//       id: '103577659231763',
//       name: 'NM Academy',
//       currency: 'USD',
//       timezone_id: '95',
//       message_template_namespace: 'c603c14c_6f01_4ed1_aa0a_8b9c5841383b'
//     },
//     {
//       id: '111598888416661',
//       name: 'Test WhatsApp Business Account',
//       timezone_id: '1',
//       message_template_namespace: 'a2eab987_b87b_4c58_b175_2e071a3029cd'
//     }
//   ],
//   paging: {
//     cursors: {
//       before: 'QVFIUks1NVI0bzJrYXZAzakwyR3RsbURoX3p4bllQdnRMVkY2VTJRU3pRd2tPMGxvcHJQNktyQm5xRXRWN3ZAhQ3VoRWNKcm9UcldIcC15RGJEdkY1OVRNdWVn',
//       after: 'QVFIUm5RLTRDdTRQWkM5LTcwTkdZAajd0V2JoZATE1Wlo1N3I4NWZAPOHJuSVRFU0lGS3lmeXgyQ3hmRDVWREZAUWUV6VDByODlVS19FeUZALcjFNcGctZA3pSWHV3'
//     }
//   }
// }