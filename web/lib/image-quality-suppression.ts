// The explore_tracks_insufficient_flags.json file was removed as part of the
// Emory portal archive. Image quality suppression now relies only on the manual
// blocklist below. Restore the JSON import when a new quality audit is run.

type VenueLike = {
  slug?: string | null;
  image_url?: string | null;
  hero_image_url?: string | null;
};

type EventLike = {
  image_url?: string | null;
  venue?: { slug?: string | null } | null;
};

const MANUAL_BAD_IMAGE_VENUES = new Set<string>();

const LOW_QUALITY_VENUE_SLUGS = (() => {
  const slugs = new Set<string>();
  for (const slug of MANUAL_BAD_IMAGE_VENUES) slugs.add(slug);
  return slugs;
})();

export function shouldSuppressImageForVenueSlug(
  venueSlug: string | null | undefined,
): boolean {
  const normalized = (venueSlug || "").trim().toLowerCase();
  return normalized.length > 0 && LOW_QUALITY_VENUE_SLUGS.has(normalized);
}

export function suppressVenueImagesIfFlagged<T extends VenueLike>(venue: T): T {
  if (!shouldSuppressImageForVenueSlug(venue.slug)) return venue;
  if (!venue.image_url && !venue.hero_image_url) return venue;
  return {
    ...venue,
    image_url: null,
    hero_image_url: null,
  };
}

export function suppressEventImageIfVenueFlagged<T extends EventLike>(
  event: T,
): T {
  if (!event.image_url) return event;
  if (!shouldSuppressImageForVenueSlug(event.venue?.slug)) return event;
  return {
    ...event,
    image_url: null,
  };
}

export function suppressEventImagesIfVenueFlagged<T extends EventLike>(
  events: T[],
): T[] {
  let changed = false;
  const next = events.map((event) => {
    const sanitized = suppressEventImageIfVenueFlagged(event);
    if (sanitized !== event) changed = true;
    return sanitized;
  });
  return changed ? next : events;
}
