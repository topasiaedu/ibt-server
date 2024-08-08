import { logError } from './errorLogger';

const MAX_RETRIES = 5;
const RETRY_DELAY = 20000;

async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    if (retries > 0) {
      console.warn(`Retrying ${operationName} due to error: ${errorMessage}. Retries left: ${retries}`);
      await new Promise((res) =>
        setTimeout(res, RETRY_DELAY * (MAX_RETRIES - retries + 1))
      ); // Exponential backoff
      console.log(`Retrying ${operationName} attempt ${MAX_RETRIES - retries + 1}`);
      return withRetry(fn, operationName, retries - 1);
    } else {
      logError(error, `Max retries reached for ${operationName}`);
      throw error;
    }
  }
}

export { withRetry };
