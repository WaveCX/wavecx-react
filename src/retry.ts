export type RetryConfig = {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  multiplier: number;
};

export const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 32000, // 32 seconds
  multiplier: 2.0,
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param config Retry configuration
 * @param debugLog Optional debug logging function
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = defaultRetryConfig,
  debugLog?: (message: string, data?: any) => void
): Promise<T> {
  let lastError: Error | unknown;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      debugLog?.(`Attempt ${attempt}/${config.maxAttempts}`);
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < config.maxAttempts) {
        debugLog?.(`Attempt ${attempt} failed, retrying in ${delay}ms`, { error });
        await sleep(delay);
        // Exponential backoff with cap
        delay = Math.min(delay * config.multiplier, config.maxDelay);
      } else {
        debugLog?.(`All ${config.maxAttempts} attempts failed`, { error });
      }
    }
  }

  throw lastError;
}
