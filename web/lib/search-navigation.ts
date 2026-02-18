import type { SearchResult } from "@/lib/unified-search";

const DEFAULT_SEARCH_PORTAL = "atlanta";

function extractSlugFromHref(href?: string): string | null {
  if (!href) return null;
  try {
    const parsed = new URL(href, "https://lostcity.local");
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || null;
  } catch {
    const normalized = href.split("?")[0].split("#")[0];
    const segments = normalized.split("/").filter(Boolean);
    return segments[segments.length - 1] || null;
  }
}

function resolvePortalSlug(portalSlug?: string): string {
  return portalSlug?.trim() || DEFAULT_SEARCH_PORTAL;
}

export function buildSearchResultHref(
  result: SearchResult,
  options: { portalSlug?: string } = {}
): string {
  const portal = resolvePortalSlug(options.portalSlug);
  const hasPortalContext = Boolean(options.portalSlug?.trim());
  const slug = extractSlugFromHref(result.href) || String(result.id);

  switch (result.type) {
    case "event":
      return hasPortalContext ? `/${portal}?event=${result.id}` : `/events/${result.id}`;
    case "venue":
      return hasPortalContext ? `/${portal}?spot=${slug}` : `/venue/${slug}`;
    case "organizer":
      return `/${portal}?org=${slug}`;
    case "series":
      return hasPortalContext ? `/${portal}?series=${slug}` : `/series/${slug}`;
    case "festival":
      return hasPortalContext ? `/${portal}?festival=${slug}` : `/festivals/${slug}`;
    case "list":
      return `/${portal}/lists/${slug}`;
    case "neighborhood":
      return `/${portal}?view=find&type=events&neighborhoods=${encodeURIComponent(result.title)}`;
    case "category":
      return `/${portal}?view=find&type=events&categories=${encodeURIComponent(result.title)}`;
    default:
      return result.href || `/${portal}`;
  }
}
