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
  try {
    const { statuses } = value.changes[0].value;

    statuses.forEach(async (status: any) => {
      if (!status.conversation) {
        // Check the database if message_window exists by using the conversation_id
        let { data: existingMessage, error: findError } = await supabase
          .from('message_windows')
          .select('conversation_id')
          .eq('conversation_id', status.conversation.id)
          .single();

        if (existingMessage?.conversation_id === status.conversation.id) {
          return 'Message already exists in the database';
        }

        // Change timestamp to DateTime format
        const date = new Date(parseInt(status.timestamp) * 1000);
        const formattedDate = date.toISOString();

        // Insert the message into the database
        let { data: newMessage, error: messageError } = await supabase
          .from('message_windows')
          .insert([{ conversation_id: status.conversation.id, status: status.status, timestamp: formattedDate }])
          .single();


        if (messageError) {
          logError(messageError as unknown as Error, 'Error inserting outgoing message window into database. Data: ' + JSON.stringify(value, null, 2) + '\n Error: ' + messageError);
        }
      }

      // Update the message status in the database using id
      let { data: updatedMessage, error: updateError } = await supabase
        .from('messages')
        .update({ status: status.status })
        .eq('wa_message_id', status.id)
        .single();

      if (updateError) {
        logError(updateError as unknown as Error, 'Error updating outgoing message status in database. Data: ' + JSON.stringify(value, null, 2) + '\n Error: ' + updateError);
      }

    });
  } catch (error) {
    logError(error as Error, 'Error processing outgoing messages. Data: ' + JSON.stringify(value, null, 2) + '\n Error: ' + error);
    return 'Error processing messages';
  }
}


const handleIncomingMessage = async (value: any) => {
  console.log('Incoming message:', JSON.stringify(value, null, 2));
  try {
    // Assuming the structure of the incoming payload matches your example
    const { metadata, contacts, messages } = value;
    const { display_phone_number, phone_number_id } = metadata;

    contacts.forEach(async (contact: any) => {
      await findOrCreateContact(contact);
    });

    messages.forEach(async (message: any) => {
      const { type } = message;

      switch (type) {
        case 'text':
          await insertTextMessage(message, display_phone_number);
          break;
        case 'image':
          await insertImageMessage(message, display_phone_number);
          break;
        case 'video':
          await insertVideoMessage(message, display_phone_number);
          break;
        case 'button':
          await insertButtonMessage(message, display_phone_number);
        case 'sticker':
          await insertStickerMessage(message, display_phone_number);
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
