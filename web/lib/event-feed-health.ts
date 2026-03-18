type EventWithId = {
  id: number;
  [key: string]: unknown;
};

type EventWithVenue = {
  venue?: {
    active?: boolean | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export function filterOutInactiveVenueEvents<T extends EventWithVenue>(
  events: T[],
): T[] {
  return events.filter((event) => event.venue?.active !== false);
}

export function dedupeEventsById<T extends EventWithId>(events: T[]): T[] {
  const seen = new Set<number>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

type EventWithVenueAndTime = {
  id: number;
  title?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  venue?: { name?: string | null; [key: string]: unknown } | null;
  [key: string]: unknown;
};

/**
 * Fuzzy dedup for recurring events from overlapping crawlers.
 * Keeps the first event per (venue_name + start_date + start_time + normalized_title).
 * "Karaoke at Sister Louisa's" and "Karaoke Night" at the same venue/time = duplicate.
 */
export function dedupeEventsFuzzy<T extends EventWithVenueAndTime>(
  events: T[],
): T[] {
  const seen = new Map<string, T>();
  return events.filter((event) => {
    const venueName = (
      (event.venue as { name?: string | null } | null)?.name ?? ""
    )
      .toLowerCase()
      .trim();
    const date = event.start_date ?? "";
    const time = event.start_time ?? "";
    const title = normalizeForDedup(String(event.title ?? ""));

    // Key: venue + date + time + normalized title
    const key = `${venueName}|${date}|${time}|${title}`;
    if (seen.has(key)) return false;
    seen.set(key, event);
    return true;
  });
}

/** Strip venue name suffixes and common filler words for dedup matching. */
function normalizeForDedup(title: string): string {
  let t = title.toLowerCase().trim();
  // Remove " at Venue Name" suffix (common in megacrawler titles)
  t = t.replace(/\s+at\s+[^|]+$/, "");
  // Remove "night" as it's commonly added/omitted
  t = t.replace(/\s*night\s*/g, " ");
  // Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

export function dedupeSectionEventsById<
  T extends EventWithId,
  S extends { events: T[] },
>(sections: S[]): S[] {
  const seen = new Set<number>();
  return sections.map((section) => ({
    ...section,
    events: section.events.filter((event) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    }),
  }));
}
