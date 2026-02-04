import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",

  // Sample rate for error events (1.0 = 100%)
  sampleRate: 1.0,

  // Sample rate for performance transactions (lower to reduce volume)
  tracesSampleRate: 0.1,

  // Don't send PII
  sendDefaultPii: false,

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    /ResizeObserver loop/,
    /AbortError/,
    // Network errors that aren't actionable
    /Failed to fetch/,
    /Load failed/,
    /NetworkError/,
    // Next.js navigation
    /NEXT_NOT_FOUND/,
    /NEXT_REDIRECT/,
  ],
});
