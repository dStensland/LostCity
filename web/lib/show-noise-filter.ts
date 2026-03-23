/**
 * Shared noise filtering constants for show/event APIs.
 * Used by: /api/whats-on/music, /api/whats-on/stage, /api/portals/[slug]/shows
 */

export const NOISE_TITLE_PATTERNS = [
  "bingo", "trivia", "game night", "language learning",
  "book club", "pop up", "pop-up", "popup",
  "tax aide", "tax help", "story time",
];

export const EXCLUDED_VENUE_TYPES = new Set([
  "library", "recreation", "school", "government", "religious",
]);

/**
 * Returns true if the event should be excluded (is noise).
 */
export function isNoiseEvent(title: string, venueType: string | null): boolean {
  if (EXCLUDED_VENUE_TYPES.has(venueType ?? "")) return true;
  const lower = title.toLowerCase();
  return NOISE_TITLE_PATTERNS.some((p) => lower.includes(p));
}
