/**
 * Centralized URL builders for all entity types.
 *
 * Two context modes (per `lib/link-context.tsx`):
 * - `"overlay"`: overlay pattern (?event=id) — scroll preservation in
 *   overlay-capable surfaces (feed, explore, calendar).
 * - `"canonical"`: canonical pattern (/events/id) — standalone pages,
 *   sharing, SEO.
 *
 * Callers inside card components should use `useLinkContext()` or
 * `useResolvedLinkContext()` from `lib/link-context.tsx` instead of
 * passing context explicitly. Explicit context is still accepted as an
 * override for the rare cases where a component must force canonical
 * (e.g., share buttons) regardless of surface.
 *
 * Civic events use `getCivicEventHref()` as a pre-check before this
 * builder. See `web/lib/civic-routing.ts`.
 */

import type { LinkContext } from "@/lib/link-context";

export function buildEventUrl(
  id: number,
  portalSlug: string,
  context: LinkContext,
): string {
  if (context === "overlay") return `/${portalSlug}?event=${id}`;
  return `/${portalSlug}/events/${id}`;
}

export function buildSpotUrl(
  slug: string,
  portalSlug: string,
  context: LinkContext,
): string {
  if (context === "overlay") return `/${portalSlug}?spot=${slug}`;
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
