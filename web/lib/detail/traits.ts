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
      return !!(data.payload.screenings || data.payload.upcomingEvents?.length > 0);
    case "series":
      return !!(data.payload.series.festival || data.payload.venueShowtimes?.length > 1);
    case "festival":
      return data.payload.programs?.length > 0;
    case "org":
      return data.payload.events?.length > 0;
  }
}

export function hasSocialData(data: EntityData): boolean {
  // Social proof requires client-side fetch — trait always returns true for allowed types.
  // The section component handles the empty state internally.
  return data.entityType === "event" || data.entityType === "place";
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
      return !!data.payload.festival.location;
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
  return !!(profile?.typical_price_min != null || profile?.typical_duration_minutes != null);
}

export function hasAccessibility(data: EntityData): boolean {
  if (data.entityType !== "place") return false;
  const google = data.payload.placeVerticalDetails?.google as Record<string, unknown> | null | undefined;
  return !!(google?.wheelchair_accessible_entrance != null);
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
  if (data.entityType === "event") return !!data.payload.event.producer;
  if (data.entityType === "festival") return true; // festivals always have a presenting org conceptually
  return false;
}
