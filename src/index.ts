import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { loggerMiddleware } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { handleWebhook } from './webhook/webhookHandler';
import dotenv from 'dotenv';
dotenv.config();
import ftgRoutes from './routes/ftgRoutes';
import { fetchImageURL, fetchMedia } from './api/whatsapp';

const app: Express = express();
const port: number = parseInt(process.env.PORT as string, 10) || 8000; // Default to 8080 if environment variable not set

// Middleware
app.use(cors()); // Enable CORS for all requests
app.use(express.json()); // Parse JSON bodies
app.use(loggerMiddleware); // Use the logger middleware for all requests

// Routes setup
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Strive Clone App Backend API' });
});

app.get("/webhook", (req, res) => { 
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === "AIErZ0xweiBhCHPvPM0oMAQ9zD89KjYg") { // Use VERIFY_TOKEN from your .env file
    res.status(200).send(challenge);
    console.log("Webhook verified successfully!");
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', handleWebhook);

app.use('/ftg', ftgRoutes);

// The error handler must be the last piece of middleware added to the app
app.use(errorHandler);

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Cron jobs
// Import and start your cron jobs here
import { campaignJob } from './cronJobs/processCampaigns';
import { fetchWABAsJob } from './cronJobs/fetchWABAs';
import { fetchTemplatesJob } from './cronJobs/fetchTemplates';
import { fetchWABAPhoneNumbersJob } from './cronJobs/fetchWABAPhoneNumbers';
import axios from 'axios';

campaignJob.start();
// fetchWABAsJob.start();
// fetchTemplatesJob.start();
// fetchWABAPhoneNumbersJob.start();


