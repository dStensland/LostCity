/**
 * Sentry client-side configuration.
 * This file configures Sentry for the browser/client.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Set environment
  environment: process.env.NODE_ENV,

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Network errors
    "Failed to fetch",
    "NetworkError",
    "Network request failed",
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // User-triggered navigation
    "AbortError",
    "The operation was aborted",
    // Hydration mismatches (common in dev)
    "Hydration failed",
    "Text content does not match",
  ],

  // Filter out noisy breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    // Ignore console logs in breadcrumbs
    if (breadcrumb.category === "console" && breadcrumb.level === "log") {
      return null;
    }
    return breadcrumb;
  },
});
