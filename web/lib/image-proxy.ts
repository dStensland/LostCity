import type { ImageProps } from "next/image";

/**
 * Known safe image hosts from next.config.ts remotePatterns.
 * These can be served directly through Next.js image optimization without the proxy.
 */
const KNOWN_IMAGE_HOSTS = new Set([
  // Supabase storage
  "*.supabase.co",
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
  // Wildcard patterns
  "**.squarespace.com",
]);

/**
 * Check if a hostname matches any known image host pattern.
 * Supports exact matches and wildcard patterns (e.g., **.squarespace.com or *.supabase.co).
 */
function matchesKnownHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  for (const pattern of KNOWN_IMAGE_HOSTS) {
    // Exact match
    if (pattern === lower) {
      return true;
    }

    // Wildcard pattern: **.example.com matches any subdomain including multi-level
    if (pattern.startsWith("**.")) {
      const domain = pattern.slice(3); // Remove "**."
      if (lower === domain || lower.endsWith(`.${domain}`)) {
        return true;
      }
    }

    // Wildcard pattern: *.example.com matches single-level subdomains
    if (pattern.startsWith("*.")) {
      const domain = pattern.slice(2); // Remove "*."
      if (lower.endsWith(`.${domain}`)) {
        // Ensure it's exactly one level: foo.example.com matches, but not foo.bar.example.com
        const prefix = lower.slice(0, -(domain.length + 1));
        if (!prefix.includes(".")) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if a URL points to a known safe image host that's already in next.config.ts remotePatterns.
 * Returns true if the image can be served directly without the proxy.
 */
export function isKnownImageHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return matchesKnownHost(parsed.hostname);
  } catch {
    return false;
  }
}

export function shouldProxyImage(src: ImageProps["src"]): src is string {
  if (typeof src !== "string") return false;
  if (!src) return false;
  if (src.startsWith("/api/image-proxy")) return false;
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) {
    return false;
  }
  return src.startsWith("http://") || src.startsWith("https://");
}

export function buildProxiedImageSrc(src: string): string {
  try {
    const normalized = new URL(src);
    if (normalized.protocol === "http:") {
      normalized.protocol = "https:";
    }
    return `/api/image-proxy?url=${encodeURIComponent(normalized.toString())}`;
  } catch {
    return `/api/image-proxy?url=${encodeURIComponent(src)}`;
  }
}

/**
 * Returns the optimal image source URL.
 * - Known safe hosts (in next.config.ts remotePatterns): returned as-is for direct optimization
 * - Unknown hosts: proxied through /api/image-proxy for SSRF protection
 *
 * This eliminates the double serverless function hop for images from known domains.
 */
export function getProxiedImageSrc(src: ImageProps["src"]): ImageProps["src"] {
  if (!shouldProxyImage(src)) return src;

  // Bypass proxy for known safe hosts - they're already in next.config.ts remotePatterns
  if (isKnownImageHost(src)) {
    return src;
  }

  // Unknown hosts go through proxy for SSRF protection
  return buildProxiedImageSrc(src);
}
