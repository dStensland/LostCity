import type { SectionId } from "@/lib/detail/types";

// ─── Subtype Manifests ────────────────────────────────────────────

// `connections` and `nearby` were temporarily removed during the place
// detail rebuild because data was sparse (~26% coverage on walkable_neighbors).
// Re-enabled 2026-04-17 after PostGIS backfill: walkable_neighbors now covers
// 78% of active places and the count denorm is resynced. Sections that lack
// data fall through their own trait checks and render nothing.

const cinemaManifest: SectionId[] = [
  "showtimes",
  "about",
  "connections",
  "eventsAtVenue",
  "features",
  "planYourVisit",
  "nearby",
];

const restaurantManifest: SectionId[] = [
  "dining",
  "about",
  "occasions",
  "specials",
  "eventsAtVenue",
  "accolades",
  "connections",
  "nearby",
];

const museumManifest: SectionId[] = [
  "exhibitions",
  "about",
  "features",
  "planYourVisit",
  "eventsAtVenue",
  "socialProof",
  "accolades",
  "connections",
  "nearby",
];

const barManifest: SectionId[] = [
  "eventsAtVenue",
  "about",
  "occasions",
  "specials",
  "accolades",
  "connections",
  "nearby",
];

const parkManifest: SectionId[] = [
  "features",
  "about",
  "eventsAtVenue",
  "planYourVisit",
  "accolades",
  "connections",
  "nearby",
];

const musicVenueManifest: SectionId[] = [
  "eventsAtVenue",
  "about",
  "occasions",
  "specials",
  "features",
  "connections",
  "nearby",
];

// ─── Spot Type → Manifest Group Mapping ──────────────────────────

type PlaceSubtype = "cinema" | "restaurant" | "museum" | "bar" | "park" | "musicVenue";

const SUBTYPE_MAP: Record<string, PlaceSubtype> = {
  // Cinema
  movie_theater: "cinema",
  cinema: "cinema",
  drive_in_theater: "cinema",

  // Restaurant
  restaurant: "restaurant",
  cafe: "restaurant",
  bakery: "restaurant",
  food_hall: "restaurant",
  food_truck: "restaurant",

  // Museum / Gallery
  museum: "museum",
  gallery: "museum",
  arts_center: "museum",
  historic_site: "museum",
  science_center: "museum",

  // Bar / Nightclub
  bar: "bar",
  nightclub: "bar",
  lounge: "bar",
  sports_bar: "bar",
  wine_bar: "bar",
  brewery: "bar",
  distillery: "bar",

  // Park / Garden
  park: "park",
  garden: "park",
  nature_preserve: "park",
  recreation: "park",
  trail: "park",

  // Music Venue
  music_venue: "musicVenue",
  amphitheater: "musicVenue",
  stadium: "musicVenue",
  theater: "musicVenue",
  event_space: "musicVenue",
};

const SUBTYPE_MANIFESTS: Record<PlaceSubtype, SectionId[]> = {
  cinema: cinemaManifest,
  restaurant: restaurantManifest,
  museum: museumManifest,
  bar: barManifest,
  park: parkManifest,
  musicVenue: musicVenueManifest,
};

// ─── Resolver ────────────────────────────────────────────────────

export function getPlaceManifest(placeType: string): SectionId[] {
  const subtype = SUBTYPE_MAP[placeType] ?? "musicVenue";
  return SUBTYPE_MANIFESTS[subtype];
}
