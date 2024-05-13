import supabase from '../../db/supabaseClient';
import { logError } from '../../utils/errorLogger';
import insertTextMessage from '../helpers/insertTextMessage';
import insertImageMessage from '../helpers/insertImageMessage';
import insertVideoMessage from '../helpers/insertVideoMessage';
import insertButtonMessage from '../helpers/insertButtonMessage';
import findOrCreateContact from '../helpers/findOrCreateContact';
import insertStickerMessage from '../helpers/insertStickerMessage';

const handleMessages = async (value: any) => {
  try {
    // Check if its Outgoing or Incoming message
    if (value?.statuses) {
      return handleOutgoingMessage(value);
    } else {
      return handleIncomingMessage(value);
    }
  } catch (error) {
    logError(error as Error, 'Error handling messages. Data: ' + JSON.stringify(value, null, 2) + '\n');
    return 'Error handling messages';
  }
};

const handleOutgoingMessage = async (value: any) => {
  // console.log('Outgoing message:', JSON.stringify(value, null, 2));
  try {
    const { statuses } = value

    statuses.forEach(async (status: any) => {
      if (status.conversation) {

        if (status.status === 'sent') { status.status = 'READ' }
        // Update the message status in the database using id
        let { error: updateError } = await supabase
          .from('messages')
          .update({ status: status.status })
          .eq('wa_message_id', status.id)

        if (updateError) {
          logError(updateError as unknown as Error, 'Error updating outgoing message status in database. Data: ' + JSON.stringify(value, null, 2) + '\n Error: ' + JSON.stringify(updateError, null, 2));
        }

        // {
        //   "id": "wamid.HBgLNjAxMzc1NjE1MDAVAgARGBJEQzM2RUEyODRDMzRFODYzODUA",   
        //   "status": "sent",
        //   "timestamp": "1714985417",
        //   "recipient_id": "60137561500",
        //   "conversation": {
        //     "id": "d882a52951dbc2a52d89e2d4a80ac9eb",
        //     "expiration_timestamp": "1715071860",
        //     "origin": {
        //       "type": "marketing"
        //     }
        //   },
        //   "pricing": {
        //     "billable": true,
        //     "pricing_model": "CBP",
        //     "category": "marketing"
        //   }
        // }
        if (status.conversation.expiration_timestamp) {
          let { data: existingMessageWindow, error: findError } = await supabase
            .from('message_window')
            .select('conversation_id')
            .eq('conversation_id', status.conversation.id)
            .single();

          if (existingMessageWindow?.conversation_id === status.conversation.id) {
            return 'Message already exists in the database';
          }

          if (findError) {
            // lookup database for the phone number id and contact id
            const { data: message, error: messageError } = await supabase
              .from('messages')
              .select('phone_number_id, contact_id')
              .eq('wa_message_id', status.id)
              .single();

            if (messageError) {
              logError(messageError as unknown as Error, 'Error finding message in database. Data: ' + JSON.stringify(value, null, 2) + '\n Error: ' + JSON.stringify(messageError, null, 2));
            }

            // insert the message window
            let { error: insertError } = await supabase
              .from('message_window')
              .insert([{
                phone_number_id: message?.phone_number_id,
                contact_id: message?.contact_id,
                conversation_id: status.conversation.id,
                close_at: status.conversation.expiration_timestamp,
                origin: status.conversation.origin.type,
                updated_at: new Date().toISOString()
              }]);
          }
        }

        // Check the database if message_window exists by using the conversation_id
        // let { data: existingMessageWindow, error: findError } = await supabase
        //   .from('message_window')
        //   .select('conversation_id')
        //   .eq('conversation_id', status.conversation.id)
        //   .single();

        // if (existingMessageWindow?.conversation_id === status.conversation.id) {
        //   return 'Message already exists in the database';
        // }      

      }
    });
  } catch (error) {
    logError(error as Error, 'Error processing outgoing messages. Data: ' + JSON.stringify(value, null, 2) + '\n Error: ' + error);
    return 'Error processing messages';
  }
}


const handleIncomingMessage = async (value: any) => {
  // console.log('Incoming message:', JSON.stringify(value, null, 2));
  try {
    // Assuming the structure of the incoming payload matches your example
    const { metadata, contacts, messages } = value;
    const { display_phone_number, phone_number_id } = metadata;

    // Based on phone number id, find the phone number in the database in which we use to find the project id
    const { data: phoneNumber, error: phoneError } = await supabase
      .from('phone_numbers')
      .select('waba_id')
      .eq('wa_id', phone_number_id)
      .single();

    if (phoneError) {
      console.error('Error finding phone number in database:', phone_number_id);
      throw phoneError;
    }

    if (!phoneNumber) {
      throw new Error('Phone number not found in database');
    }

    const WABA_ID = phoneNumber.waba_id;

    // Find the project id using the WABA ID
    const { data: project, error: projectError } = await supabase
      .from('whatsapp_business_accounts')
      .select('project_id')
      .eq('account_id', WABA_ID)
      .single();

    if (projectError) {
      console.error('Error finding project in database:', projectError);
      throw projectError;
    }

    if (!project) {
      logError(new Error('Project not found in database'), 'Project not found in database');
      throw new Error('Project not found in database');
    }

    contacts.forEach(async (contact: any) => {
      await findOrCreateContact(contact, project.project_id);
    });


    messages.forEach(async (message: any) => {
      const { type } = message;

      switch (type) {
        case 'text':
          await insertTextMessage(message, display_phone_number, project.project_id);
          break;
        case 'image':
          await insertImageMessage(message, display_phone_number, project.project_id);
          break;
        case 'video':
          await insertVideoMessage(message, display_phone_number, project.project_id);
          break;
        case 'button':
          await insertButtonMessage(message, display_phone_number, project.project_id);
          break;
        case 'sticker':
          await insertStickerMessage(message, display_phone_number, project.project_id);
          break;
        default:
          console.log('Unsupported message type:', type);
      }

    });

    return 'Messages processed successfully';
  } catch (error) {
    logError(error as Error, 'Error processing inbound messages. Data: ' + JSON.stringify(value, null, 2) + '\n Error: ' + error);
    return 'Error processing messages';
  }
}


export default handleMessages;
