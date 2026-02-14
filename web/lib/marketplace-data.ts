import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import {
  PCM_CENTER_LAT,
  PCM_CENTER_LNG,
  PCM_GEO_BOX,
  PCM_PROXIMITY_RADIUS_KM,
} from "@/lib/marketplace-art";

// ============================================================================
// Types
// ============================================================================

export type PCMEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  image_url: string | null;
  category: string | null;
  description: string | null;
  venue_name: string | null;
  venue_slug: string | null;
  tags: string[];
};

export type PCMTenant = {
  id: number;
  name: string;
  slug: string;
  venue_type: string | null;
  spot_type: string | null;
  description: string | null;
  image_url: string | null;
  website: string | null;
  vibes: string[];
};

export type NeighborhoodEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  category: string | null;
  venue_name: string | null;
  venue_slug: string | null;
  tags: string[];
};

export type NeighborhoodVenue = {
  id: number;
  name: string;
  slug: string;
  venue_type: string | null;
  image_url: string | null;
  neighborhood: string | null;
  vibes: string[];
  lat: number | null;
  lng: number | null;
};

// ============================================================================
// Raw row types for Supabase responses
// ============================================================================

type RawEventRow = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  image_url: string | null;
  category: string | null;
  description: string | null;
  tags: string[] | null;
  venue: {
    name: string;
    slug: string;
  } | null;
};

type RawVenueRow = {
  id: number;
  name: string;
  slug: string;
  venue_type: string | null;
  spot_type: string | null;
  description: string | null;
  image_url: string | null;
  website: string | null;
  vibes: string[] | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Events happening at PCM venues (by vibe tag or geo-box).
 */
export async function getPCMEvents(limit = 30): Promise<PCMEvent[]> {
  const supabase = await createClient();
  const today = getLocalDateString();

  // Get PCM-related venue IDs first (venues with ponce-city-market vibe or in geo-box)
  const { data: venueData } = await supabase
    .from("venues")
    .select("id")
    .or(
      `vibes.cs.{ponce-city-market},and(lat.gte.${PCM_GEO_BOX.minLat},lat.lte.${PCM_GEO_BOX.maxLat},lng.gte.${PCM_GEO_BOX.minLng},lng.lte.${PCM_GEO_BOX.maxLng})`
    );

  const venueIds = (venueData || []).map((v: { id: number }) => v.id);
  if (venueIds.length === 0) return [];

  const { data } = await supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, end_time,
      image_url, category, description, tags,
      venue:venues!events_venue_id_fkey(name, slug)
    `)
    .in("venue_id", venueIds)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  return ((data as RawEventRow[] | null) || []).map((row) => ({
    id: row.id,
    title: row.title,
    start_date: row.start_date,
    start_time: row.start_time,
    end_time: row.end_time,
    image_url: row.image_url,
    category: row.category,
    description: row.description,
    venue_name: row.venue?.name || null,
    venue_slug: row.venue?.slug || null,
    tags: row.tags || [],
  }));
}

/**
 * Tenant venues at or very near PCM.
 */
export async function getPCMTenants(): Promise<PCMTenant[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("venues")
    .select("id, name, slug, venue_type, spot_type, description, image_url, website, vibes")
    .or(
      `vibes.cs.{ponce-city-market},and(lat.gte.${PCM_GEO_BOX.minLat},lat.lte.${PCM_GEO_BOX.maxLat},lng.gte.${PCM_GEO_BOX.minLng},lng.lte.${PCM_GEO_BOX.maxLng})`
    )
    .order("name", { ascending: true });

  return ((data as RawVenueRow[] | null) || []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    venue_type: row.venue_type,
    spot_type: row.spot_type,
    description: row.description,
    image_url: row.image_url,
    website: row.website,
    vibes: row.vibes || [],
  }));
}

/**
 * Events happening near PCM but NOT at PCM venues (BeltLine / O4W neighborhood).
 */
export async function getNeighborhoodEvents(limit = 20): Promise<NeighborhoodEvent[]> {
  const supabase = await createClient();
  const today = getLocalDateString();

  // Wider radius for neighborhood
  const latDelta = PCM_PROXIMITY_RADIUS_KM / 111;
  const lngDelta = PCM_PROXIMITY_RADIUS_KM / (111 * Math.cos((PCM_CENTER_LAT * Math.PI) / 180));

  const minLat = PCM_CENTER_LAT - latDelta;
  const maxLat = PCM_CENTER_LAT + latDelta;
  const minLng = PCM_CENTER_LNG - lngDelta;
  const maxLng = PCM_CENTER_LNG + lngDelta;

  // Get PCM venue IDs to exclude
  const { data: pcmVenues } = await supabase
    .from("venues")
    .select("id")
    .or(
      `vibes.cs.{ponce-city-market},and(lat.gte.${PCM_GEO_BOX.minLat},lat.lte.${PCM_GEO_BOX.maxLat},lng.gte.${PCM_GEO_BOX.minLng},lng.lte.${PCM_GEO_BOX.maxLng})`
    );

  const pcmVenueIds = new Set((pcmVenues || []).map((v: { id: number }) => v.id));

  // Get nearby venues (wider box)
  const { data: nearbyVenues } = await supabase
    .from("venues")
    .select("id")
    .gte("lat", minLat)
    .lte("lat", maxLat)
    .gte("lng", minLng)
    .lte("lng", maxLng);

  const neighborhoodVenueIds = (nearbyVenues || [])
    .map((v: { id: number }) => v.id)
    .filter((id: number) => !pcmVenueIds.has(id));

  if (neighborhoodVenueIds.length === 0) return [];

  const { data } = await supabase
    .from("events")
    .select(`
      id, title, start_date, start_time,
      image_url, category, tags,
      venue:venues!events_venue_id_fkey(name, slug)
    `)
    .in("venue_id", neighborhoodVenueIds)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  type NeighborhoodRawRow = Omit<RawEventRow, "end_time" | "description">;

  return ((data as NeighborhoodRawRow[] | null) || []).map((row) => ({
    id: row.id,
    title: row.title,
    start_date: row.start_date,
    start_time: row.start_time,
    image_url: row.image_url,
    category: row.category,
    venue_name: row.venue?.name || null,
    venue_slug: row.venue?.slug || null,
    tags: row.tags || [],
  }));
}

/**
 * Venues in the Old Fourth Ward / BeltLine corridor near PCM.
 */
export async function getNeighborhoodVenues(limit = 12): Promise<NeighborhoodVenue[]> {
  const supabase = await createClient();

  const latDelta = PCM_PROXIMITY_RADIUS_KM / 111;
  const lngDelta = PCM_PROXIMITY_RADIUS_KM / (111 * Math.cos((PCM_CENTER_LAT * Math.PI) / 180));

  const { data } = await supabase
    .from("venues")
    .select("id, name, slug, venue_type, image_url, neighborhood, vibes, lat, lng")
    .gte("lat", PCM_CENTER_LAT - latDelta)
    .lte("lat", PCM_CENTER_LAT + latDelta)
    .gte("lng", PCM_CENTER_LNG - lngDelta)
    .lte("lng", PCM_CENTER_LNG + lngDelta)
    .not("vibes", "cs", "{ponce-city-market}")
    .order("name", { ascending: true })
    .limit(limit);

  return ((data as RawVenueRow[] | null) || []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    venue_type: row.venue_type,
    image_url: row.image_url,
    neighborhood: row.neighborhood,
    vibes: row.vibes || [],
    lat: row.lat,
    lng: row.lng,
  }));
}
