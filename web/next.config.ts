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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rtppvljfrkjtoxmaizea.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      // Google profile pictures (OAuth)
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "img.evbuc.com",
      },
      {
        protocol: "https",
        hostname: "cdn.evbuc.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.ticketmaster.com",
      },
      {
        protocol: "https",
        hostname: "s1.ticketm.net",
      },
      {
        protocol: "https",
        hostname: "localist-images.azureedge.net",
      },
      {
        protocol: "https",
        hostname: "indy-systems.imgix.net",
      },
      {
        protocol: "https",
        hostname: "bunny-wp-pullzone-2v7xwnunut.b-cdn.net",
      },
      {
        protocol: "https",
        hostname: "funspotamericaatlanta.com",
      },
      {
        protocol: "https",
        hostname: "**.b-cdn.net",
      },
      // Producer logos - various domains
      {
        protocol: "https",
        hostname: "beltline.org",
      },
      {
        protocol: "https",
        hostname: "**.wixstatic.com",
      },
      {
        protocol: "https",
        hostname: "**.squarespace.com",
      },
      {
        protocol: "http",
        hostname: "**.squarespace.com",
      },
      {
        protocol: "https",
        hostname: "**.artsatl.org",
      },
      {
        protocol: "https",
        hostname: "**.atlantaballet.com",
      },
      {
        protocol: "https",
        hostname: "**.atlantacontemporary.org",
      },
      {
        protocol: "https",
        hostname: "**.atlantafilmsociety.org",
      },
      {
        protocol: "https",
        hostname: "ajff.org",
      },
      {
        protocol: "https",
        hostname: "**.atlantaopera.org",
      },
      {
        protocol: "https",
        hostname: "**.aso.org",
      },
      {
        protocol: "https",
        hostname: "**.atlantatrackclub.org",
      },
      {
        protocol: "https",
        hostname: "dynamix-cdn.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "**.atlantawritersclub.org",
      },
      {
        protocol: "https",
        hostname: "**.bronzelens.com",
      },
      {
        protocol: "https",
        hostname: "**.callanwolde.org",
      },
      {
        protocol: "https",
        hostname: "**.cfgreateratlanta.org",
      },
      {
        protocol: "https",
        hostname: "**.eyedrum.org",
      },
      {
        protocol: "https",
        hostname: "**.japanfest.org",
      },
      {
        protocol: "https",
        hostname: "**.outonfilm.org",
      },
      {
        protocol: "https",
        hostname: "**.parkpride.org",
      },
      {
        protocol: "https",
        hostname: "**.spruillarts.org",
      },
      {
        protocol: "https",
        hostname: "**.tasteofatlanta.com",
      },
      {
        protocol: "https",
        hostname: "**.nmcdn.io",
      },
      {
        protocol: "https",
        hostname: "**.woodruffcenter.org",
      },
      // Georgia Tech domains
      {
        protocol: "https",
        hostname: "ramblinwreck.com",
      },
      {
        protocol: "https",
        hostname: "**.ramblinwreck.com",
      },
      {
        protocol: "https",
        hostname: "**.gatech.edu",
      },
      {
        protocol: "https",
        hostname: "gatech.edu",
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
