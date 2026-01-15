import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Middleware for subdomain routing and auth session management.
 * - Refreshes Supabase auth sessions on each request
 * - Protects auth-required routes
 * - Rewrites requests from {slug}.lostcity.ai to /portal/{slug}
 */
export async function middleware(request: NextRequest) {
  // Create response that will be modified for auth
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth if Supabase isn't configured
  if (!supabaseUrl || !supabaseKey) {
    return handleSubdomainRouting(request, response, null);
  }

  // Create Supabase client for session management
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser();

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ["/settings", "/foryou"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return handleSubdomainRouting(request, response, user);
}

function handleSubdomainRouting(
  request: NextRequest,
  response: NextResponse,
  _user: unknown
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

  // If we have a subdomain, rewrite to portal route
  if (subdomain) {
    // Don't rewrite if already on a portal route
    if (url.pathname.startsWith("/portal/")) {
      return response;
    }

    // Don't rewrite API routes
    if (url.pathname.startsWith("/api/")) {
      return response;
    }

    // Rewrite: / -> /portal/atlanta
    // Rewrite: /events/123 -> /portal/atlanta/events/123
    url.pathname = `/portal/${subdomain}${url.pathname}`;

    // Remove the portal query param if present
    url.searchParams.delete("portal");

    // Create rewrite response with auth cookies
    const rewriteResponse = NextResponse.rewrite(url);
    // Copy auth cookies to rewrite response
    response.cookies.getAll().forEach((cookie) => {
      rewriteResponse.cookies.set(cookie.name, cookie.value);
    });
    return rewriteResponse;
  }

  return response;
}

export const config = {
  // Match all paths except static files, API routes, and Next.js internals
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
