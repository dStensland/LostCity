import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Bundle analyzer - use with: ANALYZE=true npm run build
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://*.supabase.co",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://api.mapbox.com https://events.mapbox.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Disable verbose Fast Refresh logging in development
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  images: {
    // Allow all HTTPS images - we trust our data sources
    // This replaces the 50+ individual patterns that were hitting the Next.js limit
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**.squarespace.com",
      },
    ],
  },
};

// Wrap with bundle analyzer and Sentry
export default withBundleAnalyzer(
  withSentryConfig(nextConfig, {
    // Suppress source map upload logs in CI
    silent: true,

    // Source maps configuration
    sourcemaps: {
      // Delete source maps after upload to keep bundle small
      deleteSourcemapsAfterUpload: true,
    },

    // Disable tunneling (not needed for basic setup)
    tunnelRoute: undefined,
  })
);
