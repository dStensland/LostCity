/**
 * Sentry server-side configuration.
 * This file configures Sentry for Node.js server runtime.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Set environment
  environment: process.env.NODE_ENV,

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Supabase auth errors (usually user session expired)
    "AuthSessionMissingError",
    // Rate limiting (we handle this gracefully)
    "Too many requests",
  ],
});
