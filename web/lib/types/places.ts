/** Base place — maps to `venues` table (renamed to `places` in final deploy) */
export interface Place {
  id: number;
  slug: string;
  name: string;
  aliases: string[] | null;
  address: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  place_type: string; // mapped from venue_type during migration
  indoor_outdoor: "indoor" | "outdoor" | "both" | null;
  location_designator: string;
  website: string | null;
  phone: string | null;
  image_url: string | null;
  hours: Record<string, unknown> | null;
  owner_portal_id: number | null;
  google_place_id: string | null;
  is_active: boolean; // mapped from `active` during migration
  created_at: string;
  updated_at: string;
}

/** Minimal card type — used in listings, feed sections, search results */
export type PlaceCard = Pick<
  Place,
  | "id"
  | "slug"
  | "name"
  | "neighborhood"
  | "place_type"
  | "image_url"
  | "hours"
  | "lat"
  | "lng"
>;

/** Profile enrichment from place_profile table */
export interface PlaceProfile {
  place_id: number; // venue_id in DB during migration
  description: string | null;
  short_description: string | null;
  hero_image_url: string | null;
  gallery_urls: string[] | null;
  featured: boolean;
  explore_category: string | null;
  explore_blurb: string | null;
  parking_type: string | null;
  parking: string | null;
  transit_accessible: boolean | null;
  transit_notes: string | null;
  capacity: number | null;
  planning_notes: string | null;
  planning_last_verified_at: string | null;
  wheelchair_accessible: boolean | null;
  family_suitability: "yes" | "no" | "caution" | null;
  age_min: number | null;
  age_max: number | null;
  sensory_notes: string | null;
  accessibility_notes: string | null;
  library_pass: Record<string, unknown> | null;
  last_verified_at: string | null;
}

/** Dining vertical JSONB from place_vertical_details.dining */
export interface PlaceDiningDetails {
  cuisine: string[];
  service_style: string | null;
  price_range: number | null;
  menu_url: string | null;
  reservation_url: string | null;
  accepts_reservations: boolean | null;
  reservation_recommended: boolean | null;
  meal_duration_min_minutes: number | null;
  meal_duration_max_minutes: number | null;
  walk_in_wait_minutes: number | null;
  payment_buffer_minutes: number | null;
  serves_vegetarian: boolean | null;
  serves_vegan: boolean | null;
  diabetic_friendly: boolean | null;
  low_sodium_options: boolean | null;
  heart_healthy_options: boolean | null;
  serves_breakfast: boolean | null;
  serves_brunch: boolean | null;
  serves_lunch: boolean | null;
  serves_dinner: boolean | null;
  outdoor_seating: boolean | null;
  delivery: boolean | null;
  dine_in: boolean | null;
  takeout: boolean | null;
  reservable: boolean | null;
  dietary_options: string | null;
  menu_highlights: string | null;
  payment_notes: string | null;
}

/** Outdoor/adventure vertical JSONB from place_vertical_details.outdoor */
export interface PlaceOutdoorDetails {
  destination_type: string | null;
  commitment_tier: "hour" | "halfday" | "fullday" | "weekend" | null;
  primary_activity: string | null;
  drive_time_minutes: number | null;
  difficulty_level: "easy" | "moderate" | "hard" | "expert" | null;
  trail_length_miles: number | null;
  elevation_gain_ft: number | null;
  surface_type: string | null;
  best_seasons: string[] | null;
  weather_fit_tags: string[] | null;
  practical_notes: string | null;
  conditions_notes: string | null;
  best_time_of_day: "morning" | "afternoon" | "evening" | "any" | null;
  dog_friendly: boolean | null;
  reservation_required: boolean | null;
  permit_required: boolean | null;
  fee_note: string | null;
  seasonal_hazards: string[] | null;
}

/** Google Places enrichment JSONB from place_vertical_details.google */
export interface PlaceGoogleDetails {
  place_id: string | null;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  types: string[] | null;
  google_maps_url: string | null;
  enriched_at: string | null;
}

/** Composed types for different rendering contexts */
export type PlaceWithProfile = Place & { profile: PlaceProfile | null };
export type PlaceWithDining = Place & { dining: PlaceDiningDetails | null };
export type PlaceWithOutdoor = Place & { outdoor: PlaceOutdoorDetails | null };
export type PlaceDetail = Place & {
  profile: PlaceProfile | null;
  dining: PlaceDiningDetails | null;
  outdoor: PlaceOutdoorDetails | null;
  google: PlaceGoogleDetails | null;
};
