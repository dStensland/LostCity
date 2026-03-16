type VenueLike =
  | {
      name?: string | null;
      slug?: string | null;
    }
  | null
  | undefined;

const INDIE_CINEMA_PATTERNS = [
  /\bplaza theatre\b/i,
  /\btara\b/i,
  /\bstarlight\b/i,
  /\blandmark\b/i,
  /\bbelcourt\b/i,
  /\barthouse\b/i,
  /\bart house\b/i,
];

const CHAIN_CINEMA_PATTERNS = [
  /\bamc\b/i,
  /\bregal\b/i,
  /\bcinemark\b/i,
  /\bcmx\b/i,
  /\bncg\b/i,
  /\bsprings[-\s]cinema\b/i,
  /\bmovie tavern\b/i,
  /\bcinepolis\b/i,
  /\blook cinemas?\b/i,
];

export function isRegularShowtimeEvent(
  tags: string[] | null | undefined,
): boolean {
  return Boolean(tags?.includes("showtime"));
}

export function isChainCinemaVenue(venue: VenueLike): boolean {
  if (!venue) return false;

  const haystack = [venue.name ?? "", venue.slug ?? ""].join(" ").trim();
  if (!haystack) return false;

  // Indie/arthouse venues should never be suppressed as chain cinema.
  if (INDIE_CINEMA_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return false;
  }

  return CHAIN_CINEMA_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function isIndieCinemaVenue(venue: VenueLike): boolean {
  if (!venue) return false;
  const haystack = [venue.name ?? "", venue.slug ?? ""].join(" ").trim();
  return INDIE_CINEMA_PATTERNS.some((p) => p.test(haystack));
}

export function getIndieCinemaPriority(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("plaza")) return 0;
  if (n.includes("tara")) return 1;
  if (n.includes("starlight")) return 2;
  if (n.includes("landmark")) return 3;
  return 10;
}

export function shouldSuppressChainShowtime(
  tags: string[] | null | undefined,
  venue: VenueLike,
): boolean {
  return isRegularShowtimeEvent(tags) && isChainCinemaVenue(venue);
}

/**
 * Minimum shape required for cinema deduplication.
 * Deliberately loose so the function works across the timeline, search,
 * and any other event list without needing a specific import.
 */
export interface CinemaDedupEvent {
  title: string;
  start_date: string;
  start_time?: string | null;
  category_id?: string | null;
  /** category field is an alias used in some query shapes */
  category?: string | null;
  image_url?: string | null;
  venue_id?: number | null;
  tags?: string[] | null;
}

/**
 * Deduplicates cinema showtime events so the feed shows one card per film
 * per day instead of one card per showtime per theater.
 *
 * Only events tagged "showtime" (i.e. regular cinema showtimes) are collapsed.
 * Indie/arthouse screenings, special events, and one-off screenings are left
 * as individual cards.
 *
 * The representative event for each film group is chosen by:
 *   1. Prefer an event with an image
 *   2. Then prefer the earliest showtime
 *
 * Two extra fields are mixed into the representative:
 *   - `_showtime_count`: total number of showtimes collapsed
 *   - `_venue_count`: number of distinct venues they span
 *
 * Non-cinema events pass through untouched and their order is preserved.
 * Cinema groups are inserted at the position of their representative event.
 */
export function deduplicateCinemaEvents<T extends CinemaDedupEvent>(
  events: T[]
): (T & { _showtime_count?: number; _venue_count?: number })[] {
  // Fast path — nothing to deduplicate
  if (events.length === 0) return events;

  // Separate showtime events from everything else.
  // We use isRegularShowtimeEvent to gate on the "showtime" tag so that
  // special screenings, film festival entries, and other film-category events
  // are NOT collapsed.
  const showtimeIndices: number[] = [];
  const nonShowtimeIndices: number[] = [];

  for (let i = 0; i < events.length; i++) {
    if (isRegularShowtimeEvent(events[i].tags)) {
      showtimeIndices.push(i);
    } else {
      nonShowtimeIndices.push(i);
    }
  }

  // If no showtimes present, return unchanged
  if (showtimeIndices.length === 0) return events;

  // Group showtime events by (normalised title, start_date)
  // Track the original index of the *first* event in each group so we can
  // re-insert the representative at the correct sort position.
  const groupMap = new Map<
    string,
    { events: T[]; firstIndex: number }
  >();

  for (const idx of showtimeIndices) {
    const e = events[idx];
    const key = `${e.title.toLowerCase().trim()}|${e.start_date}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.events.push(e);
    } else {
      groupMap.set(key, { events: [e], firstIndex: idx });
    }
  }

  // Build the deduped showtime list, preserving the firstIndex for sorting
  const dedupedShowtimes: (T & {
    _showtime_count?: number;
    _venue_count?: number;
    _firstIndex: number;
  })[] = [];

  for (const { events: group, firstIndex } of groupMap.values()) {
    // Pick the representative: image wins, then earliest time
    const sorted = group.slice().sort((a, b) => {
      if (a.image_url && !b.image_url) return -1;
      if (!a.image_url && b.image_url) return 1;
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });
    const rep = sorted[0];
    const venueCount = new Set(
      group.map((e) => e.venue_id).filter((id) => id != null)
    ).size;
    dedupedShowtimes.push({
      ...rep,
      _showtime_count: group.length,
      _venue_count: venueCount,
      _firstIndex: firstIndex,
    });
  }

  // Merge non-showtime events (with their original indices) and deduped showtimes,
  // then re-sort by original index to preserve feed order.
  type Slotted = (T & { _showtime_count?: number; _venue_count?: number }) & {
    _firstIndex: number;
  };

  const allSlotted: Slotted[] = [
    ...nonShowtimeIndices.map((idx) => ({
      ...(events[idx] as T & { _showtime_count?: number; _venue_count?: number }),
      _firstIndex: idx,
    })),
    ...dedupedShowtimes,
  ];

  allSlotted.sort((a, b) => a._firstIndex - b._firstIndex);

  // Strip the internal _firstIndex before returning
  return allSlotted.map(({ _firstIndex: _fi, ...rest }) => rest as T & { _showtime_count?: number; _venue_count?: number });
}
