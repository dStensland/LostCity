import { NextRequest, NextResponse } from "next/server";

/**
 * Known vertical slugs that map to subdomain routing.
 * Duplicated from constants.ts to avoid importing non-edge-compatible modules.
 */
const KNOWN_VERTICALS = new Set([
  "arts",
  "family",
  "adventure",
  "citizen",
  "sports",
  "film",
  "music",
  "dog",
]);

/**
 * Base domains the platform runs on. Used to extract subdomain portions.
 */
const BASE_DOMAINS = ["lostcity.ai", "lostcity.app", "localhost", "lvh.me"];

/**
 * Legacy portal slugs that should redirect to their subdomain equivalents.
 * Maps old slug → { vertical, city } for 302 redirect.
 */
const LEGACY_SLUG_REDIRECTS: Record<string, { vertical: string; city: string }> = {
  helpatl: { vertical: "citizen", city: "atlanta" },
  "atl-dogs": { vertical: "dog", city: "atlanta" },
  "atl-film": { vertical: "film", city: "atlanta" },
};

function getBaseDomainFromHost(host: string): string | null {
  // Strip port
  const hostname = host.split(":")[0];
  // Find matching base domain (longest match first to handle subdomains of subdomains)
  for (const base of BASE_DOMAINS) {
    if (hostname === base || hostname.endsWith(`.${base}`)) {
      return base;
    }
  }
  return null;
}

function extractSubdomain(host: string, baseDomain: string): string | null {
  const hostname = host.split(":")[0];
  if (hostname === baseDomain) return null;

  const suffix = `.${baseDomain}`;
  if (!hostname.endsWith(suffix)) return null;

  const subdomain = hostname.slice(0, -suffix.length);
  // Only return single-level subdomains (no dots)
  if (subdomain.includes(".")) return null;
  return subdomain || null;
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const baseDomain = getBaseDomainFromHost(host);

  // If we can't identify the base domain, pass through
  if (!baseDomain) {
    return NextResponse.next();
  }

  const subdomain = extractSubdomain(host, baseDomain);

  // --- Legacy slug redirects ---
  // Check if path starts with a legacy portal slug (e.g., /helpatl/...)
  // Only redirect when on the root domain (no subdomain)
  if (!subdomain) {
    const pathname = request.nextUrl.pathname;
    const firstSegment = pathname.split("/")[1]; // e.g., "helpatl"
    const redirect = firstSegment ? LEGACY_SLUG_REDIRECTS[firstSegment] : undefined;
    if (redirect) {
      const protocol = baseDomain.includes("localhost") || baseDomain.includes("lvh.me")
        ? "http"
        : "https";
      const port = host.includes(":") ? `:${host.split(":")[1]}` : "";
      // rest is the sub-path after the legacy slug (e.g., /helpatl/events/123 → /events/123)
      // When accessing /helpatl with no trailing path, rest is "" — we just redirect to /{city}
      const rest = pathname.slice(firstSegment.length + 1); // "" | "/" | "/events/123"
      const subpath = rest && rest !== "/" ? rest : ""; // normalize empty and bare slash to ""
      const newUrl = `${protocol}://${redirect.vertical}.${baseDomain}${port}/${redirect.city}${subpath}${request.nextUrl.search}`;
      return NextResponse.redirect(newUrl, 302);
    }
  }

  // --- Vertical subdomain root redirect ---
  // When accessing a vertical subdomain root (e.g., arts.lostcity.ai/),
  // redirect to the default city (e.g., arts.lostcity.ai/atlanta)
  if (subdomain && KNOWN_VERTICALS.has(subdomain)) {
    const pathname = request.nextUrl.pathname;
    if (pathname === "/") {
      const protocol = baseDomain.includes("localhost") || baseDomain.includes("lvh.me")
        ? "http"
        : "https";
      const port = host.includes(":") ? `:${host.split(":")[1]}` : "";
      const newUrl = `${protocol}://${subdomain}.${baseDomain}${port}/atlanta${request.nextUrl.search}`;
      return NextResponse.redirect(newUrl, 302);
    }
  }

  // --- Subdomain header injection ---
  const response = NextResponse.next();

  if (subdomain && KNOWN_VERTICALS.has(subdomain)) {
    response.headers.set("x-lc-vertical", subdomain);
  } else if (subdomain) {
    // Unknown subdomain — could be B2B custom subdomain
    response.headers.set("x-lc-subdomain", subdomain);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
