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

  // Whitelist allowed path prefixes
  const allowedPrefixes = [
    "/dashboard",
    "/admin",
    "/settings",
    "/onboarding",
    "/events",
    "/venues",
    "/profile",
    "/friends",
    "/people",
    "/foryou",
    "/saved",
    "/notifications",
    "/community",
    "/",
  ];

  // Check if the redirect starts with any allowed prefix
  const isAllowed = allowedPrefixes.some((prefix) => {
    if (prefix === "/") {
      // Root path is allowed, but we need to check it doesn't start with other dangerous patterns
      return redirect === "/" || redirect.match(/^\/[a-z0-9-]+/i);
    }
    return redirect.startsWith(prefix);
  });

  if (!isAllowed) {
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
