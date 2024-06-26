import supabase from '../db/supabaseClient'
import { fetchTemplatesService } from '../api/whatsapp'
import { logError } from '../utils/errorLogger'
import { CronJob } from 'cron'

const fetchTemplates = async () => {
  // console.log('Fetching templates...')
  const wabaIds = await supabase
    .from('whatsapp_business_accounts')
    .select('*,business_manager(*)')
  // console.log('WABA IDs:', wabaIds)

  if (!wabaIds) {
    console.error('No WhatsApp Business Accounts found')
    return
  }

  if (!wabaIds.data) {
    console.error('No WhatsApp Business Accounts found')
    return
  }

  for (const wabaId of wabaIds.data) {
    const { data: templates } = await fetchTemplatesService(
      wabaId.waba_id,
      wabaId.business_manager.access_token
    )
    if (!templates) {
      console.error('No templates found for WABA ID: ' + wabaId)
      continue
    }

    for (const template of templates.data) {
      const { id } = template

      const { data: existingTemplate, error } = await supabase
        .from('templates')
        .select('wa_template_id')
        .eq('wa_template_id', id)
        .single()
      if (existingTemplate && existingTemplate.wa_template_id === id) {
        const { name, language, status, category } = template
        // Template Table
        const { data: updatedTemplate, error: updateError } = await supabase
          .from('templates')
          .update({
            name,
            language,
            status,
            category,
            account_id: wabaId.account_id,
            components: {
              data: template.components,
            },
          })
          .eq('wa_template_id', id)
          .single()

        if (updateError) {
          logError(
            updateError as unknown as Error,
            'Error updating template in database. Template ID: ' + id + '\n'
          )
          console.error(
            'Error updating template in database. Template ID: ' + id + '\n'
          )
          console.error(JSON.stringify(updateError, null, 2))
        }
      } else {
        const { name, language, status, category } = template

        const { data: newTemplate, error: insertError } = await supabase
          .from('templates')
          .insert({
            name,
            language,
            status,
            category,
            wa_template_id: id,
            account_id: wabaId.account_id,
            components: {
              data: template.components,
            },
          })

        if (insertError) {
          logError(
            insertError as unknown as Error,
            'Error inserting template in database. Template ID: ' + id + '\n'
          )
          console.error(
            'Error inserting template in database. Template ID: ' + id + '\n'
          )
          continue
        }
      }
    }
  }
}

export const fetchTemplatesFunction = fetchTemplates
export const fetchTemplatesJob = new CronJob('* */30 * * * *', fetchTemplates) // Run every second
