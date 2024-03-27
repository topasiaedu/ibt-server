import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const logFilePath = path.join(__dirname, 'logs.txt');

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const logEntry = `${new Date().toISOString()} - ${req.method} ${req.path}\n`;

  // Append log entry to file
  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
    }
  });

  next();
};
