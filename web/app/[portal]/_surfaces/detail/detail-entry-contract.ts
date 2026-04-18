/**
 * The query-param keys that DetailOverlayRouter recognizes as
 * overlay-target indicators. Exported so URL builders can clear sibling
 * keys atomically when producing a new overlay URL (swap-not-stack —
 * see docs/plans/explore-overlay-architecture-2026-04-18.md § Component 3).
 */
export const DETAIL_ENTRY_PARAM_KEYS = [
  "event",
  "spot",
  "series",
  "festival",
  "org",
  "artist",
] as const;

export type DetailEntryParamKey = (typeof DETAIL_ENTRY_PARAM_KEYS)[number];

type SearchParamReader = {
  get(name: string): string | null;
  toString(): string;
};

export type DetailEntryMode = "page" | "overlay";

export type DetailOverlayTarget =
  | { kind: "event"; id: number }
  | { kind: "spot"; slug: string }
  | { kind: "series"; slug: string }
  | { kind: "festival"; slug: string }
  | { kind: "org"; slug: string }
  | { kind: "artist"; slug: string };

export function resolveDetailOverlayTarget(
  searchParams: SearchParamReader,
): DetailOverlayTarget | null {
  const eventId = searchParams.get("event");
  if (eventId) {
    const id = parseInt(eventId, 10);
    if (!Number.isNaN(id)) {
      return { kind: "event", id };
    }
  }

  const spotSlug = searchParams.get("spot");
  if (spotSlug) {
    return { kind: "spot", slug: spotSlug };
  }

  const seriesSlug = searchParams.get("series");
  if (seriesSlug) {
    return { kind: "series", slug: seriesSlug };
  }

  const festivalSlug = searchParams.get("festival");
  if (festivalSlug) {
    return { kind: "festival", slug: festivalSlug };
  }

  const orgSlug = searchParams.get("org");
  if (orgSlug) {
    return { kind: "org", slug: orgSlug };
  }

  const artistSlug = searchParams.get("artist");
  if (artistSlug) {
    return { kind: "artist", slug: artistSlug };
  }

  return null;
}

export function hasDetailOverlayTarget(searchParams: SearchParamReader): boolean {
  return resolveDetailOverlayTarget(searchParams) !== null;
}

export function buildDetailCloseFallbackUrl(
  pathname: string,
  searchParams: SearchParamReader,
): string {
  const params = new URLSearchParams(searchParams.toString());
  for (const key of DETAIL_ENTRY_PARAM_KEYS) {
    params.delete(key);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
