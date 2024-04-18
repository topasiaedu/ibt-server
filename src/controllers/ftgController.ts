import { Request, Response } from 'express';
import findOrCreateContact from '../webhook/helpers/findOrCreateContact';
import { logError } from '../utils/errorLogger';
import { TemplateMessagePayload } from '../models/whatsapp/templateTypes';
import { sendMessageWithTemplate } from '../api/whatsapp';

export const ftgTemplate = (req: Request, res: Response) => { 
  const { template_payload, name, phone } = req.body;

  findOrCreateContact({ wa_id: phone, profile: { name } })
    .then((contact) => {
      let templatePayload: TemplateMessagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'template',
        template: template_payload,
      };

      // Check template payload for %name% and replace with actual value
      templatePayload.template.components.forEach((component) => {
        component.parameters.forEach((parameter) => {
          if (parameter.text) {
            parameter.text = parameter.text.replace(/%name%/g, name);
          }
        });
      });

      sendMessageWithTemplate(templatePayload, phone)
        .then((response) => {
          res.json({ message: 'Template message sent successfully', response });
        })
        .catch((error) => {
          logError(error, 'Error sending template message');
          res.status(500).json({ message: 'Error sending template message', error });
        });          

    })
    .catch((error) => {
      logError(error, 'Error finding or creating contact');
      res.status(500).json({ message: 'Error finding or creating contact', error });
    });
}

export const ftgText = (req: Request, res: Response) => {
  res.json({ message: 'FTG Text' });
}

export const ftgImage = (req: Request, res: Response) => {
  res.json({ message: 'FTG Image' });
}