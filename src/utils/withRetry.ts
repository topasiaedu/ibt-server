
import { logError } from './errorLogger'

const MAX_RETRIES = 5
const RETRY_DELAY = 60000

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retrying due to error: ${error as string}. Retries left: ${retries}`)
      await new Promise((res) =>
        setTimeout(res, RETRY_DELAY * (MAX_RETRIES - retries + 1))
      ) // Exponential backoff
      console.log(`Retrying attempt ${MAX_RETRIES - retries + 1}`)
      return withRetry(fn, retries - 1)
    } else {
      logError(error, 'Max retries reached')
      throw error
    }
  }
}

export { withRetry }