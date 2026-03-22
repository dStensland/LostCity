/** Apply venue image fallback to events that have no image */
export function applyImageFallback<
  T extends {
    image_url: string | null;
    venues?: { image_url?: string | null; hero_image_url?: string | null } | null;
    venue?: { image_url?: string | null; hero_image_url?: string | null } | null;
  },
>(event: T): T {
  if (!event.image_url) {
    // Support both `venues` (direct join alias) and `venue` (aliased join)
    const venueData = event.venues ?? event.venue;
    if (venueData) {
      return {
        ...event,
        image_url: venueData.image_url || venueData.hero_image_url || null,
      };
    }
  }
  return event;
}

export function applyImageFallbacks<T extends Parameters<typeof applyImageFallback>[0]>(
  events: T[],
): T[] {
  return events.map(applyImageFallback);
}
