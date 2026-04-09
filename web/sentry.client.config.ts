import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",

  // Sample rate — 10% of errors is plenty for signal, saves Sentry quota
  sampleRate: 0.1,

  // Performance transactions — 1% keeps costs low
  tracesSampleRate: 0.01,

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
