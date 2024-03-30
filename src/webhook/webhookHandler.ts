// webhookHandler.ts
import { Request, Response } from 'express';
import handleAccountAlerts  from './events/account_alerts';
import handleAccountReviewUpdate from './events/account_review_update';
import handleAccountUpdate from './events/account_update';
import handleBusinessCapabilityUpdate from './events/business_capability_update';
import handleBusinessStatusUpdate from './events/business_status_update';
import handleCampaignStatusUpdate from './events/campaign_status_update';
import handleFlows from './events/flows';
import handleMessageEchoes from './events/message_echoes';
import handleMessageTemplateQualityUpdate from './events/message_template_quality_update';
import handleMessageTemplateStatusUpdate from './events/message_template_status_update';
import handleMessages from './events/messages';
import handleMessagingHandovers from './events/messaging_handovers';
import handlePhoneNumberNameUpdate from './events/phone_number_name_update';
import handlePhoneNumberQualityUpdate from './events/phone_number_quality_update';
import handleSecurity from './events/security';
import handleTemplateCategoryUpdate from './events/template_category_update';


export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const event = req.body.field;

    switch (event) {
      case 'account_alerts':
          handleAccountAlerts(req, res);
          break;
      case 'account_review_update':
          handleAccountReviewUpdate(req, res);
          break;
      case 'account_update':
          handleAccountUpdate(req, res);
          break;
      case 'business_capability_update':
          handleBusinessCapabilityUpdate(req, res);
          break;
      case 'business_status_update':
          handleBusinessStatusUpdate(req, res);
          break;
      case 'campaign_status_update':
          handleCampaignStatusUpdate(req, res);
          break;
      case 'flows':
          handleFlows(req, res);
          break;
      case 'message_echoes':
          handleMessageEchoes(req, res);
          break;
      case 'message_template_quality_update':
          handleMessageTemplateQualityUpdate(req, res);
          break;
      case 'message_template_status_update':
          handleMessageTemplateStatusUpdate(req, res);
          break;
      case 'messages':
          handleMessages(req, res);
          break;
      case 'messaging_handovers':
          handleMessagingHandovers(req, res);
          break;
      case 'phone_number_name_update':
          handlePhoneNumberNameUpdate(req, res);
          break;
      case 'phone_number_quality_update':
          handlePhoneNumberQualityUpdate(req, res);
          break;
      case 'security':
          handleSecurity(req, res);
          break;
      case 'template_category_update':
          handleTemplateCategoryUpdate(req, res);
          break;
      default:
          // Handle unknown event type
          console.log('Unknown event type', event.type, event.details);
  }
  
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};