/**
 * seed-playbooks.ts
 *
 * Seeds 3 demo itineraries (Playbooks) with real venue and event data
 * from the Atlanta area. Designed for demo/QA use.
 *
 * Run with: npx tsx scripts/seed-playbooks.ts
 *
 * Prerequisites: Run seed-personas.ts first so a @coach profile exists.
 *
 * Share URLs produced (relative to your portal base):
 *   /atlanta/playbook/share/demo_friday_night_01
 *   /atlanta/playbook/share/demo_beltline_day_01
 *   /atlanta/playbook/share/demo_date_night_fox
 *
 * Idempotent: deletes existing itineraries whose share_token starts with
 * "demo_" before re-creating them.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  haversineDistanceMeters,
  estimateWalkMinutes,
} from "../lib/itinerary-utils";

// ─── Environment ─────────────────────────────────────────────────────────────

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Types ────────────────────────────────────────────────────────────────────

interface VenueRow {
  id: number;
  name: string;
  slug: string;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
  venue_type: string | null;
  address: string | null;
}

interface EventRow {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  venue_id: number | null;
}

interface ItineraryStop {
  item_type: "event" | "venue" | "custom";
  event_id?: number;
  venue_id?: number;
  custom_title?: string;
  custom_description?: string;
  custom_address?: string;
  custom_lat?: number;
  custom_lng?: number;
  start_time: string | null; // HH:MM
  duration_minutes: number;
  notes?: string;
  lat?: number;
  lng?: number;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Return the date (YYYY-MM-DD) of the next occurrence of a given weekday.
 * 0 = Sunday … 6 = Saturday
 */
function nextWeekday(targetDay: number): string {
  const today = new Date();
  const todayDay = today.getDay();
  const daysAhead = ((targetDay - todayDay + 7) % 7) || 7; // at least 1 day forward
  const target = new Date(today);
  target.setDate(today.getDate() + daysAhead);
  return target.toISOString().split("T")[0];
}

const nextFriday = nextWeekday(5);
const nextSaturday = nextWeekday(6);

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function getPortalId(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    console.error(`Portal "${slug}" not found:`, error?.message);
    process.exit(1);
  }
  return data.id;
}

async function getDemoUserId(): Promise<string> {
  // Prefer @coach (the founder account used in other seed scripts)
  const { data: coachProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", "coach")
    .maybeSingle();

  if (coachProfile) {
    console.log("  Using @coach as demo user");
    return coachProfile.id;
  }

  // Fall back to the first profile in the DB
  const { data: fallback, error } = await supabase
    .from("profiles")
    .select("id, username")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !fallback) {
    console.error("No profiles found. Run seed-personas.ts first.");
    process.exit(1);
  }

  console.log(`  Using @${fallback.username} as demo user (fallback)`);
  return fallback.id;
}

/**
 * Find venues near a lat/lng center that have coordinates set.
 * Returns up to `limit` venues sorted by distance ascending.
 */
async function findNearbyVenues(
  centerLat: number,
  centerLng: number,
  limit: number,
  venueTypes?: string[]
): Promise<VenueRow[]> {
  let query = supabase
    .from("places")
    .select("id, name, slug, lat, lng, neighborhood, place_type, address")
    .not("lat", "is", null)
    .not("lng", "is", null)
    // Rough bounding box: ~5km radius around center (0.045 deg ≈ 5km)
    .gte("lat", centerLat - 0.045)
    .lte("lat", centerLat + 0.045)
    .gte("lng", centerLng - 0.055)
    .lte("lng", centerLng + 0.055)
    .limit(limit * 4); // fetch extra to sort by distance

  if (venueTypes && venueTypes.length > 0) {
    query = query.in("place_type", venueTypes);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.warn("  Venue query error:", error?.message);
    return [];
  }

  // Sort by Haversine distance, take closest `limit`
  return data
    .sort((a, b) => {
      const da = haversineDistanceMeters(centerLat, centerLng, a.lat!, a.lng!);
      const db = haversineDistanceMeters(centerLat, centerLng, b.lat!, b.lng!);
      return da - db;
    })
    .slice(0, limit);
}

/**
 * Find a venue by name keywords (case-insensitive substring match).
 */
async function findVenueByName(nameQuery: string): Promise<VenueRow | null> {
  const { data, error } = await supabase
    .from("places")
    .select("id, name, slug, lat, lng, neighborhood, place_type, address")
    .ilike("name", `%${nameQuery}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`  findVenueByName("${nameQuery}") error:`, error.message);
    return null;
  }
  return data;
}

/**
 * Find the first upcoming event at a specific venue, optionally keyword-filtered.
 */
async function findUpcomingEventAtVenue(
  venueId: number,
  titleKeyword?: string,
  afterDate?: string
): Promise<EventRow | null> {
  const today = afterDate ?? new Date().toISOString().split("T")[0];

  const query = supabase
    .from("events")
    .select("id, title, start_date, start_time, place_id")
    .eq("place_id", venueId)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(20);

  const { data, error } = await query;

  if (error || !data || data.length === 0) return null;

  if (titleKeyword) {
    const lower = titleKeyword.toLowerCase();
    const match = data.find((e) => e.title.toLowerCase().includes(lower));
    if (match) return match;
  }

  return data[0];
}

// ─── Walk time computation ────────────────────────────────────────────────────

/**
 * Given an ordered list of stops with lat/lng, fills in
 * walk_distance_meters and walk_time_minutes for each stop
 * (based on distance FROM the previous stop).
 */
function computeWalkTimes(
  stops: ItineraryStop[]
): Array<{ walk_distance_meters: number | null; walk_time_minutes: number | null }> {
  return stops.map((stop, idx) => {
    if (idx === 0) return { walk_distance_meters: null, walk_time_minutes: null };

    const prev = stops[idx - 1];
    const prevLat = prev.lat;
    const prevLng = prev.lng;
    const currLat = stop.lat;
    const currLng = stop.lng;

    if (
      prevLat == null ||
      prevLng == null ||
      currLat == null ||
      currLng == null
    ) {
      return { walk_distance_meters: null, walk_time_minutes: null };
    }

    const distMeters = haversineDistanceMeters(prevLat, prevLng, currLat, currLng);
    const walkMins = estimateWalkMinutes(distMeters);
    return {
      walk_distance_meters: Math.round(distMeters),
      walk_time_minutes: walkMins,
    };
  });
}

// ─── Itinerary creator ────────────────────────────────────────────────────────

async function createItinerary(
  portalId: string,
  userId: string,
  title: string,
  date: string,
  description: string,
  shareToken: string,
  stops: ItineraryStop[]
): Promise<{ id: string; itemCount: number }> {
  // 1. Insert the itinerary
  const { data: itinerary, error: iErr } = await supabase
    .from("itineraries")
    .insert({
      user_id: userId,
      portal_id: portalId,
      title,
      date,
      description,
      is_public: true,
      share_token: shareToken,
    } as never)
    .select("id")
    .single();

  if (iErr || !itinerary) {
    throw new Error(`Failed to create itinerary "${title}": ${iErr?.message}`);
  }

  // 2. Compute walk times between consecutive stops
  const walkData = computeWalkTimes(stops);

  // 3. Insert items
  const items = stops.map((stop, idx) => ({
    itinerary_id: itinerary.id,
    item_type: stop.item_type,
    event_id: stop.event_id ?? null,
    venue_id: stop.venue_id ?? null,
    custom_title: stop.custom_title ?? null,
    custom_description: stop.custom_description ?? null,
    custom_address: stop.custom_address ?? null,
    custom_lat: stop.custom_lat ?? null,
    custom_lng: stop.custom_lng ?? null,
    position: idx,
    start_time: stop.start_time ?? null,
    duration_minutes: stop.duration_minutes,
    walk_distance_meters: walkData[idx].walk_distance_meters,
    walk_time_minutes: walkData[idx].walk_time_minutes,
    notes: stop.notes ?? null,
  }));

  const { error: itemsErr } = await supabase
    .from("itinerary_items")
    .insert(items as never);

  if (itemsErr) {
    throw new Error(
      `Failed to insert items for "${title}": ${itemsErr.message}`
    );
  }

  return { id: itinerary.id, itemCount: items.length };
}

// ─── Demo cleanup ─────────────────────────────────────────────────────────────

async function clearDemoItineraries() {
  console.log("Clearing existing demo itineraries (share_token LIKE 'demo_%')...");

  // Fetch IDs to delete (cascades to items)
  const { data: existing, error: fetchErr } = await supabase
    .from("itineraries")
    .select("id, share_token")
    .like("share_token", "demo_%");

  if (fetchErr) {
    console.error("  Error fetching demo itineraries:", fetchErr.message);
    return;
  }

  if (!existing || existing.length === 0) {
    console.log("  No demo itineraries found — skipping cleanup");
    return;
  }

  const ids = existing.map((r) => r.id);
  const { error: delErr } = await supabase
    .from("itineraries")
    .delete()
    .in("id", ids);

  if (delErr) {
    console.error("  Error deleting demo itineraries:", delErr.message);
  } else {
    console.log(
      `  Deleted ${ids.length} demo itinerary/itineraries: ${existing.map((r) => r.share_token).join(", ")}`
    );
  }
}

// ─── Itinerary 1: Friday Night in Midtown ────────────────────────────────────

/**
 * Midtown center ~33.7840, -84.3837
 * Stops: dinner restaurant → music venue/show → cocktail bar → late-night bar
 */
async function buildFridayNightItinerary(
  portalId: string,
  userId: string
): Promise<void> {
  console.log('\nBuilding "Friday Night in Midtown"...');

  const MIDTOWN_LAT = 33.784;
  const MIDTOWN_LNG = -84.3837;

  // Dinner: look for a restaurant in Midtown
  let dinnerVenue = await findVenueByName("One Eared Stag");
  if (!dinnerVenue) dinnerVenue = await findVenueByName("Alma Cocina");
  if (!dinnerVenue) {
    const restaurants = await findNearbyVenues(
      MIDTOWN_LAT,
      MIDTOWN_LNG,
      1,
      ["restaurant", "bar_restaurant", "food"]
    );
    dinnerVenue = restaurants[0] ?? null;
  }

  // Show / music venue: look for Variety Playhouse, Terminal West, or a music venue
  let showVenue = await findVenueByName("Variety Playhouse");
  if (!showVenue) showVenue = await findVenueByName("Terminal West");
  if (!showVenue) showVenue = await findVenueByName("Masquerade");
  if (!showVenue) {
    const musicVenues = await findNearbyVenues(
      MIDTOWN_LAT,
      MIDTOWN_LNG,
      1,
      ["music_venue", "theater", "performing_arts"]
    );
    showVenue = musicVenues[0] ?? null;
  }

  // Look for a real event at the show venue
  let showEvent: EventRow | null = null;
  if (showVenue) {
    showEvent = await findUpcomingEventAtVenue(showVenue.id, undefined, nextFriday);
  }

  // Cocktail bar
  let cocktailVenue = await findVenueByName("Kimball House");
  if (!cocktailVenue) cocktailVenue = await findVenueByName("Watchman's");
  if (!cocktailVenue) cocktailVenue = await findVenueByName("Ticonderoga");
  if (!cocktailVenue) {
    const bars = await findNearbyVenues(MIDTOWN_LAT, MIDTOWN_LNG, 3, [
      "bar",
      "cocktail_bar",
      "lounge",
    ]);
    cocktailVenue = bars[0] ?? null;
  }

  // Late-night bar
  let lateNightVenue = await findVenueByName("Clermont Lounge");
  if (!lateNightVenue) lateNightVenue = await findVenueByName("Graveyard");
  if (!lateNightVenue) lateNightVenue = await findVenueByName("Joystick");
  if (!lateNightVenue) {
    const bars = await findNearbyVenues(MIDTOWN_LAT, MIDTOWN_LNG, 5, [
      "bar",
      "nightclub",
      "dive_bar",
    ]);
    lateNightVenue = bars.find((v) => v.id !== cocktailVenue?.id) ?? null;
  }

  // Build stops
  const stops: ItineraryStop[] = [];

  if (dinnerVenue) {
    console.log(`  Dinner: ${dinnerVenue.name}`);
    stops.push({
      item_type: "venue",
      venue_id: dinnerVenue.id,
      start_time: "18:30",
      duration_minutes: 90,
      notes: "Make a reservation — this spot books out on Fridays.",
      lat: dinnerVenue.lat ?? undefined,
      lng: dinnerVenue.lng ?? undefined,
    });
  } else {
    console.warn("  Dinner venue not found — using custom stop");
    stops.push({
      item_type: "custom",
      custom_title: "Dinner in Midtown",
      custom_description: "Your choice of restaurant in Midtown Atlanta.",
      custom_lat: MIDTOWN_LAT,
      custom_lng: MIDTOWN_LNG,
      start_time: "18:30",
      duration_minutes: 90,
      lat: MIDTOWN_LAT,
      lng: MIDTOWN_LNG,
    });
  }

  if (showEvent && showVenue) {
    console.log(`  Show: ${showEvent.title} @ ${showVenue.name}`);
    stops.push({
      item_type: "event",
      event_id: showEvent.id,
      venue_id: showVenue.id,
      start_time: showEvent.start_time ?? "20:00",
      duration_minutes: 120,
      notes: "Grab tickets in advance.",
      lat: showVenue.lat ?? undefined,
      lng: showVenue.lng ?? undefined,
    });
  } else if (showVenue) {
    console.log(`  Show venue: ${showVenue.name} (no event found for next Friday)`);
    stops.push({
      item_type: "venue",
      venue_id: showVenue.id,
      start_time: "20:00",
      duration_minutes: 120,
      notes: "Check the calendar for Friday night shows.",
      lat: showVenue.lat ?? undefined,
      lng: showVenue.lng ?? undefined,
    });
  } else {
    console.warn("  Show venue not found — skipping stop");
  }

  if (cocktailVenue) {
    console.log(`  Cocktails: ${cocktailVenue.name}`);
    stops.push({
      item_type: "venue",
      venue_id: cocktailVenue.id,
      start_time: "22:30",
      duration_minutes: 60,
      notes: "Order the seasonal cocktail. Always worth it.",
      lat: cocktailVenue.lat ?? undefined,
      lng: cocktailVenue.lng ?? undefined,
    });
  }

  if (lateNightVenue) {
    console.log(`  Late night: ${lateNightVenue.name}`);
    stops.push({
      item_type: "venue",
      venue_id: lateNightVenue.id,
      start_time: "23:30",
      duration_minutes: 90,
      lat: lateNightVenue.lat ?? undefined,
      lng: lateNightVenue.lng ?? undefined,
    });
  }

  if (stops.length === 0) {
    console.warn("  No stops resolved — skipping itinerary");
    return;
  }

  const result = await createItinerary(
    portalId,
    userId,
    "Friday Night in Midtown",
    nextFriday,
    "The classic Midtown night out: great dinner, live music, craft cocktails, and a late-night cap.",
    "demo_friday_night_01",
    stops
  );
  console.log(
    `  Created: id=${result.id} (${result.itemCount} stops) — share: /playbook/share/demo_friday_night_01`
  );
}

// ─── Itinerary 2: Weekend BeltLine Day ───────────────────────────────────────

/**
 * BeltLine / Inman Park center ~33.757, -84.360
 * Stops: brunch → walk/activity → brewery
 */
async function buildBeltLineItinerary(
  portalId: string,
  userId: string
): Promise<void> {
  console.log('\nBuilding "Weekend BeltLine Day"...');

  const BELTLINE_LAT = 33.757;
  const BELTLINE_LNG = -84.36;

  // Brunch spot near BeltLine
  let brunchVenue = await findVenueByName("Muchacho");
  if (!brunchVenue) brunchVenue = await findVenueByName("Krog Street Market");
  if (!brunchVenue) brunchVenue = await findVenueByName("Little Bear");
  if (!brunchVenue) {
    const spots = await findNearbyVenues(
      BELTLINE_LAT,
      BELTLINE_LNG,
      1,
      ["restaurant", "bar_restaurant", "cafe", "food_hall"]
    );
    brunchVenue = spots[0] ?? null;
  }

  // Activity: look for something on the BeltLine or nearby (market, park, gallery)
  let activityVenue = await findVenueByName("Ponce City Market");
  if (!activityVenue) activityVenue = await findVenueByName("Atlanta BeltLine");
  if (!activityVenue) activityVenue = await findVenueByName("Piedmont Park");
  if (!activityVenue) {
    const spots = await findNearbyVenues(
      BELTLINE_LAT + 0.015, // shift slightly north toward Ponce
      BELTLINE_LNG,
      1,
      ["park", "market", "gallery", "attraction"]
    );
    activityVenue = spots[0] ?? null;
  }

  // Look for an event at the activity venue (market pop-ups, etc.)
  let activityEvent: EventRow | null = null;
  if (activityVenue) {
    activityEvent = await findUpcomingEventAtVenue(
      activityVenue.id,
      undefined,
      nextSaturday
    );
  }

  // Brewery
  let breweryVenue = await findVenueByName("Creature Comforts");
  if (!breweryVenue) breweryVenue = await findVenueByName("Wild Heaven");
  if (!breweryVenue) breweryVenue = await findVenueByName("Monday Night Brewing");
  if (!breweryVenue) breweryVenue = await findVenueByName("SweetWater");
  if (!breweryVenue) {
    const spots = await findNearbyVenues(BELTLINE_LAT, BELTLINE_LNG, 1, [
      "brewery",
      "taproom",
    ]);
    breweryVenue = spots[0] ?? null;
  }

  const stops: ItineraryStop[] = [];

  if (brunchVenue) {
    console.log(`  Brunch: ${brunchVenue.name}`);
    stops.push({
      item_type: "venue",
      venue_id: brunchVenue.id,
      start_time: "10:30",
      duration_minutes: 75,
      notes: "Weekend brunch lines can be long — go before 11.",
      lat: brunchVenue.lat ?? undefined,
      lng: brunchVenue.lng ?? undefined,
    });
  } else {
    console.warn("  Brunch venue not found — using custom stop");
    stops.push({
      item_type: "custom",
      custom_title: "Brunch near the BeltLine",
      custom_description: "Pick a spot near the BeltLine Eastside Trail.",
      custom_lat: BELTLINE_LAT,
      custom_lng: BELTLINE_LNG,
      start_time: "10:30",
      duration_minutes: 75,
      lat: BELTLINE_LAT,
      lng: BELTLINE_LNG,
    });
  }

  if (activityEvent && activityVenue) {
    console.log(`  Activity: ${activityEvent.title} @ ${activityVenue.name}`);
    stops.push({
      item_type: "event",
      event_id: activityEvent.id,
      venue_id: activityVenue.id,
      start_time: "12:30",
      duration_minutes: 120,
      notes: "Walk the BeltLine trail to get here — it's the move.",
      lat: activityVenue.lat ?? undefined,
      lng: activityVenue.lng ?? undefined,
    });
  } else if (activityVenue) {
    console.log(`  Activity: ${activityVenue.name}`);
    stops.push({
      item_type: "venue",
      venue_id: activityVenue.id,
      start_time: "12:30",
      duration_minutes: 120,
      notes: "Walk the BeltLine trail to get here — it's the move.",
      lat: activityVenue.lat ?? undefined,
      lng: activityVenue.lng ?? undefined,
    });
  } else {
    console.warn("  Activity venue not found — using custom BeltLine walk stop");
    stops.push({
      item_type: "custom",
      custom_title: "BeltLine Eastside Trail",
      custom_description:
        "Walk or bike the BeltLine from Inman Park to Ponce City Market.",
      custom_lat: 33.767,
      custom_lng: -84.362,
      start_time: "12:30",
      duration_minutes: 90,
      lat: 33.767,
      lng: -84.362,
    });
  }

  if (breweryVenue) {
    console.log(`  Brewery: ${breweryVenue.name}`);
    stops.push({
      item_type: "venue",
      venue_id: breweryVenue.id,
      start_time: "15:00",
      duration_minutes: 90,
      notes: "Get a flight. Stay for the patio.",
      lat: breweryVenue.lat ?? undefined,
      lng: breweryVenue.lng ?? undefined,
    });
  } else {
    console.warn("  Brewery not found — skipping stop");
  }

  if (stops.length === 0) {
    console.warn("  No stops resolved — skipping itinerary");
    return;
  }

  const result = await createItinerary(
    portalId,
    userId,
    "Weekend BeltLine Day",
    nextSaturday,
    "A perfect Atlanta Saturday: brunch, a walk on the BeltLine, and afternoon pints at a local brewery.",
    "demo_beltline_day_01",
    stops
  );
  console.log(
    `  Created: id=${result.id} (${result.itemCount} stops) — share: /playbook/share/demo_beltline_day_01`
  );
}

// ─── Itinerary 3: Date Night at the Fox ──────────────────────────────────────

/**
 * Fox Theatre area: ~33.7729, -84.3852
 * Stops: dinner → Fox Theatre event → dessert/drinks
 */
async function buildDateNightItinerary(
  portalId: string,
  userId: string
): Promise<void> {
  console.log('\nBuilding "Date Night at the Fox"...');

  const FOX_LAT = 33.7729;
  const FOX_LNG = -84.3852;

  // Find Fox Theatre
  let foxVenue = await findVenueByName("Fox Theatre");
  if (!foxVenue) foxVenue = await findVenueByName("Fox Theater");

  // Look for an upcoming event at the Fox
  let foxEvent: EventRow | null = null;
  if (foxVenue) {
    foxEvent = await findUpcomingEventAtVenue(foxVenue.id, undefined, nextFriday);
    if (foxEvent) {
      console.log(`  Fox event: ${foxEvent.title}`);
    } else {
      console.warn("  No upcoming Fox events found for next Friday");
    }
  } else {
    console.warn("  Fox Theatre not found in venues table");
  }

  // Pre-show dinner near the Fox
  let dinnerVenue = await findVenueByName("Empire State South");
  if (!dinnerVenue) dinnerVenue = await findVenueByName("South City Kitchen");
  if (!dinnerVenue) dinnerVenue = await findVenueByName("Bantam + Biddy");
  if (!dinnerVenue) {
    const restaurants = await findNearbyVenues(
      FOX_LAT,
      FOX_LNG,
      1,
      ["restaurant", "bar_restaurant"]
    );
    dinnerVenue = restaurants[0] ?? null;
  }

  // Post-show dessert/drinks
  let dessertVenue = await findVenueByName("Bacchanalia");
  if (!dessertVenue) dessertVenue = await findVenueByName("Grana");
  if (!dessertVenue) dessertVenue = await findVenueByName("Bon Ton");
  if (!dessertVenue) {
    const spots = await findNearbyVenues(FOX_LAT, FOX_LNG, 3, [
      "bar",
      "cocktail_bar",
      "restaurant",
      "lounge",
    ]);
    // Try to get a different venue from dinner
    dessertVenue =
      spots.find((v) => v.id !== dinnerVenue?.id) ?? spots[0] ?? null;
  }

  const stops: ItineraryStop[] = [];

  if (dinnerVenue) {
    console.log(`  Pre-show dinner: ${dinnerVenue.name}`);
    stops.push({
      item_type: "venue",
      venue_id: dinnerVenue.id,
      start_time: "18:00",
      duration_minutes: 90,
      notes: "Tell them you're headed to the Fox — they'll time the service right.",
      lat: dinnerVenue.lat ?? undefined,
      lng: dinnerVenue.lng ?? undefined,
    });
  } else {
    console.warn("  Dinner venue not found — using custom stop");
    stops.push({
      item_type: "custom",
      custom_title: "Pre-show Dinner",
      custom_description: "A nice dinner in Midtown before the show.",
      custom_lat: FOX_LAT + 0.005,
      custom_lng: FOX_LNG,
      start_time: "18:00",
      duration_minutes: 90,
      lat: FOX_LAT + 0.005,
      lng: FOX_LNG,
    });
  }

  if (foxEvent && foxVenue) {
    stops.push({
      item_type: "event",
      event_id: foxEvent.id,
      venue_id: foxVenue.id,
      start_time: foxEvent.start_time ?? "20:00",
      duration_minutes: 150,
      notes:
        "The Fox is stunning. Arrive 15 minutes early to take in the lobby.",
      lat: foxVenue.lat ?? undefined,
      lng: foxVenue.lng ?? undefined,
    });
  } else if (foxVenue) {
    stops.push({
      item_type: "venue",
      venue_id: foxVenue.id,
      start_time: "20:00",
      duration_minutes: 150,
      notes:
        "Check the Fox calendar for Friday shows. The lobby alone is worth the visit.",
      lat: foxVenue.lat ?? undefined,
      lng: foxVenue.lng ?? undefined,
    });
  } else {
    console.warn("  Fox Theatre not found — using custom stop");
    stops.push({
      item_type: "custom",
      custom_title: "Fox Theatre",
      custom_description: "Atlanta's most iconic venue. Catch a show here.",
      custom_address: "660 Peachtree St NE, Atlanta, GA 30308",
      custom_lat: FOX_LAT,
      custom_lng: FOX_LNG,
      start_time: "20:00",
      duration_minutes: 150,
      lat: FOX_LAT,
      lng: FOX_LNG,
    });
  }

  if (dessertVenue) {
    console.log(`  After-show: ${dessertVenue.name}`);
    stops.push({
      item_type: "venue",
      venue_id: dessertVenue.id,
      start_time: "22:30",
      duration_minutes: 60,
      notes: "End the night right. Order dessert.",
      lat: dessertVenue.lat ?? undefined,
      lng: dessertVenue.lng ?? undefined,
    });
  } else {
    console.warn("  After-show venue not found — skipping stop");
  }

  if (stops.length === 0) {
    console.warn("  No stops resolved — skipping itinerary");
    return;
  }

  const result = await createItinerary(
    portalId,
    userId,
    "Date Night at the Fox",
    nextFriday,
    "An evening built around Atlanta's most iconic theatre: a nice dinner, a world-class show, and cocktails after.",
    "demo_date_night_fox",
    stops
  );
  console.log(
    `  Created: id=${result.id} (${result.itemCount} stops) — share: /playbook/share/demo_date_night_fox`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== LostCity Playbook Seeding ===\n");

  // 1. Resolve portal and user
  console.log("Resolving Atlanta portal...");
  const portalId = await getPortalId("atlanta");
  console.log(`  Portal ID: ${portalId}`);

  console.log("Resolving demo user...");
  const userId = await getDemoUserId();
  console.log(`  User ID: ${userId}`);

  // 2. Wipe existing demo itineraries
  await clearDemoItineraries();

  // 3. Build each itinerary
  await buildFridayNightItinerary(portalId, userId);
  await buildBeltLineItinerary(portalId, userId);
  await buildDateNightItinerary(portalId, userId);

  // 4. Summary
  console.log("\n=== Playbook Seeding Complete ===");
  console.log("Share URLs:");
  console.log("  /atlanta/playbook/share/demo_friday_night_01");
  console.log("  /atlanta/playbook/share/demo_beltline_day_01");
  console.log("  /atlanta/playbook/share/demo_date_night_fox");
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
