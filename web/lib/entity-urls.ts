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
 * Overlay-producing builders (event, spot, org) accept an optional
 * `existingParams` argument. When provided, the builder clears all
 * sibling overlay keys (DETAIL_ENTRY_PARAM_KEYS) and sets only the
 * intended one — this is the swap-not-stack invariant: clicking a
 * second entity inside an open overlay *replaces* the overlay, never
 * stacks two overlay params. Non-overlay params (lane, tab, filter
 * state) are preserved. See docs/plans/explore-overlay-architecture-
 * 2026-04-18.md § Component 3.
 *
 * Civic events use `getCivicEventHref()` as a pre-check before this
 * builder. See `web/lib/civic-routing.ts`.
 */

import type { LinkContext } from "@/lib/link-context";
import {
  DETAIL_ENTRY_PARAM_KEYS,
  type DetailEntryParamKey,
} from "@/app/[portal]/_surfaces/detail/detail-entry-contract";

/**
 * Build an overlay query string by cloning existingParams, clearing all
 * overlay sibling keys, setting only the intended key, then serializing.
 * Non-overlay params (lane, tab, filters, etc.) are preserved.
 */
function buildOverlayQuery(
  key: DetailEntryParamKey,
  value: string,
  existingParams?: URLSearchParams,
): string {
  const next = existingParams
    ? new URLSearchParams(existingParams.toString())
    : new URLSearchParams();
  for (const k of DETAIL_ENTRY_PARAM_KEYS) {
    next.delete(k);
  }
  next.set(key, value);
  return next.toString();
}

export function buildEventUrl(
  id: number,
  portalSlug: string,
  context: LinkContext,
  existingParams?: URLSearchParams,
): string {
  if (context === "overlay") {
    const query = buildOverlayQuery("event", String(id), existingParams);
    return `/${portalSlug}?${query}`;
  }
  return `/${portalSlug}/events/${id}`;
}

export function buildSpotUrl(
  slug: string,
  portalSlug: string,
  context: LinkContext,
  existingParams?: URLSearchParams,
): string {
  if (context === "overlay") {
    const query = buildOverlayQuery("spot", slug, existingParams);
    return `/${portalSlug}?${query}`;
  }
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

/**
 * Org overlay — always produces an overlay URL. `canonical` context would
 * need an `/orgs/[slug]` route, which doesn't exist today. If that route
 * is added, this function gets a `context` parameter like the others.
 */
export function buildOrgUrl(
  slug: string,
  portalSlug: string,
  existingParams?: URLSearchParams,
): string {
  const query = buildOverlayQuery("org", slug, existingParams);
  return `/${portalSlug}?${query}`;
}

export function buildNeighborhoodUrl(
  slug: string,
  portalSlug: string,
  context: LinkContext,
  existingParams?: URLSearchParams,
): string {
  if (context === "overlay") {
    const query = buildOverlayQuery("neighborhood", slug, existingParams);
    return `/${portalSlug}?${query}`;
  }
  return `/${portalSlug}/neighborhoods/${slug}`;
}
