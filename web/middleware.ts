import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware for subdomain routing.
 * Rewrites requests from {slug}.lostcity.ai to /portal/{slug}
 */
export function middleware(request: NextRequest) {
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
      return NextResponse.next();
    }

    // Don't rewrite API routes
    if (url.pathname.startsWith("/api/")) {
      return NextResponse.next();
    }

    // Rewrite: / -> /portal/atlanta
    // Rewrite: /events/123 -> /portal/atlanta/events/123
    url.pathname = `/portal/${subdomain}${url.pathname}`;

    // Remove the portal query param if present
    url.searchParams.delete("portal");

    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths except static files, API routes, and Next.js internals
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
