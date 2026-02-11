/**
 * Validate and sanitize redirect URLs to prevent Open Redirect attacks.
 *
 * @param redirect - The redirect URL to validate
 * @param defaultUrl - The default URL to return if validation fails (default: "/")
 * @returns A safe redirect URL
 */
export function getSafeRedirectUrl(
  redirect: string | null,
  defaultUrl: string = "/"
): string {
  if (!redirect) return defaultUrl;

  // Must start with / and not be a protocol-relative URL
  if (!redirect.startsWith("/") || redirect.startsWith("//")) {
    return defaultUrl;
  }

  // Block any URL with protocol schemes (e.g., javascript:, data:, etc.)
  if (redirect.includes(":")) {
    return defaultUrl;
  }

  // Block encoded characters that could bypass checks
  try {
    const decoded = decodeURIComponent(redirect);
    if (
      decoded !== redirect &&
      (decoded.includes(":") || decoded.startsWith("//"))
    ) {
      return defaultUrl;
    }
  } catch {
    // If decoding fails, the URL is invalid
    return defaultUrl;
  }

  // Allow any relative path that looks like a valid app route
  // This includes portal slugs (e.g., /atlanta), event pages, profiles, etc.
  // The important security checks (no protocol, no //) are already done above
  const isValidPath = /^\/[a-zA-Z0-9]/.test(redirect);

  if (!isValidPath && redirect !== "/") {
    return defaultUrl;
  }

  return redirect;
}

/**
 * Simple redirect validation for use in server-side routes.
 * This is a more lenient check used in the callback route.
 *
 * @param redirect - The redirect URL to validate
 * @returns True if the redirect is safe
 */
export function isValidRedirect(redirect: string): boolean {
  // Only allow relative URLs starting with / (not //)
  return (
    redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.includes(":")
  );
}

const NON_PORTAL_ROUTES = new Set([
  "auth",
  "api",
  "admin",
  "calendar",
  "claim",
  "collections",
  "community",
  "dashboard",
  "data",
  "events",
  "festivals",
  "find-friends",
  "foryou",
  "friends",
  "happening-now",
  "invite",
  "invite-friends",
  "logo-concepts",
  "notifications",
  "onboarding",
  "people",
  "privacy",
  "spots",
  "profile",
  "saved",
  "series",
  "settings",
  "submit",
  "terms",
  "venue",
  "welcome",
]);

const PORTAL_SLUG_REGEX = /^[a-z0-9-]{2,80}$/;
export const PORTAL_CONTEXT_COOKIE = "lc_last_portal_slug";

export function isValidPortalSlug(slug: string | null | undefined): slug is string {
  return typeof slug === "string" && PORTAL_SLUG_REGEX.test(slug);
}

/**
 * Extract a portal slug from a redirect path (e.g. "/piedmont/events" -> "piedmont").
 */
export function extractPortalFromRedirect(redirect: string | null | undefined): string | null {
  if (!redirect || !redirect.startsWith("/")) return null;

  const match = redirect.match(/^\/([a-z0-9-]+)/);
  if (!match) return null;

  const slug = match[1];
  if (NON_PORTAL_ROUTES.has(slug)) return null;
  return isValidPortalSlug(slug) ? slug : null;
}

export function getRememberedPortalSlug(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const storageSlug = window.localStorage.getItem(PORTAL_CONTEXT_COOKIE);
    if (isValidPortalSlug(storageSlug)) {
      return storageSlug;
    }
  } catch {
    // Ignore localStorage access failures (e.g. private mode restrictions).
  }

  const cookieMatch = document.cookie.match(
    new RegExp(`(?:^|; )${PORTAL_CONTEXT_COOKIE}=([^;]+)`)
  );
  if (!cookieMatch) return null;

  try {
    const cookieSlug = decodeURIComponent(cookieMatch[1] || "");
    return isValidPortalSlug(cookieSlug) ? cookieSlug : null;
  } catch {
    return null;
  }
}
