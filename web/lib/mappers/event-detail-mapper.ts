import type { EventApiResponse } from "@/components/views/EventDetailView";
import type { HeroTier } from "@/lib/detail/types";
import type { Event, EventWithProducer } from "@/lib/supabase";
import { getDisplayParticipants } from "@/lib/artists-utils";
import type { EventArtist } from "@/lib/artists-utils";
import { buildDisplayDescription } from "@/lib/event-description";
import {
  suppressEventImagesIfVenueFlagged,
} from "@/lib/image-quality-suppression";

/**
 * Determines the hero tier for an event detail page based on image quality signals.
 * Computed server-side to avoid layout shifts on the client.
 */
export function computeHeroTier(
  imageUrl: string | null,
  imageWidth: number | null,
  imageHeight: number | null,
  galleryUrls: string[],
): HeroTier {
  if (!imageUrl) return 'typographic';
  if (galleryUrls.length >= 2) return 'expanded';
  if (
    imageWidth != null &&
    imageHeight != null &&
    imageWidth >= 1200 &&
    imageWidth / imageHeight >= 1.3
  ) {
    return 'expanded';
  }
  return 'compact';
}

/**
 * Maps server-fetched event data (from getEventById + related fetches) to the
 * EventApiResponse shape expected by EventDetailView's initialData prop.
 *
 * This lets the SSR event page pass pre-fetched data into the client component,
 * eliminating a redundant client-side fetch while keeping a single rendering path.
 */
export function mapEventServerDataToViewData(
  event: EventWithProducer,
  eventArtists: EventArtist[],
  venueEvents: Event[],
  sameDateEvents: Event[],
  nearbyDestinations?: Record<string, Array<{ id: number; name: string; slug: string; place_type: string | null; neighborhood: string | null; distance?: number; image_url: string | null; hours?: Record<string, { open: string; close: string } | null> | null; vibes?: string[] | null }>>
): EventApiResponse {
  // Process display participants (de-duplication, headliner sorting, title filtering)
  const displayParticipants = getDisplayParticipants(eventArtists, {
    eventTitle: event.title,
    eventCategory: event.category,
  });

  // Compute display_description (artist-enriched or cleaned description)
  const displayDescription = buildDisplayDescription(event.description, displayParticipants, {
    eventTitle: event.title,
    eventGenres: event.genres,
    eventTags: event.tags,
    eventCategory: event.category,
  });

  // Compute is_live from current wall-clock time
  const now = new Date();
  const eventDate = new Date(event.start_date + "T00:00:00");
  const isToday = eventDate.toDateString() === now.toDateString();
  let isLive = false;
  if (isToday && event.start_time) {
    const [hours, minutes] = event.start_time.split(":").map(Number);
    const eventStart = new Date(eventDate);
    eventStart.setHours(hours, minutes, 0, 0);
    const eventEnd = new Date(eventStart);
    if (event.end_time) {
      const [endHours, endMinutes] = event.end_time.split(":").map(Number);
      eventEnd.setHours(endHours, endMinutes, 0, 0);
    } else {
      eventEnd.setHours(eventStart.getHours() + 3, eventStart.getMinutes(), 0, 0);
    }
    isLive = now >= eventStart && now <= eventEnd;
  }

  // Resolve image URL: event → series → venue fallback chain
  const resolvedImageUrl =
    event.image_url ||
    (event.series as { image_url?: string | null } | null)?.image_url ||
    event.venue?.image_url ||
    null;

  // Map event to EventData shape
  const mappedEvent: EventApiResponse["event"] = {
    id: event.id,
    title: event.title,
    description: event.description,
    display_description: displayDescription,
    start_date: event.start_date,
    start_time: event.start_time,
    doors_time: (event as { doors_time?: string | null }).doors_time ?? null,
    end_time: event.end_time,
    end_date: event.end_date,
    is_all_day: event.is_all_day,
    is_free: event.is_free,
    price_min: event.price_min,
    price_max: event.price_max,
    price_note: event.price_note,
    category: event.category,
    tags: event.tags,
    genres: event.genres,
    ticket_url: event.ticket_url,
    source_url: event.source_url,
    // Use resolved image (event → series → venue fallback)
    image_url: resolvedImageUrl,
    image_width: (event as { image_width?: number | null }).image_width ?? null,
    image_height: (event as { image_height?: number | null }).image_height ?? null,
    is_recurring: event.is_recurring ?? false,
    recurrence_rule: event.recurrence_rule ?? null,
    is_adult: (event as { is_adult?: boolean | null }).is_adult ?? null,
    age_policy: (event as { age_policy?: string | null }).age_policy ?? null,
    ticket_status: (event as { ticket_status?: string | null }).ticket_status ?? null,
    reentry_policy: (event as { reentry_policy?: string | null }).reentry_policy ?? null,
    set_times_mentioned: (event as { set_times_mentioned?: boolean | null }).set_times_mentioned ?? null,
    is_live: isLive,
    venue: event.venue
      ? {
          id: event.venue.id,
          name: event.venue.name,
          slug: event.venue.slug,
          address: event.venue.address,
          neighborhood: event.venue.neighborhood,
          city: event.venue.city,
          state: event.venue.state,
          vibes: event.venue.vibes ?? null,
          place_type: event.venue.place_type ?? null,
          nearest_marta_station: event.venue.nearest_marta_station ?? null,
          marta_walk_minutes: event.venue.marta_walk_minutes ?? null,
          marta_lines: event.venue.marta_lines ?? null,
          beltline_adjacent: event.venue.beltline_adjacent ?? null,
          beltline_segment: event.venue.beltline_segment ?? null,
          parking_type: event.venue.parking_type ?? null,
          parking_free: event.venue.parking_free ?? null,
          transit_score: event.venue.transit_score ?? null,
          lat: event.venue.lat ?? null,
          lng: event.venue.lng ?? null,
        }
      : null,
    producer: event.organization
      ? {
          id: event.organization.id,
          name: event.organization.name,
          slug: event.organization.slug,
          org_type: event.organization.org_type ?? null,
          website: event.organization.website,
          logo_url: event.organization.logo_url,
        }
      : null,
    series: event.series
      ? {
          id: event.series.id,
          title: event.series.title,
          slug: event.series.slug,
          series_type: event.series.series_type,
          festival: event.series.festival
            ? {
                id: event.series.festival.id,
                name: event.series.festival.name,
                slug: event.series.festival.slug,
                image_url: event.series.festival.image_url,
                festival_type: event.series.festival.festival_type ?? null,
                location: event.series.festival.location ?? null,
                neighborhood: event.series.festival.neighborhood ?? null,
              }
            : null,
        }
      : null,
  };

  // Map venue events → RelatedEvent[], with image suppression
  const suppressedVenueEvents = suppressEventImagesIfVenueFlagged(venueEvents);
  const mappedVenueEvents: EventApiResponse["venueEvents"] = suppressedVenueEvents.map((e) => ({
    id: e.id,
    title: e.title,
    start_date: e.start_date,
    end_date: e.end_date,
    start_time: e.start_time,
    end_time: e.end_time,
    category: e.category ?? null,
    is_free: e.is_free ?? false,
    price_min: e.price_min ?? null,
    venue: e.venue
      ? {
          id: e.venue.id,
          name: e.venue.name,
          slug: e.venue.slug,
          city: e.venue.city,
          neighborhood: e.venue.neighborhood ?? null,
          location_designator: e.venue.location_designator ?? undefined,
        }
      : null,
    going_count: 0,
    interested_count: 0,
    recommendation_count: 0,
  }));

  // Map same-date events → nearbyEvents (same shape)
  const suppressedSameDateEvents = suppressEventImagesIfVenueFlagged(sameDateEvents);
  const mappedNearbyEvents: EventApiResponse["nearbyEvents"] = suppressedSameDateEvents.map((e) => ({
    id: e.id,
    title: e.title,
    start_date: e.start_date,
    end_date: e.end_date,
    start_time: e.start_time,
    end_time: e.end_time,
    category: e.category ?? null,
    is_free: e.is_free ?? false,
    price_min: e.price_min ?? null,
    venue: e.venue
      ? {
          id: e.venue.id,
          name: e.venue.name,
          slug: e.venue.slug,
          city: e.venue.city,
          neighborhood: e.venue.neighborhood ?? null,
          location_designator: e.venue.location_designator ?? undefined,
        }
      : null,
    going_count: 0,
    interested_count: 0,
    recommendation_count: 0,
  }));

  return {
    event: mappedEvent,
    heroTier: computeHeroTier(
      resolvedImageUrl,
      (event as { image_width?: number | null }).image_width ?? null,
      (event as { image_height?: number | null }).image_height ?? null,
      [],
    ),
    eventArtists: displayParticipants,
    venueEvents: mappedVenueEvents,
    nearbyEvents: mappedNearbyEvents,
    nearbyDestinations: nearbyDestinations
      ? {
          food: nearbyDestinations.food ?? [],
          drinks: nearbyDestinations.drinks ?? [],
          nightlife: nearbyDestinations.nightlife ?? [],
          caffeine: nearbyDestinations.caffeine ?? [],
          fun: nearbyDestinations.fun ?? [],
        }
      : { food: [], drinks: [], nightlife: [], caffeine: [], fun: [] },
  };
}
