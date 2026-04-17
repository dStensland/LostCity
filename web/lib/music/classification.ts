import type { CapacityBand, MusicDisplayTier, MusicProgrammingStyle } from "./types";

export const GHOST_VENUE_LOOKBACK_DAYS = 14;

export interface ClassifiableVenue {
  music_programming_style: MusicProgrammingStyle | null;
  capacity: number | null;
}

export function classifyMusicVenue(v: ClassifiableVenue): MusicDisplayTier {
  if (v.music_programming_style) return "editorial";
  if (v.capacity != null && v.capacity >= 1000) return "marquee";
  return "additional";
}

export function capacityBand(capacity: number | null): CapacityBand | null {
  if (capacity == null) return null;
  if (capacity < 300) return "intimate";
  if (capacity < 1000) return "club";
  if (capacity <= 3000) return "theater";
  return "arena";
}

// Filter out venues with no shows in the lookback window unless user has pinned them.
export function filterGhostVenues<T extends { venue: { slug: string }; shows: unknown[] }>(
  groups: T[],
  opts: { pinned?: Set<string> } = {},
): T[] {
  return groups.filter((g) => g.shows.length > 0 || opts.pinned?.has(g.venue.slug));
}
