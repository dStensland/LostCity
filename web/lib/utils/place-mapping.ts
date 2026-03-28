import type { Place, PlaceCard } from "../types/places";

/** Maps a venue DB row to Place type during migration period.
 *  Handles both old (venue_type, active) and new (place_type, is_active) column names. */
export function mapVenueToPlace(row: Record<string, unknown>): Place {
  return {
    ...row,
    place_type: (row.venue_type ?? row.place_type ?? "other") as string,
    is_active: (row.active ?? row.is_active ?? true) as boolean,
  } as Place;
}

/** Maps a venue DB row to PlaceCard for listings */
export function mapVenueToPlaceCard(row: Record<string, unknown>): PlaceCard {
  return {
    id: row.id as number,
    slug: row.slug as string,
    name: row.name as string,
    neighborhood: (row.neighborhood ?? null) as string | null,
    place_type: (row.venue_type ?? row.place_type ?? "other") as string,
    image_url: (row.image_url ?? null) as string | null,
    hours: (row.hours ?? null) as Record<string, unknown> | null,
    lat: (row.lat ?? null) as number | null,
    lng: (row.lng ?? null) as number | null,
  };
}
