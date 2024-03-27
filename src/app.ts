import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { loggerMiddleware } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';

// Import routes
// Example: import messageRoutes from './routes/messageRoutes';

const app: Express = express();

// Middleware
app.use(cors()); // Enable CORS for all requests
app.use(express.json()); // Parse JSON bodies
app.use(loggerMiddleware); // Use the logger middleware for all requests

// Routes setup
// Example: app.use('/api/messages', messageRoutes);
// Placeholder route for initial setup
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Strive Clone App Backend API' });
});

// Future route examples based on provided project scope
// app.use('/api/conversations', conversationRoutes);
// app.use('/api/email', emailRoutes);

// The error handler must be the last piece of middleware added to the app
app.use(errorHandler);

export default app;
