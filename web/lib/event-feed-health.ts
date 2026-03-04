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
