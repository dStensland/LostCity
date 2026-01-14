import { supabase } from "./supabase";
import type { Event } from "./supabase";

export const SPOT_TYPES = {
  music_venue: { label: "Music Venue", icon: "🎵" },
  theater: { label: "Theater", icon: "🎭" },
  comedy_club: { label: "Comedy Club", icon: "🎤" },
  bar: { label: "Bar", icon: "🍸" },
  restaurant: { label: "Restaurant", icon: "🍽️" },
  coffee_shop: { label: "Coffee", icon: "☕" },
  brewery: { label: "Brewery", icon: "🍺" },
  gallery: { label: "Gallery", icon: "🖼️" },
  club: { label: "Club", icon: "🪩" },
  arena: { label: "Arena", icon: "🏟️" },
  museum: { label: "Museum", icon: "🏛️" },
  convention_center: { label: "Convention", icon: "🏢" },
  games: { label: "Games", icon: "🎯" },
} as const;

export type SpotType = keyof typeof SPOT_TYPES;

export type Spot = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  spot_type: string | null;
  spot_types: string[] | null;
  description: string | null;
  short_description: string | null;
  price_level: number | null;
  website: string | null;
  instagram: string | null;
  hours_display: string | null;
  vibes: string[] | null;
  image_url: string | null;
  featured: boolean;
  active: boolean;
  event_count?: number;
};

export async function getSpots(type?: string): Promise<Spot[]> {
  let query = supabase
    .from("venues")
    .select("*")
    .order("name");

  if (type && type !== "all") {
    query = query.or(`spot_type.eq.${type},spot_types.cs.{${type}}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching spots:", error);
    return [];
  }

  return (data || []) as Spot[];
}

export async function getSpotsWithEventCounts(type?: string): Promise<Spot[]> {
  const today = new Date().toISOString().split("T")[0];

  // Get all venues
  let venueQuery = supabase.from("venues").select("*").order("name");

  if (type && type !== "all") {
    venueQuery = venueQuery.or(`spot_type.eq.${type},spot_types.cs.{${type}}`);
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
    .single();

  if (error) {
    console.error("Error fetching spot:", error);
    return null;
  }

  return data as Spot;
}

export async function getUpcomingEventsForSpot(
  venueId: number,
  limit = 10
): Promise<Event[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state)
    `
    )
    .eq("venue_id", venueId)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching events for spot:", error);
    return [];
  }

  return (data || []) as Event[];
}

export function formatPriceLevel(level: number | null): string {
  if (!level) return "";
  return "$".repeat(level);
}

export function getSpotTypeLabel(type: string | null): string {
  if (!type) return "";
  return SPOT_TYPES[type as SpotType]?.label || type;
}

export function getSpotTypeLabels(types: string[] | null): string {
  if (!types || types.length === 0) return "";
  return types
    .map((t) => SPOT_TYPES[t as SpotType]?.label || t)
    .join(" + ");
}
