# fetchWithRetry

A utility for adding exponential backoff retry logic to failed API calls.

## Overview

The `fetchWithRetry` function wraps the native `fetch` API with automatic retry logic, making network requests more resilient to transient failures.

## Features

- **Exponential Backoff**: Delays between retries increase exponentially (1s, 2s, 4s, etc.)
- **Smart Retry Logic**: Only retries on network errors and 5xx server errors, NOT 4xx client errors
- **Configurable**: Customize max retries, base delay, and retry conditions
- **Type-Safe**: Full TypeScript support

## Usage

### Basic Usage

```typescript
import { fetchWithRetry } from "@/lib/fetchWithRetry";

// Simple GET request with default retry behavior (3 retries, 1s base delay)
const response = await fetchWithRetry("/api/events");
const data = await response.json();
```

### Custom Configuration

```typescript
// Custom retry options
const response = await fetchWithRetry(
  "/api/friends",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "123" }),
  },
  {
    maxRetries: 5,        // Try up to 5 times
    baseDelay: 500,       // Start with 500ms delay
  }
);
```

### Custom Retry Logic

```typescript
const response = await fetchWithRetry(
  "/api/activities",
  undefined,
  {
    shouldRetry: (error, response) => {
      // Custom retry conditions
      if (error.name === "AbortError") return false; // Don't retry aborted requests
      if (!response) return true; // Retry network errors
      if (response.status >= 500) return true; // Retry server errors
      if (response.status === 429) return true; // Retry rate limits
      return false;
    },
  }
);
```

### With React Query

When using with React Query (TanStack Query), disable React Query's built-in retry to avoid double-retry:

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchWithRetry } from "@/lib/fetchWithRetry";

export function useActivities() {
  return useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const res = await fetchWithRetry("/api/dashboard/activity", undefined, {
        maxRetries: 3,
        baseDelay: 1000,
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`);
      }

      return res.json();
    },
    retry: false, // Disable React Query retry since fetchWithRetry handles it
  });
}
```

### Creating a Custom Fetch Wrapper

For consistent retry behavior across your app:

```typescript
import { createFetchWithRetry } from "@/lib/fetchWithRetry";

// Create a custom fetch with preset options
const apiFetch = createFetchWithRetry({
  maxRetries: 5,
  baseDelay: 500,
});

// Use it throughout your app
const response = await apiFetch("/api/events");
```

## API Reference

### `fetchWithRetry(url, options?, retryOptions?)`

**Parameters:**

- `url: string` - The URL to fetch
- `options?: RequestInit` - Standard fetch options (method, headers, body, etc.)
- `retryOptions?: RetryOptions` - Retry configuration

**RetryOptions:**

```typescript
type RetryOptions = {
  // Maximum number of retry attempts (default: 3)
  maxRetries?: number;

  // Base delay in milliseconds for exponential backoff (default: 1000)
  baseDelay?: number;

  // Custom function to determine if a request should be retried
  shouldRetry?: (error: Error, response?: Response) => boolean;
};
```

**Returns:** `Promise<Response>`

**Throws:** The last error encountered after all retries fail

### Default Retry Behavior

By default, `fetchWithRetry` retries in these conditions:

- **Network errors** (no response received)
- **5xx server errors** (500, 502, 503, etc.)

It does NOT retry on:

- **4xx client errors** (400, 401, 403, 404, etc.)
- **Successful responses** (2xx, 3xx)

### Exponential Backoff Schedule

With default settings (`baseDelay: 1000`, `maxRetries: 3`):

- Initial request (attempt 0)
- Wait 1000ms → Retry 1
- Wait 2000ms → Retry 2
- Wait 4000ms → Retry 3
- If all fail, throw error

Total time before final failure: ~7 seconds

## Examples

### Updated Hooks

The following hooks have been updated to use `fetchWithRetry`:

- **`useActivities`** - Dashboard activity feed
- **`useFriends`** - Friends list
- **`useEventsList`** - Events with infinite scroll (with custom abort handling)

See these hooks for real-world examples.

## Best Practices

1. **Disable React Query retry** when using with React Query to avoid double-retry
2. **Handle abort signals** by customizing `shouldRetry` to return false for `AbortError`
3. **Use reasonable retry limits** to avoid excessive delays (3-5 retries is usually sufficient)
4. **Consider user experience** - show loading states during retries
5. **Log retry attempts** in production for monitoring

## When to Use

Use `fetchWithRetry` for:

- **Critical data fetching** where transient failures are common
- **Dashboard and feed endpoints** that users expect to be reliable
- **Background sync operations** where eventual success is important

Avoid for:

- **Real-time features** where stale data is problematic
- **User-initiated actions** where immediate feedback is needed (use optimistic updates instead)
- **Authentication endpoints** (these should fail fast)
