import * as fs from 'fs';
import * as path from 'path';

// Define the path for the error log file.
const ERROR_LOG_PATH: string = path.join(__dirname, './logs/errorLog.txt');

/**
 * Logs an error message to a file. Includes a timestamp, optional context, and the error stack.
 *
 * @param error - The error object to log.
 * @param context - Optional context or description about where the error occurred or what it affects.
 */
export function logError(error: Error, context: string = ''): void {
    const timestamp: string = new Date().toISOString();
    const errorMessage: string = `[${timestamp}] ${context} ${error.stack || error.toString()}\n`;

    // Append the error message to the specified log file.
    fs.appendFile(ERROR_LOG_PATH, errorMessage, (err) => {
        if (err) {
            console.error('Failed to write to error log file:', err);
        }
    });
}
