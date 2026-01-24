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
