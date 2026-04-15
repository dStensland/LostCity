// web/lib/detail/traits.ts
import type { EntityData } from "./types";

export function hasDescription(data: EntityData): boolean {
  switch (data.entityType) {
    case "event":
      return !!(data.payload.event.description || data.payload.event.display_description);
    case "place":
      return !!(data.payload.spot as Record<string, unknown>).description;
    case "series":
      return !!data.payload.series.description;
    case "festival":
      return !!data.payload.festival.description;
    case "org":
      return !!data.payload.organization.description;
  }
}

export function hasArtists(data: EntityData): boolean {
  return data.entityType === "event" && data.payload.eventArtists?.length > 0;
}

export function hasScreenings(data: EntityData): boolean {
  switch (data.entityType) {
    case "place":
      return !!data.payload.screenings;
    case "series":
      return data.payload.series.series_type === "film" && data.payload.venueShowtimes?.length > 0;
    case "festival":
      return !!data.payload.screenings;
    default:
      return false;
  }
}

export function hasDiningProfile(data: EntityData): boolean {
  return data.entityType === "place" && !!data.payload.placeVerticalDetails?.dining;
}

export function hasExhibitions(data: EntityData): boolean {
  if (data.entityType === "place") {
    return data.payload.exhibitions?.length > 0;
  }
  if (data.entityType === "festival") {
    return data.payload.programs?.some((p) => p.sessions?.length > 0) ?? false;
  }
  return false;
}

export function hasPrograms(data: EntityData): boolean {
  return data.entityType === "festival" && data.payload.programs?.length > 0;
}

export function hasUpcomingEvents(data: EntityData): boolean {
  switch (data.entityType) {
    case "place":
      return data.payload.upcomingEvents?.length > 0;
    case "org":
      return data.payload.events?.length > 0;
    default:
      return false;
  }
}

export function hasFeatures(data: EntityData): boolean {
  if (data.entityType !== "place") return false;
  const features = data.payload.features as Array<{ feature_type?: string }>;
  return features?.some((f) =>
    ["attraction", "exhibition", "collection", "experience"].includes(f.feature_type ?? "")
  ) ?? false;
}

export function hasConnections(data: EntityData): boolean {
  switch (data.entityType) {
    case "event":
      return !!(data.payload.event.venue || data.payload.event.series || data.payload.event.producer);
    case "place":
      // Only screenings produce connection rows — upcomingEvents alone don't
      return !!data.payload.screenings;
    case "series":
      return !!(data.payload.series.festival || data.payload.venueShowtimes?.length > 1);
    case "festival":
      return data.payload.programs?.length > 0;
    case "org":
      return data.payload.events?.length > 0;
  }
}

export function hasSocialData(data: EntityData): boolean {
  // Social proof only works for events (needs eventId for attendance query).
  // Place social proof is not yet implemented — don't over-promise.
  return data.entityType === "event";
}

export function hasLocation(data: EntityData): boolean {
  switch (data.entityType) {
    case "event":
      return !!data.payload.event.venue?.address;
    case "place":
      return !!(data.payload.spot as Record<string, unknown>).address;
    case "series":
      return data.payload.venueShowtimes?.length === 1 && !!(data.payload.venueShowtimes[0].venue as Record<string, unknown>).address;
    case "festival":
      // GettingThereSection doesn't render for festivals yet — don't over-promise
      return false;
    default:
      return false;
  }
}

export function hasCoordinates(data: EntityData): boolean {
  switch (data.entityType) {
    case "event":
      return !!(data.payload.event.venue?.lat && data.payload.event.venue?.lng);
    case "place": {
      const spot = data.payload.spot as Record<string, unknown>;
      return !!(spot.lat && spot.lng);
    }
    default:
      return false;
  }
}

export function hasAdmission(data: EntityData): boolean {
  if (data.entityType !== "place") return false;
  const profile = data.payload.placeProfile as Record<string, unknown> | null;
  const google = data.payload.placeVerticalDetails?.google as Record<string, unknown> | null | undefined;
  // Aligned with what PlanYourVisitSection actually checks
  return !!(
    profile?.planning_notes != null ||
    profile?.planning_last_verified_at != null ||
    google?.price_level != null
  );
}

export function hasAccessibility(data: EntityData): boolean {
  if (data.entityType !== "place") return false;
  const profile = data.payload.placeProfile as Record<string, unknown> | null;
  // Aligned with what PlanYourVisitSection actually checks
  return !!(
    profile?.wheelchair_accessible != null ||
    profile?.family_suitability != null ||
    profile?.age_min != null ||
    profile?.age_max != null ||
    profile?.sensory_notes != null ||
    profile?.accessibility_notes != null
  );
}

export function hasSpecials(data: EntityData): boolean {
  return data.entityType === "place" && data.payload.specials?.length > 0;
}

export function hasOccasions(data: EntityData): boolean {
  return data.entityType === "place" && data.payload.occasions?.length > 0;
}

export function hasEditorialMentions(data: EntityData): boolean {
  return data.entityType === "place" && data.payload.editorialMentions?.length > 0;
}

export function hasShowSignals(data: EntityData): boolean {
  if (data.entityType !== "event") return false;
  const e = data.payload.event;
  return !!(e.doors_time || e.age_policy || e.reentry_policy || e.set_times_mentioned || e.ticket_status);
}

export function hasVolunteerOpportunities(data: EntityData): boolean {
  return data.entityType === "org" && data.payload.volunteer_opportunities?.length > 0;
}

export function hasProducer(data: EntityData): boolean {
  // Only events have producer data in the payload. Festivals conceptually have
  // a presenting org but ProducerSection doesn't handle that case yet.
  if (data.entityType === "event") return !!data.payload.event.producer;
  return false;
}
