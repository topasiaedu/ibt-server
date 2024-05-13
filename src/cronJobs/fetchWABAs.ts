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
