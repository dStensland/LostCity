/**
 * Centralized URL builders for all entity types.
 *
 * Two context modes:
 * - 'feed': overlay pattern (?event=id) — scroll preservation in feed/explore/calendar
 * - 'page': canonical pattern (/events/id) — standalone pages, sharing, SEO
 *
 * Civic events use getCivicEventHref() as a pre-check before this builder.
 * See web/lib/civic-routing.ts.
 */

type LinkContext = "feed" | "page";

export function buildEventUrl(id: number, portalSlug: string, context: LinkContext): string {
  if (context === "feed") return `/${portalSlug}?event=${id}`;
  return `/${portalSlug}/events/${id}`;
}

export function buildSpotUrl(slug: string, portalSlug: string, context: LinkContext): string {
  if (context === "feed") return `/${portalSlug}?spot=${slug}`;
  return `/${portalSlug}/spots/${slug}`;
}

export function buildSeriesUrl(slug: string, portalSlug: string, seriesType?: string): string {
  if (seriesType === "film") return `/${portalSlug}/showtimes/${slug}`;
  return `/${portalSlug}/series/${slug}`;
}

export function buildFestivalUrl(slug: string, portalSlug: string): string {
  return `/${portalSlug}/festivals/${slug}`;
}

export function buildExhibitionUrl(slug: string, portalSlug: string): string {
  return `/${portalSlug}/exhibitions/${slug}`;
}

export function buildArtistUrl(slug: string, portalSlug: string): string {
  return `/${portalSlug}/artists/${slug}`;
}

export function buildOrgUrl(slug: string, portalSlug: string): string {
  return `/${portalSlug}?org=${slug}`;
}
