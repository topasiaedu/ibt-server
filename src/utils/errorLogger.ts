import * as fs from 'fs/promises';
import * as path from 'path';

// Define the path for the error log file.
const ERROR_LOG_PATH: string = path.join(__dirname, 'errorLog.txt');

/**
 * Ensures that the error log file exists. Creates it if it does not.
 */
async function ensureLogFileExists(): Promise<void> {
    try {
        await fs.access(ERROR_LOG_PATH);
    } catch {
        // If the file does not exist, create it by writing an empty string.
        await fs.writeFile(ERROR_LOG_PATH, '', { flag: 'wx' });
    }
}

/**
 * Logs an error message to a file. Includes a timestamp, optional context, and the error stack.
 *
 * @param error - The error object to log.
 * @param context - Optional context or description about where the error occurred or what it affects.
 */
export async function logError(error: any, context: string = ''): Promise<void> {
    await ensureLogFileExists(); // Ensure the log file exists before trying to append to it.
    
    const timestamp: string = new Date().toISOString();
    const errorMessage: string = `[${timestamp}] ${context} ${JSON.stringify(error.stack, null, 2) || JSON.stringify(error, null, 2)}\n\n\n`;

    // Append the error message to the specified log file.
    try {
        await fs.appendFile(ERROR_LOG_PATH, errorMessage);
    } catch (err) {
        console.error('Failed to write to error log file:', err);
    }
}