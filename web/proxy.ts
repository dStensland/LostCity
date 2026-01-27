import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

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

/**
 * Middleware for subdomain routing and auth session management.
 * - Refreshes Supabase auth sessions on each request
 * - Protects auth-required routes
 * - Rewrites root requests from {slug}.lostcity.ai to /{slug} portal page
 * - Other routes (events, collections, etc.) work globally on any subdomain
 */
export async function proxy(request: NextRequest) {
  // Create response that will be modified for auth
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = sanitizeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  // Skip auth if Supabase isn't configured
  if (!supabaseUrl || !supabaseKey) {
    return handleSubdomainRouting(request, response, []);
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
          response = NextResponse.next({ request });
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

  // PERFORMANCE OPTIMIZATION:
  // - For non-protected routes: Use getSession() which reads from cookies (fast, no network)
  // - For protected routes: Use getUser() to validate with server (slower, but secure)
  // This avoids a network call on every single page load.

  if (isProtectedPath) {
    // Protected route - validate session with server
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/login";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  } else {
    // Non-protected route - just refresh cookies from local session (no network call)
    // This keeps the session cookies fresh without blocking on network
    await supabase.auth.getSession();
  }

  return handleSubdomainRouting(request, response, cookiesToSet);
}

function handleSubdomainRouting(
  request: NextRequest,
  response: NextResponse,
  cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>
) {
  const host = request.headers.get("host") || "";
  const url = request.nextUrl.clone();

  // Parse subdomain from host
  let subdomain: string | null = null;

  // Production: atlanta.lostcity.ai
  // Local: atlanta.localhost:3000
  if (host.includes(".")) {
    const parts = host.split(".");
    const firstPart = parts[0];

    // Skip www and the main domain parts
    const skipParts = ["www", "lostcity", "localhost", "vercel"];
    if (!skipParts.includes(firstPart) && parts.length > 1) {
      subdomain = firstPart;
    }
  }

  // Development fallback: ?portal=atlanta
  if (!subdomain && process.env.NODE_ENV === "development") {
    subdomain = request.nextUrl.searchParams.get("portal");
  }

  // If we have a subdomain, rewrite root to portal page
  if (subdomain) {
    // Don't rewrite API routes
    if (url.pathname.startsWith("/api/")) {
      return response;
    }

    // Only rewrite root path to portal page
    // atlanta.lostcity.ai/ -> /atlanta
    // Other paths like /events/123 work as-is (global routes)
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = `/${subdomain}`;

      // Remove the portal query param if present
      url.searchParams.delete("portal");

      // Create rewrite response with auth cookies (preserve full options)
      const rewriteResponse = NextResponse.rewrite(url);
      cookiesToSet.forEach(({ name, value, options }) => {
        rewriteResponse.cookies.set(name, value, options);
      });
      return rewriteResponse;
    }

    // For non-root paths, just pass through but store subdomain context
    // This allows events, collections, etc. to work on subdomains
    response.headers.set("x-portal-slug", subdomain);
  }

  return response;
}

export const config = {
  // Match all paths except static files, API routes, auth callbacks, and Next.js internals
  matcher: [
    "/((?!api|auth/callback|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
