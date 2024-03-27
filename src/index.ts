// /src/index.ts
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import messageWebhook from './webhook/messageWebhook';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Register webhook router
app.use('/webhook', messageWebhook);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
