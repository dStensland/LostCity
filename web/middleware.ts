import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { getCachedDomain, setCachedDomain } from "@/lib/domain-cache";
import { buildCsp } from "@/lib/csp";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function applyCspHeaders(
  response: NextResponse,
  csp: string,
  nonce: string,
  reportOnlyCsp?: string
) {
  response.headers.set("Content-Security-Policy", csp);
  if (reportOnlyCsp) {
    response.headers.set("Content-Security-Policy-Report-Only", reportOnlyCsp);
  }
  response.headers.set("X-Nonce", nonce);
}

// Sanitize API key - remove any whitespace, control chars, or URL encoding artifacts
function sanitizeKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  return key
    .trim()
    .replace(/[\s\n\r\t]/g, '')
    .replace(/%0A/gi, '')
    .replace(/%0D/gi, '')
    .replace(/[^\x20-\x7E]/g, '');
}

// Known LostCity domains that should NOT be treated as custom domains
const LOSTCITY_DOMAINS = [
  'lostcity.ai',
  'lostcity.com',
  'localhost',
  'vercel.app',
];

/**
 * Check if a host is a custom domain (not a LostCity subdomain)
 */
function isCustomDomain(host: string): boolean {
  const lowerHost = host.toLowerCase();

  // Check if it's a known LostCity domain or subdomain
  for (const domain of LOSTCITY_DOMAINS) {
    if (lowerHost === domain || lowerHost.endsWith(`.${domain}`)) {
      return false;
    }
  }

  // It's a custom domain if it has a TLD (contains at least one dot)
  return lowerHost.includes('.');
}

/**
 * Resolve custom domain to portal slug using edge-compatible approach
 * Uses cached values when available, falls back to API call
 */
async function resolveCustomDomainInMiddleware(
  host: string,
  request: NextRequest
): Promise<string | null> {
  const normalizedDomain = host.toLowerCase().replace(/^www\./, '');

  // Check in-memory cache first
  const cached = getCachedDomain(normalizedDomain);
  if (cached !== undefined) {
    return cached;
  }

  // For edge runtime, we can't use Supabase directly - use internal API
  // This API call will be very fast since it's same-origin
  try {
    const apiUrl = new URL('/api/internal/resolve-domain', request.url);
    apiUrl.searchParams.set('domain', normalizedDomain);

    const internalSecret = process.env.INTERNAL_API_SECRET;
    if (!internalSecret) {
      // If secret not configured, fail safely
      setCachedDomain(normalizedDomain, null);
      return null;
    }

    const response = await fetch(apiUrl.toString(), {
      headers: {
        'x-internal-secret': internalSecret,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const slug = data.slug || null;
      setCachedDomain(normalizedDomain, slug);
      return slug;
    }
  } catch {
    // Fall through - treat as no custom domain
  }

  // Cache the negative result
  setCachedDomain(normalizedDomain, null);
  return null;
}

/**
 * Middleware for subdomain routing and auth session management.
 * - Refreshes Supabase auth sessions on each request
 * - Protects auth-required routes
 * - Rewrites root requests from {slug}.lostcity.ai to /{slug} portal page
 * - Other routes (events, collections, etc.) work globally on any subdomain
 */
export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildCsp(nonce, { isDev });
  const cspReportOnly = buildCsp(nonce, {
    isDev,
    allowInlineStyles: true,
    includeUpgradeInsecureRequests: false,
    reportUri: "/api/csp-report",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);
  requestHeaders.set("x-nonce", nonce);

  // Create response that will be modified for auth
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  applyCspHeaders(response, csp, nonce, cspReportOnly);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // Skip auth if Supabase isn't configured
  if (!supabaseUrl || !supabaseKey) {
    return handleSubdomainRouting(
      request,
      response,
      [],
      requestHeaders,
      csp,
      nonce,
      cspReportOnly
    );
  }

  // Track cookies that need to be set (with full options)
  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];

  // Create Supabase client for session management
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            cookiesToSet.push({ name, value, options });
          });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          applyCspHeaders(response, csp, nonce, cspReportOnly);
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Protected routes that require authentication
  const protectedPaths = ["/dashboard", "/admin", "/settings", "/onboarding", "/foryou", "/saved"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Only call getUser() when auth cookies are present or path requires auth.
  // For anonymous visitors (no sb-* cookies on non-protected paths), skip the
  // server roundtrip to validate a session that doesn't exist.
  const hasAuthCookies = request.cookies.getAll().some(c => c.name.startsWith("sb-"));

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let authError: Awaited<ReturnType<typeof supabase.auth.getUser>>["error"] = null;

  if (hasAuthCookies || isProtectedPath) {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    authError = result.error;
  }

  // Only clear cookies for specific auth errors that indicate invalid/expired sessions.
  // DON'T clear on network errors, timeouts, or transient issues (which can happen during deploys).
  // Supabase error codes that mean the session is definitely invalid:
  // - "session_not_found" - session doesn't exist
  // - "invalid_token" - token is malformed
  // - "user_not_found" - user was deleted
  const invalidSessionErrors = ["session_not_found", "invalid_token", "user_not_found", "bad_jwt"];
  const shouldClearCookies = authError &&
    !request.nextUrl.pathname.startsWith("/auth") &&
    authError.code &&
    invalidSessionErrors.includes(authError.code);

  if (shouldClearCookies) {
    // Clear all Supabase auth cookies to give user clean state
    const supabaseProject = supabaseUrl.replace("https://", "").split(".")[0];
    const authCookiePrefix = `sb-${supabaseProject}-auth-token`;

    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith(authCookiePrefix)) {
        response.cookies.delete(cookie.name);
      }
    }
  }

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return await handleSubdomainRouting(
    request,
    response,
    cookiesToSet,
    requestHeaders,
    csp,
    nonce,
    cspReportOnly
  );
}

async function handleSubdomainRouting(
  request: NextRequest,
  response: NextResponse,
  cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>,
  requestHeaders: Headers,
  csp: string,
  nonce: string,
  reportOnlyCsp?: string
) {
  const host = request.headers.get("host") || "";
  const url = request.nextUrl.clone();

  // Don't process API routes
  if (url.pathname.startsWith("/api/")) {
    applyCspHeaders(response, csp, nonce, reportOnlyCsp);
    return response;
  }

  let portalSlug: string | null = null;

  // Step 1: Check for custom domain first (highest priority)
  // Custom domains are non-LostCity domains like events.marriott.com
  if (isCustomDomain(host)) {
    portalSlug = await resolveCustomDomainInMiddleware(host, request);

    // If custom domain resolved, handle routing
    if (portalSlug) {
      // Only rewrite root path to portal page
      if (url.pathname === "/" || url.pathname === "") {
        url.pathname = `/${portalSlug}`;

        const rewriteResponse = NextResponse.rewrite(url, {
          request: { headers: requestHeaders },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          rewriteResponse.cookies.set(name, value, options);
        });
        // Mark as custom domain for downstream code
        rewriteResponse.headers.set("x-portal-slug", portalSlug);
        rewriteResponse.headers.set("x-custom-domain", "true");
        applyCspHeaders(rewriteResponse, csp, nonce, reportOnlyCsp);
        return rewriteResponse;
      }

      // For non-root paths, pass through with portal context
      response.headers.set("x-portal-slug", portalSlug);
      response.headers.set("x-custom-domain", "true");
      applyCspHeaders(response, csp, nonce, reportOnlyCsp);
      return response;
    }

    // Custom domain didn't resolve - fall through to check subdomains
    // This handles cases where someone points a domain but hasn't verified it
  }

  // Step 2: Parse subdomain from host (for LostCity subdomains)
  // Production: atlanta.lostcity.ai
  // Local: atlanta.localhost:3000
  if (host.includes(".")) {
    const parts = host.split(".");
    const firstPart = parts[0];

    // Skip www and the main domain parts
    const skipParts = ["www", "lostcity", "localhost", "vercel"];
    if (!skipParts.includes(firstPart) && parts.length > 1) {
      portalSlug = firstPart;
      // Validate slug format to prevent URL-encoded or special character attacks
      if (!/^[a-z0-9][a-z0-9-]*$/.test(portalSlug)) {
        portalSlug = null;
      }
    }
  }

  // Step 3: Development fallback: ?portal=atlanta
  if (!portalSlug && process.env.NODE_ENV === "development") {
    portalSlug = request.nextUrl.searchParams.get("portal");
  }

  // If we have a portal slug, rewrite root to portal page
  if (portalSlug) {
    // Only rewrite root path to portal page
    // atlanta.lostcity.ai/ -> /atlanta
    // Other paths like /events/123 work as-is (global routes)
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = `/${portalSlug}`;

      // Remove the portal query param if present
      url.searchParams.delete("portal");

      // Create rewrite response with auth cookies (preserve full options)
      const rewriteResponse = NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
      cookiesToSet.forEach(({ name, value, options }) => {
        rewriteResponse.cookies.set(name, value, options);
      });
      applyCspHeaders(rewriteResponse, csp, nonce, reportOnlyCsp);
      return rewriteResponse;
    }

    // For non-root paths, just pass through but store subdomain context
    // This allows events, collections, etc. to work on subdomains
    response.headers.set("x-portal-slug", portalSlug);
  }

  applyCspHeaders(response, csp, nonce, reportOnlyCsp);
  return response;
}

export const config = {
  // Match all paths except static files, API routes, auth callbacks, and Next.js internals
  matcher: [
    "/((?!api|auth/callback|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
