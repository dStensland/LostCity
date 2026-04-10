/**
 * Music venue quality filter — separates devoted music venues from
 * places that occasionally host live music.
 *
 * Primary venues (music_venue, nightclub, arena, etc.) always qualify.
 * Borderline venues (bar, restaurant, event_space, etc.) must meet a
 * minimum event threshold to prove they're music-focused.
 */

/** Venue types that are inherently music-devoted — always show */
const PRIMARY_MUSIC_VENUE_TYPES = new Set([
  "music_venue",
  "nightclub",
  "arena",
  "concert_hall",
  "theater",
  "comedy_club",
  "festival",
]);

/** Venue types that can qualify with enough music content */
const BORDERLINE_MUSIC_VENUE_TYPES = new Set([
  "bar",
  "restaurant",
  "brewery",
  "distillery",
  "winery",
  "event_space",
  "hotel",
  "rooftop",
  "sports_bar",
  "food_hall",
  "venue",
]);

/** Minimum music events in the query window for borderline venues to qualify */
const BORDERLINE_MIN_EVENTS = 2;

export function isPrimaryMusicVenue(placeType: string | null): boolean {
  return PRIMARY_MUSIC_VENUE_TYPES.has(placeType ?? "");
}

/**
 * Filter grouped venue results for the music tab.
 * Primary venues always pass. Borderline venues need >= BORDERLINE_MIN_EVENTS.
 * Excluded venue types (library, school, etc.) are already filtered by isNoiseEvent.
 */
export function filterMusicVenues<T extends { venue: { place_type?: string | null }; shows: unknown[] }>(
  venueGroups: T[],
): T[] {
  return venueGroups.filter((group) => {
    const placeType = group.venue.place_type ?? null;

    // Primary music venues always qualify
    if (isPrimaryMusicVenue(placeType)) return true;

    // Borderline venues need enough content to prove music focus
    if (BORDERLINE_MUSIC_VENUE_TYPES.has(placeType ?? "")) {
      return group.shows.length >= BORDERLINE_MIN_EVENTS;
    }

    // Unknown/other types: apply the same threshold
    return group.shows.length >= BORDERLINE_MIN_EVENTS;
  });
}
