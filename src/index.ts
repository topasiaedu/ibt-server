import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { loggerMiddleware } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { handleWebhook } from './webhook/webhookHandler';
import dotenv from 'dotenv';
dotenv.config();

const app: Express = express();
const port: number = parseInt(process.env.PORT as string, 10) || 3000; // Default to 3000 if environment variable not set

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

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) { // Use VERIFY_TOKEN from your .env file
    res.status(200).send(challenge);
    console.log("Webhook verified successfully!");
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', handleWebhook);

// The error handler must be the last piece of middleware added to the app
app.use(errorHandler);

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
