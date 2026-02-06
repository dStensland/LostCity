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
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null;

const extraImageHosts = (process.env.NEXT_PUBLIC_IMAGE_HOSTS || "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const imageHosts = new Set([
  // Event platforms
  "img.evbuc.com",
  "cdn.evbuc.com",
  "s1.ticketm.net",
  "s1.ticketmaster.com",
  // Image CDNs
  "images.unsplash.com",
  "res.cloudinary.com",
  "i.imgur.com",
  "static.imgix.net",
  "indy-systems.imgix.net",
  // Media databases
  "image.tmdb.org",
  "upload.wikimedia.org",
  "user-images.githubusercontent.com",
  // Atlanta venue/org sites
  "www.aso.org",
  "admin.paintingwithatwist.com",
  "14d14a1b70be1f7f7d4a-0863ae42a3340022d3e557e78745c047.ssl.cf5.rackcdn.com",
  "images.squarespace-cdn.com",
  "static1.squarespace.com",
  "www.foxtheatre.org",
  "www.dadsgaragetheatre.com",
  "alliancetheatre.org",
  "high.org",
  "atlantahistorycenter.com",
  "www.atlantabg.org",
  "centerstage.net",
  ...extraImageHosts,
]);

if (supabaseHost) {
  imageHosts.add(supabaseHost);
}

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
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  images: {
    // Allow only known HTTPS image hosts. Add more via NEXT_PUBLIC_IMAGE_HOSTS.
    localPatterns: [
      // Allow proxied images with query params plus standard local assets.
      { pathname: "/api/image-proxy" },
      { pathname: "/**" },
    ],
    remotePatterns: [
      ...Array.from(imageHosts).map((hostname) => ({
        protocol: "https",
        hostname,
      })),
      {
        protocol: "https",
        hostname: "**.squarespace.com",
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

    // Don't widen source maps (smaller bundles)
    widenClientFileUpload: false,

    // Source maps configuration
    sourcemaps: {
      // Hide source maps from client (delete after upload)
      disable: false,
    },
  })
);
