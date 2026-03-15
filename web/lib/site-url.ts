import type { Portal } from "@/lib/portal-context";

const DEFAULT_SITE_URL = "https://lostcity.ai";

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
}

export function toAbsoluteUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

/**
 * Get the base domain for the platform (without protocol or port).
 * In development, uses lvh.me which supports subdomain routing on localhost.
 */
export function getBaseDomain(): string {
  return process.env.NEXT_PUBLIC_BASE_DOMAIN || "lostcity.ai";
}

/**
 * Build the full origin URL for a portal.
 * - Base portal (no vertical): https://lostcity.ai
 * - Vertical portal: https://{vertical_slug}.lostcity.ai
 * - B2B with custom domain: https://{custom_domain}
 */
export function buildPortalOrigin(portal: Portal): string {
  if (portal.custom_domain) {
    return `https://${portal.custom_domain}`;
  }

  const baseDomain = getBaseDomain();
  const protocol = baseDomain.includes("localhost") || baseDomain.includes("lvh.me")
    ? "http"
    : "https";

  if (portal.vertical_slug) {
    return `${protocol}://${portal.vertical_slug}.${baseDomain}`;
  }

  return `${protocol}://${baseDomain}`;
}

/**
 * Build an absolute URL for content on a specific portal.
 * Used for cross-portal links, canonical URLs, and OG tags.
 */
export function buildAbsolutePortalUrl(path: string, portal: Portal): string {
  const origin = buildPortalOrigin(portal);
  const citySlug = portal.city_slug || portal.slug;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}/${citySlug}${normalizedPath}`;
}

/**
 * Build a cross-portal URL (when linking from one portal to content on another).
 */
export function buildCrossPortalUrl(path: string, targetPortal: Portal): string {
  return buildAbsolutePortalUrl(path, targetPortal);
}
