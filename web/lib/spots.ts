import { supabase } from "./supabase";
import type { Event } from "./supabase";
import { getLocalDateString } from "@/lib/formats";
import {
  isSpotOpen,
  EVENT_VENUE_TYPES,
  PLACE_VENUE_TYPES,
  type SpotCategory,
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
  getSpotOpenStatus,
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

export async function getSpots(type?: string): Promise<Spot[]> {
  let query = supabase
    .from("venues")
    .select("*")
    .order("name");

  if (type && type !== "all") {
    query = query.or(`venue_type.eq.${type},venue_types.cs.{${type}}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching spots:", error);
    return [];
  }

  return (data || []) as Spot[];
}

export async function getSpotsWithEventCounts(
  type?: string,
  vibe?: string,
  neighborhood?: string,
  search?: string,
  category?: SpotCategory
): Promise<Spot[]> {
  const today = getLocalDateString();

  // Get all venues
  let venueQuery = supabase.from("venues").select("*").order("name");

  // Support multiple types separated by comma
  if (type && type !== "all") {
    const types = type.split(",").filter(Boolean);
    if (types.length === 1) {
      venueQuery = venueQuery.or(`venue_type.eq.${types[0]},venue_types.cs.{${types[0]}}`);
    } else if (types.length > 1) {
      // Build OR query for multiple types
      const typeConditions = types.map(t => `venue_type.eq.${t}`).join(",");
      venueQuery = venueQuery.or(typeConditions);
    }
  } else if (category === "venues") {
    // Filter to event venues only
    venueQuery = venueQuery.in("venue_type", [...EVENT_VENUE_TYPES]);
  } else if (category === "places") {
    // Filter to places/amenities only
    venueQuery = venueQuery.in("venue_type", [...PLACE_VENUE_TYPES]);
  }

  if (vibe) {
    // Support multiple vibes separated by comma
    const vibes = vibe.split(",").filter(Boolean);
    for (const v of vibes) {
      venueQuery = venueQuery.contains("vibes", [v]);
    }
  }

  // Support multiple neighborhoods separated by comma
  if (neighborhood && neighborhood !== "all") {
    const hoods = neighborhood.split(",").filter(Boolean);
    if (hoods.length === 1) {
      venueQuery = venueQuery.eq("neighborhood", hoods[0]);
    } else if (hoods.length > 1) {
      venueQuery = venueQuery.in("neighborhood", hoods);
    }
  }

  // Apply text search filter
  if (search?.trim()) {
    const searchTerm = `%${search.trim()}%`;
    venueQuery = venueQuery.or(
      `name.ilike.${searchTerm},description.ilike.${searchTerm},neighborhood.ilike.${searchTerm}`
    );
  }

  const { data: venues, error: venueError } = await venueQuery;

  if (venueError || !venues) {
    console.error("Error fetching venues:", venueError);
    return [];
  }

  // Get event counts per venue
  const { data: eventCounts, error: countError } = await supabase
    .from("events")
    .select("venue_id")
    .gte("start_date", today);

  if (countError) {
    console.error("Error fetching event counts:", countError);
    return venues as Spot[];
  }

  // Count events per venue
  const countMap = new Map<number, number>();
  for (const event of (eventCounts || []) as { venue_id: number | null }[]) {
    if (event.venue_id) {
      countMap.set(event.venue_id, (countMap.get(event.venue_id) || 0) + 1);
    }
  }

  // Merge counts into venues and sort by event count
  const typedVenues = venues as Spot[];
  const spotsWithCounts = typedVenues.map((venue) => ({
    ...venue,
    event_count: countMap.get(venue.id) || 0,
  }));

  // Sort by event count descending, then by name
  spotsWithCounts.sort((a, b) => {
    if ((b.event_count || 0) !== (a.event_count || 0)) {
      return (b.event_count || 0) - (a.event_count || 0);
    }
    return a.name.localeCompare(b.name);
  });

  return spotsWithCounts;
}

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

export async function getUpcomingEventsForSpot(
  venueId: number,
  limit = 10
): Promise<Event[]> {
  const today = getLocalDateString();

  const { data, error } = await supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state)
    `
    )
    .eq("venue_id", venueId)
    .or(`start_date.gte.${today},end_date.gte.${today}`)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching events for spot:", error);
    return [];
  }

  return (data || []) as Event[];
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
    // Filter by venue types
    const typeFilters = spotTypes.map(t => `venue_type.eq.${t},venue_types.cs.{${t}}`).join(",");
    query = query.or(typeFilters);
  }

  if (neighborhood) {
    query = query.eq("neighborhood", neighborhood);
  }

  query = query.limit(limit * 2); // Fetch extra since we'll filter by open status

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching spots:", error);
    return [];
  }

  // Filter to only open spots
  const openSpots = (data || []).filter((spot: Spot & { hours?: HoursData; is_24_hours?: boolean }) => {
    const { isOpen } = isSpotOpen(spot.hours || null, spot.is_24_hours);
    return isOpen;
  });

  return openSpots.slice(0, limit) as Spot[];
}

export async function getNearbySpots(
  venueId: number,
  limit = 6
): Promise<Spot[]> {
  // Get the venue's neighborhood
  const { data: venue } = await supabase
    .from("venues")
    .select("neighborhood")
    .eq("id", venueId)
    .maybeSingle<{ neighborhood: string | null }>();

  if (!venue?.neighborhood) return [];

  // Get nearby spots in same neighborhood (excluding the event venue)
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("neighborhood", venue.neighborhood)
    .neq("id", venueId)
    .in("venue_type", ["bar", "restaurant", "coffee_shop", "brewery"])
    .eq("active", true)
    .limit(limit);

  if (error) {
    console.error("Error fetching nearby spots:", error);
    return [];
  }

  return (data || []) as Spot[];
}
