import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { loggerMiddleware } from './src/middleware/logger';
import { errorHandler } from './src/middleware/errorHandler';
import { handleWebhook } from './src/webhook/webhookHandler';

const app: Express = express();

// Middleware
app.use(cors()); // Enable CORS for all requests
app.use(express.json()); // Parse JSON bodies
app.use(loggerMiddleware); // Use the logger middleware for all requests

// Routes setup
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Strive Clone App Backend API' });
});

// accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // check the mode and token sent are correct
  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    // respond with 200 OK and challenge token from the request
    res.status(200).send(challenge);
    console.log("Webhook verified successfully!");
  } else {
    // respond with '403 Forbidden' if verify tokens do not match
    res.sendStatus(403);
  }
});


app.post('/webhook', handleWebhook);

// The error handler must be the last piece of middleware added to the app
app.use(errorHandler);

export default app;
