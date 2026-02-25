import { supabase } from "./supabase";
import {
  isSpotOpen,
  type HoursData,
  type Spot,
} from "./spots-constants";

export {
  VENUE_TYPES_MAP,
  EVENT_VENUE_TYPES,
  PLACE_VENUE_TYPES,
  DESTINATION_CATEGORIES,
  VIBE_GROUPS,
  VIBES,
  NEIGHBORHOODS,
  SPOT_TYPES,
  formatPriceLevel,
  getVenueTypeLabel,
  getVenueTypeLabels,
  getSpotTypeLabel,
  getSpotTypeLabels,
  INFERRED_CLOSING_TIMES,
  getInferredClosingTime,
  formatClosingTime,
  isSpotOpen,
} from "./spots-constants";

export type {
  VenueType,
  SpotType,
  DestinationCategory,
  SpotCategory,
  Vibe,
  Neighborhood,
  Spot,
  HoursData,
  OpenStatus,
} from "./spots-constants";

export async function getSpotBySlug(slug: string): Promise<Spot | null> {
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    console.error("Error fetching spot:", error);
    return null;
  }

  return data as Spot;
}

// Get spots that are currently open
export async function getOpenSpots(
  spotTypes?: string[],
  neighborhood?: string,
  limit = 20
): Promise<Spot[]> {
  let query = supabase
    .from("venues")
    .select("*")
    .eq("active", true)
    .order("name");

  if (spotTypes && spotTypes.length > 0) {
    const typeFilters = spotTypes.map(t => `venue_type.eq.${t},venue_types.cs.{${t}}`).join(",");
    query = query.or(typeFilters);
  }

  if (neighborhood) {
    query = query.eq("neighborhood", neighborhood);
  }

  query = query.limit(limit * 2);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching spots:", error);
    return [];
  }

  const addressNamePattern = /^\d+\s+[\w\s]+(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway|Hwy|Highway|Pike|Circle|Trail)\b/i;
  const openSpots = (data || []).filter((spot: Spot & { hours?: HoursData; is_24_hours?: boolean }) => {
    if (addressNamePattern.test(spot.name)) return false;
    const { isOpen } = isSpotOpen(spot.hours || null, spot.is_24_hours);
    return isOpen;
  });

  return openSpots.slice(0, limit) as Spot[];
}

export async function getNearbySpots(
  venueId: number,
  limit = 6
): Promise<Spot[]> {
  const { data: venue } = await supabase
    .from("venues")
    .select("neighborhood")
    .eq("id", venueId)
    .maybeSingle<{ neighborhood: string | null }>();

  if (!venue?.neighborhood) return [];

  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("neighborhood", venue.neighborhood)
    .neq("id", venueId)
    .in("venue_type", ["bar", "restaurant", "brewery", "cocktail_bar"])
    .eq("active", true)
    .limit(limit);

  if (error) {
    console.error("Error fetching nearby spots:", error);
    return [];
  }

  return (data || []) as Spot[];
}
