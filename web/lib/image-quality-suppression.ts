import insufficientFlags from "@/content/explore_tracks_insufficient_flags.json";

type InsufficientRow = {
  venue_slug?: string | null;
  flags?: string[];
};

type InsufficientFlagsPayload = {
  insufficient_rows?: InsufficientRow[];
};

type VenueLike = {
  slug?: string | null;
  image_url?: string | null;
  hero_image_url?: string | null;
};

type EventLike = {
  image_url?: string | null;
  venue?: { slug?: string | null } | null;
};

const payload = insufficientFlags as InsufficientFlagsPayload;
const MANUAL_BAD_IMAGE_VENUES = new Set<string>();

const LOW_QUALITY_VENUE_SLUGS = (() => {
  const slugs = new Set<string>();
  for (const row of payload.insufficient_rows || []) {
    const venueSlug = (row.venue_slug || "").trim().toLowerCase();
    if (!venueSlug) continue;
    if ((row.flags || []).includes("low_quality_image")) {
      slugs.add(venueSlug);
    }
  }
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
