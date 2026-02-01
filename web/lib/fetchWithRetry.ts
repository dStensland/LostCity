/**
 * Options for configuring retry behavior
 */
export type RetryOptions = {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds for exponential backoff (default: 1000)
   */
  baseDelay?: number;

  /**
   * Custom function to determine if a request should be retried
   * @param error - The error that occurred
   * @param response - The Response object (if available)
   * @returns true if the request should be retried
   */
  shouldRetry?: (error: Error, response?: Response) => boolean;
};

/**
 * Fetch wrapper with exponential backoff retry logic
 *
 * Features:
 * - Automatic retry on network errors and 5xx server errors
 * - Exponential backoff (1s, 2s, 4s, etc.)
 * - Does NOT retry on 4xx client errors
 * - Configurable retry behavior
 *
 * Usage:
 * ```typescript
 * // Basic usage with defaults (3 retries, 1s base delay)
 * const response = await fetchWithRetry('/api/events');
 * const data = await response.json();
 *
 * // Custom retry configuration
 * const response = await fetchWithRetry('/api/events', {
 *   method: 'POST',
 *   body: JSON.stringify({ ... })
 * }, {
 *   maxRetries: 5,
 *   baseDelay: 500,
 *   shouldRetry: (error, response) => {
 *     // Custom retry logic
 *     return !response || response.status >= 500;
 *   }
 * });
 * ```
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param retryOptions - Retry configuration
 * @returns Promise resolving to the Response object
 * @throws The last error encountered after all retries fail
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  const { maxRetries = 3, baseDelay = 1000, shouldRetry } = retryOptions || {};

  // Default retry strategy: retry on network errors or 5xx server errors
  const defaultShouldRetry = (error: Error, response?: Response): boolean => {
    // Retry on network errors (no response received)
    if (!response) {
      return true;
    }

    // Retry on 5xx server errors (server-side issues)
    if (response.status >= 500) {
      return true;
    }

    // Don't retry on 4xx client errors (bad request, auth, etc.)
    return false;
  };

  const checkRetry = shouldRetry || defaultShouldRetry;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Check if response is OK or should not be retried
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);

        // Clone response for retry check (can only read body once)
        const clonedResponse = response.clone();

        if (checkRetry(error, clonedResponse)) {
          throw error;
        }
      }

      // Success - return the response
      return response;
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      const shouldRetryThis = checkRetry(lastError);

      // If this was our last attempt, or we shouldn't retry, throw
      if (attempt >= maxRetries || !shouldRetryThis) {
        throw lastError;
      }

      // Calculate delay with exponential backoff: baseDelay * 2^attempt
      // attempt 0: 1000ms, attempt 1: 2000ms, attempt 2: 4000ms
      const delay = baseDelay * Math.pow(2, attempt);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error("Unknown error occurred");
}

/**
 * Helper function to create a fetch wrapper with preset retry options
 *
 * Usage:
 * ```typescript
 * const myFetch = createFetchWithRetry({ maxRetries: 5, baseDelay: 500 });
 * const response = await myFetch('/api/events');
 * ```
 */
export function createFetchWithRetry(defaultRetryOptions: RetryOptions) {
  return (url: string, options?: RequestInit, retryOptions?: RetryOptions) => {
    return fetchWithRetry(url, options, { ...defaultRetryOptions, ...retryOptions });
  };
}
