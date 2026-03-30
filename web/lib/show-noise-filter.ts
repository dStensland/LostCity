/**
 * Shared noise filtering constants for show/event APIs.
 * Used by: /api/whats-on/music, /api/whats-on/stage, /api/portals/[slug]/shows
 */

export const NOISE_TITLE_PATTERNS = [
  // Games & recreation
  "bingo", "trivia", "game night", "board game",
  "mtg ", "mtg:", "magic the gathering", "commander league",
  "ttrpg", "tabletop", "d&d", "dungeons",
  "mahjong", "mah jong", "chess night",
  "bocce", "bowling", "duckpin", "skee-ball", "skeeball",
  "cornhole", "shuffleboard", "pool league", "billiards",
  // Not shows
  "pro wrestling", "wrestling show",
  "drone show", "light show",
  "skating", "skate night", "roller skate",
  "open gym", "pickup basketball", "rec league",
  // Education/community
  "language learning", "book club",
  "pop up", "pop-up", "popup",
  "tax aide", "tax help", "story time",
  "welding", "moms morning out",
  "family tour", "weekend family",
];

export const EXCLUDED_VENUE_TYPES = new Set([
  "library", "recreation", "recreation_center", "school", "government", "religious",
  "community_center", "institution",
]);

/**
 * Returns true if the event should be excluded (is noise).
 */
export function isNoiseEvent(title: string, venueType: string | null): boolean {
  if (EXCLUDED_VENUE_TYPES.has(venueType ?? "")) return true;
  const lower = title.toLowerCase();
  return NOISE_TITLE_PATTERNS.some((p) => lower.includes(p));
}
