// webhookHandler.ts
import { Request, Response } from 'express';
import supabase from '../db/supabaseClient';

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const data = req.body;

    // Assuming 'messages' and 'statuses' are top-level keys in the webhook payload
    // Handle incoming text messages
    if (data.messages) {
      await handleMessages(data.messages);
    }

    // Handle message status updates
    if (data.statuses) {
      await handleMessageStatuses(data.statuses);
    }

    // Assuming a structure for quality rating updates (this is hypothetical and needs to match the actual payload structure you receive)
    if (data.quality_rating_updates) {
      await handleQualityRatingUpdates(data.quality_rating_updates);
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};

async function handleMessages(messages: any[]) {
  for (const message of messages) {
    if (message.type === 'text') {
      await insertTextMessage(message);
    }
    // Extend this as needed to handle other message types
  }
}

async function handleMessageStatuses(statuses: any[]) {
  for (const status of statuses) {
    await updateMessageStatus(status);
  }
}

async function handleQualityRatingUpdates(updates: any[]) {
  for (const update of updates) {
    await updateQualityRating(update);
  }
}

async function insertTextMessage(message: any) {
  const { error } = await supabase
    .from('messages')
    .insert([
      {
        user_id: 'specify_your_user_id', // Placeholder, adjust as needed
        phone_number_id: message.from, // Example mapping, adjust according to your schema
        contact_id: message.to, // Example mapping, adjust according to your schema
        direction: 'inbound', // Example value, adjust as needed
        message_type: message.type,
        content: message.text.body,
        status: 'received', // Example status, adjust according to your schema
        timestamp: new Date(message.timestamp * 1000) // Convert timestamp to JavaScript Date object
      }
    ]);

  if (error) console.error('Error inserting text message:', error);
}

async function updateMessageStatus(status: any) {
  const { error } = await supabase
    .from('message_status_updates')
    .insert([
      {
        message_id: status.id, // Adjust based on your schema
        status: status.status,
        error_code: status.error_code || null, // Assuming 'error_code' might be part of the status update payload
        timestamp: new Date(status.timestamp * 1000) // Adjust timestamp format
      }
    ]);

  if (error) console.error('Error updating message status:', error);
}

async function updateQualityRating(update: any) {
  const { error } = await supabase
    .from('quality_metrics')
    .upsert({
      phone_number_id: update.phone_number_id,
      delivered_count: update.delivered_count, // Assuming these fields based on your requirements
      read_count: update.read_count,
      user_feedback: update.user_feedback,
      timestamp: new Date() // Current timestamp
    }, { onConflict: 'phone_number_id' });

  if (error) console.error('Error updating quality rating:', error);
}
