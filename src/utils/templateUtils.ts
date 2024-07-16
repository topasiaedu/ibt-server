import { Campaign } from '../db/campaigns'
import { Template } from '../db/templates'

export interface TemplateMessagePayload {
  messaging_product: string
  recipient_type: string
  to: string
  type: string
  template: any
}

export const processTemplatePayload = (campaign: Campaign, contact: any) => {
  let processedPayload: TemplateMessagePayload = JSON.parse(
    JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: contact.wa_id,
      type: 'template',
      template: campaign.template_payload as TemplateMessagePayload['template'],
    })
  )

  let mediaUrl = ''

  processedPayload.template.components.forEach((component: any) => {
    component.parameters.forEach((parameter: any) => {
      if (parameter.text) {
        parameter.text = parameter.text.replace(/%name%/g, contact.name)
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

  return {
    processedPayload,
    mediaUrl,
  }
}

export const generateMessageContent = (
  template: any,
  processedPayload: any
) => {
  let textContent = template.components.data
    .map((component: any) => {
      if (component.type === 'BODY') {
        return component.text
      }
    })
    .join(' ')

  if (textContent) {
    const textComponent = processedPayload?.template.components.find(
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

  return textContent
}
