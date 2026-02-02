# Retry Logic Implementation Summary

## Overview

Added exponential backoff retry logic for failed API calls to improve resilience against transient network failures.

## Files Created

### `/lib/fetchWithRetry.ts`

A reusable fetch wrapper with intelligent retry logic:

- **Exponential backoff**: 1s, 2s, 4s delays between retries
- **Smart retry conditions**: Only retries network errors and 5xx server errors, NOT 4xx client errors
- **Maximum 3 retries** by default (configurable)
- **Type-safe** with full TypeScript support
- **Flexible** with customizable retry conditions

Key exports:
- `fetchWithRetry()` - Main function for fetch with retry
- `createFetchWithRetry()` - Helper to create custom fetch wrappers with preset options
- `RetryOptions` - TypeScript type for retry configuration

## Files Updated

### 1. `/lib/hooks/useActivities.ts`

**Changes:**
- Added import for `fetchWithRetry`
- Replaced `fetch()` with `fetchWithRetry()` in queryFn
- Configured with 3 retries, 1s base delay
- Changed `retry: 2` to `retry: false` (React Query retry disabled)

**Impact:** Dashboard activity feed is now more resilient to network issues.

### 2. `/lib/hooks/useFriends.ts`

**Changes:**
- Added import for `fetchWithRetry`
- Replaced `fetch()` with `fetchWithRetry()` in queryFn
- Configured with 3 retries, 1s base delay
- Changed `retry: 2` to `retry: false` (React Query retry disabled)

**Impact:** Friends list fetching is now more reliable.

### 3. `/lib/hooks/useEventsList.ts`

**Changes:**
- Added import for `fetchWithRetry`
- Replaced `fetch()` with `fetchWithRetry()` in queryFn
- Configured with 3 retries, 1s base delay
- Custom `shouldRetry` function to handle abort signals (don't retry on AbortError)
- Changed `retry: 3` to `retry: false` (React Query retry disabled)
- Removed `retryDelay` (now handled by fetchWithRetry)

**Impact:** Event list fetching with infinite scroll is more resilient, while still properly handling view switching aborts.

## Documentation

### `/lib/FETCH_WITH_RETRY.md`

Comprehensive documentation including:
- Feature overview
- Usage examples (basic, custom config, with React Query)
- API reference
- Best practices
- When to use vs avoid

## Benefits

1. **Improved Reliability**: Automatic retry on transient failures
2. **Better UX**: Users less likely to see errors from temporary network issues
3. **Consistent Behavior**: Standardized retry logic across all data fetching hooks
4. **Configurable**: Easy to adjust retry behavior per endpoint
5. **Type-Safe**: Full TypeScript support prevents mistakes

## Testing

- Linter passes with no new errors or warnings
- TypeScript type checking passes
- All retry logic is opt-in and backwards compatible

## Retry Behavior

### Default Behavior

- **Retries on**: Network errors, 5xx server errors
- **Does NOT retry on**: 4xx client errors (auth, validation, etc.)
- **Max retries**: 3 attempts
- **Delays**: 1s, 2s, 4s (exponential backoff)
- **Total timeout**: ~7 seconds before final failure

### Custom Behavior (useEventsList example)

- Same as default, plus:
- **Does NOT retry on**: AbortError (for view switching)

## Next Steps

Consider applying `fetchWithRetry` to other data fetching hooks:

- `useDashboard`
- `useCalendarEvents`
- `useLiveEvents`
- `useInvites`
- `useFriendRequests`

## Migration Guide

To add retry logic to a hook:

1. Import the utility:
   ```typescript
   import { fetchWithRetry } from "@/lib/fetchWithRetry";
   ```

2. Replace `fetch()` with `fetchWithRetry()`:
   ```typescript
   const res = await fetchWithRetry("/api/endpoint", undefined, {
     maxRetries: 3,
     baseDelay: 1000,
   });
   ```

3. Disable React Query retry:
   ```typescript
   retry: false, // Disable React Query retry since fetchWithRetry handles it
   ```

4. (Optional) Add custom retry logic:
   ```typescript
   shouldRetry: (error, response) => {
     if (error.name === "AbortError") return false;
     // ... other conditions
   }
   ```

## Performance Impact

- **Minimal overhead**: Only adds delay on failures (not success)
- **Timeout consideration**: Failed requests may take up to ~7 seconds
- **Network efficiency**: Prevents unnecessary retries on client errors
- **Cache-friendly**: Works seamlessly with React Query caching
