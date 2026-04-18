import type { CapacityBand, MusicDisplayTier, MusicProgrammingStyle } from "./types";

export const GHOST_VENUE_LOOKBACK_DAYS = 14;

export interface ClassifiableVenue {
  music_programming_style: MusicProgrammingStyle | null;
  capacity: number | null;
}

export function classifyMusicVenue(v: ClassifiableVenue): MusicDisplayTier {
  // 'marquee' is the explicit programming-style for arena/theater-tier music
  // venues that aren't editorial-curated (Tabernacle, Coca-Cola Roxy, Fox,
  // State Farm Arena, etc.). Backfilled in 20260417000003.
  if (v.music_programming_style === "marquee") return "marquee";
  if (v.music_programming_style) return "editorial";
  // Capacity fallback kept as a defense for any future marquee-class venue
  // whose style hasn't been explicitly seeded yet.
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
