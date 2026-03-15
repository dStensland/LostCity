/**
 * Shared constants that can be used by both client and server components.
 *
 * IMPORTANT: Do NOT add "use client" to this file - it needs to work
 * in both server and client contexts.
 */

/**
 * Default portal slug - used for URL routing when building portal-relative URLs.
 * The portal data is always loaded from the database; there is no hardcoded fallback.
 */
export const DEFAULT_PORTAL_SLUG = "atlanta";

/**
 * Default portal name - used for display purposes in UI elements when no
 * portal context is available (e.g., homepage, error pages).
 * NOTE: The actual portal data is always loaded from the database.
 */
export const DEFAULT_PORTAL_NAME = "Atlanta";

/**
 * Default city slug — used when redirecting from a vertical subdomain root to a city.
 */
export const DEFAULT_CITY_SLUG = "atlanta";

/**
 * Known vertical slugs that map to subdomain routing.
 * Used by middleware to distinguish vertical subdomains from B2B custom subdomains.
 */
export const KNOWN_VERTICALS = new Set([
  "arts",
  "family",
  "adventure",
  "citizen",
  "sports",
  "film",
  "music",
  "dog",
]);
