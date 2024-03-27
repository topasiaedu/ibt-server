// /src/webhook/messageWebhook.ts
import { Router } from 'express';
import supabase from '../db/supabaseClient';

const router = Router();

router.post('/', async (req, res) => {
  const messageEvents = req.body.entry[0].changes[0].value.messages;

  if (messageEvents) {
    for (const messageEvent of messageEvents) {
      if (messageEvent.type === 'text') {
        console.log('Received text message:', messageEvent.text.body);
        await saveMessageToDatabase(messageEvent);
      }
    }
  }

  res.status(200).send('EVENT_RECEIVED');
});

async function saveMessageToDatabase(messageEvent: any) { // Adjust the type based on your message structure
  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        sender_id: messageEvent.from,
        message_content: messageEvent.text.body,
      },
    ]);

  if (error) console.error('Error saving message:', error);
  else console.log('Saved message:', data);
}

export default router;
