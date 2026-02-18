import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getDistanceMiles } from "@/lib/geo";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { fetchSocialProofCounts } from "@/lib/search";

// Destination category mappings for venues
const DESTINATION_CATEGORIES: Record<string, string[]> = {
  food: ["restaurant", "food_hall", "cooking_school"],
  drinks: ["bar", "brewery", "distillery", "winery", "rooftop", "sports_bar"],
  nightlife: ["club"],
  caffeine: ["coffee_shop"],
  fun: ["games", "eatertainment", "arcade", "karaoke"],
};

const SUPPORT_SPLIT_RE =
  /\s+(?:w\/|with|feat\.?|ft\.?|featuring|support(?:ing)?|special guests?|openers?|opening)\s+/i;
const NOISY_PREFIX_RE =
  /^(with|w\/|special guests?|support(?:ing)?|opening|openers?)\b/i;

const SPOT_DETAIL_CACHE_TTL_MS = 2 * 60 * 1000;
const SPOT_DETAIL_CACHE_MAX_ENTRIES = 200;
const SPOT_DETAIL_CACHE_CONTROL = "public, s-maxage=120, stale-while-revalidate=600";

type SpotCachePayload = {
  spot: Record<string, unknown>;
  upcomingEvents: Array<Record<string, unknown>>;
  nearbyDestinations: Record<string, NearbyDestination[]>;
  highlights: Array<Record<string, unknown>>;
  artifacts: Array<Record<string, unknown>>;
};

const spotDetailPayloadCache = new Map<string, { expiresAt: number; payload: SpotCachePayload }>();

function getCachedSpotDetailPayload(cacheKey: string): SpotCachePayload | null {
  const entry = spotDetailPayloadCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    spotDetailPayloadCache.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

function setCachedSpotDetailPayload(cacheKey: string, payload: SpotCachePayload): void {
  if (spotDetailPayloadCache.size >= SPOT_DETAIL_CACHE_MAX_ENTRIES) {
    const firstKey = spotDetailPayloadCache.keys().next().value;
    if (firstKey) {
      spotDetailPayloadCache.delete(firstKey);
    }
  }
  spotDetailPayloadCache.set(cacheKey, {
    expiresAt: Date.now() + SPOT_DETAIL_CACHE_TTL_MS,
    payload,
  });
}

type EventArtistRow = {
  event_id: number;
  name: string;
  billing_order: number | null;
  is_headliner: boolean | null;
};

type UpcomingEventRow = {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_free: boolean | null;
  price_min: number | null;
  category: string | null;
  source_url: string | null;
  ticket_url: string | null;
};

type NearbyDestination = {
  id: number;
  name: string;
  slug: string;
  venue_type: string | null;
  location_designator: "standard" | "private_after_signup" | "virtual" | "recovery_meeting" | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  distance?: number;
  // Enhanced data for better display
  image_url: string | null;
  short_description: string | null;
  hours: Record<string, { open: string; close: string } | null> | null;
  hours_display: string | null;
  is_24_hours: boolean | null;
  vibes: string[] | null;
};

type SpotRecord = {
  id: number;
  neighborhood?: string | null;
  lat?: number | null;
  lng?: number | null;
  [key: string]: unknown;
};

type VenueHighlightRow = {
  id: number;
  highlight_type: string;
  title: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
};

const normalizeText = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function dedupeVenueHighlights(rows: VenueHighlightRow[]): VenueHighlightRow[] {
  const seen = new Set<string>();
  const deduped: VenueHighlightRow[] = [];

  for (const row of rows) {
    const normalizedTitle = normalizeText(row.title);
    const normalizedDescription = normalizeText(row.description);
    const fingerprint = `${normalizedTitle}|${normalizedDescription}`;

    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    deduped.push(row);
  }

  return deduped;
}

const extractHeadlinerFromTitle = (title: string) => {
  const firstChunk = title.split(SUPPORT_SPLIT_RE)[0] || title;
  const commaChunk = firstChunk.split(",")[0] || firstChunk;
  return normalizeText(commaChunk);
};

const isLikelyRootUrl = (url: string | null) => {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");
    return path === "";
  } catch {
    return false;
  }
};

const scoreEventQuality = (
  event: UpcomingEventRow,
  artists: EventArtistRow[]
) => {
  let score = 0;
  if (artists.length > 0) score += 4;
  if (event.ticket_url) score += 2;
  if (!isLikelyRootUrl(event.source_url)) score += 2;
  if (!NOISY_PREFIX_RE.test(event.title.trim())) score += 1;
  if (/[a-z]/.test(event.title)) score += 1;
  if (event.title.length >= 10) score += 1;
  return score;
};

const dedupeBySlot = (
  rows: UpcomingEventRow[],
  artistsByEventId: Map<number, EventArtistRow[]>
) => {
  const winnersBySlot = new Map<string, UpcomingEventRow>();
  for (const row of rows) {
    const slotKey = `${row.start_date}|${row.start_time || "00:00"}`;
    const current = winnersBySlot.get(slotKey);
    if (!current) {
      winnersBySlot.set(slotKey, row);
      continue;
    }

    const currentArtists = artistsByEventId.get(current.id) || [];
    const nextArtists = artistsByEventId.get(row.id) || [];
    const currentScore = scoreEventQuality(current, currentArtists);
    const nextScore = scoreEventQuality(row, nextArtists);

    if (nextScore > currentScore) {
      winnersBySlot.set(slotKey, row);
      continue;
    }

    if (nextScore === currentScore) {
      const currentHeadliner = extractHeadlinerFromTitle(current.title);
      const nextHeadliner = extractHeadlinerFromTitle(row.title);
      if (currentHeadliner && currentHeadliner === nextHeadliner) {
        if (row.title.length > current.title.length) {
          winnersBySlot.set(slotKey, row);
        }
      }
    }
  }

  return [...winnersBySlot.values()]
    .sort((a, b) => {
      if (a.start_date !== b.start_date) {
        return a.start_date.localeCompare(b.start_date);
      }
      return (a.start_time || "").localeCompare(b.start_time || "");
    })
    .slice(0, 20);
};

async function fetchNearbyDestinations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  spot: SpotRecord
): Promise<Record<string, NearbyDestination[]>> {
  const nearbyDestinations: Record<string, NearbyDestination[]> = {
    food: [],
    drinks: [],
    nightlife: [],
    caffeine: [],
    fun: [],
  };

  const allDestinationTypes = Object.values(DESTINATION_CATEGORIES).flat();
  const selectFields =
    "id, name, slug, venue_type, location_designator, neighborhood, lat, lng, image_url, short_description, hours, hours_display, is_24_hours, vibes";

  let spots: NearbyDestination[] | null = null;

  if (spot.neighborhood) {
    const { data } = await supabase
      .from("venues")
      .select(selectFields)
      .eq("neighborhood", spot.neighborhood)
      .in("venue_type", allDestinationTypes)
      .eq("active", true)
      .neq("id", spot.id);
    spots = (data || null) as NearbyDestination[] | null;
  } else if (spot.lat && spot.lng) {
    const { data } = await supabase
      .from("venues")
      .select(selectFields)
      .in("venue_type", allDestinationTypes)
      .eq("active", true)
      .neq("id", spot.id)
      .limit(50);
    spots = (data || null) as NearbyDestination[] | null;
  }

  if (!spots) {
    return nearbyDestinations;
  }

  for (const dest of spots) {
    let distance: number | undefined;

    if (dest.lat && dest.lng && spot.lat && spot.lng) {
      distance = getDistanceMiles(spot.lat, spot.lng, dest.lat, dest.lng);
      if (!spot.neighborhood && distance > 2) {
        continue;
      }
    } else if (!spot.neighborhood) {
      continue;
    }

    const venueType = dest.venue_type || "";
    let category: string | null = null;
    for (const [cat, types] of Object.entries(DESTINATION_CATEGORIES)) {
      if (types.includes(venueType)) {
        category = cat;
        break;
      }
    }

    if (category && nearbyDestinations[category]) {
      nearbyDestinations[category].push({ ...dest, distance });
    }
  }

  for (const category of Object.keys(nearbyDestinations)) {
    nearbyDestinations[category].sort((a, b) => (a.distance || 999) - (b.distance || 999));
    nearbyDestinations[category] = nearbyDestinations[category].slice(0, 10);
  }

  return nearbyDestinations;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const cacheKey = slug.toLowerCase().trim();
  const cachedPayload = getCachedSpotDetailPayload(cacheKey);
  if (cachedPayload) {
    return NextResponse.json(cachedPayload, {
      headers: {
        "Cache-Control": SPOT_DETAIL_CACHE_CONTROL,
      },
    });
  }

  const supabase = await createClient();

  // Fetch spot/venue data
  const { data: spotData, error } = await supabase
    .from("venues")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !spotData) {
    return NextResponse.json({ error: "Spot not found" }, { status: 404 });
  }

  const spot = spotData as SpotRecord;

  // Get today's date for filtering upcoming events
  const today = getLocalDateString();

  const nearbyDestinationsPromise = fetchNearbyDestinations(supabase, spot);
  const highlightsPromise = supabase
    .from("venue_highlights")
    .select("id, highlight_type, title, description, image_url, sort_order")
    .eq("venue_id", spot.id)
    .order("sort_order", { ascending: true });
  const artifactsPromise = supabase
    .from("venues")
    .select("id, name, slug, venue_type, image_url, short_description")
    .eq("parent_venue_id", spot.id)
    .eq("active", true)
    .order("name", { ascending: true });

  // Fetch upcoming events at this venue (include ongoing multi-day events).
  // We over-fetch to allow post-query slot dedupe and quality ranking.
  const { data: upcomingEvents } = await supabase
    .from("events")
    .select(`
      id, title, start_date, end_date, start_time, end_time, is_free, price_min, category, source_url, ticket_url
    `)
    .eq("venue_id", spot.id)
    .is("canonical_event_id", null)
    .or(`start_date.gte.${today},end_date.gte.${today}`)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(60);

  const eventRows = (upcomingEvents || []) as UpcomingEventRow[];
  const allEventIds = eventRows.map((event) => event.id);

  let artistsByEventId = new Map<number, EventArtistRow[]>();
  if (allEventIds.length > 0) {
    const { data: artistRows } = await supabase
      .from("event_artists")
      .select("event_id,name,billing_order,is_headliner")
      .in("event_id", allEventIds)
      .order("billing_order", { ascending: true, nullsFirst: false })
      .order("is_headliner", { ascending: false })
      .order("name", { ascending: true });

    artistsByEventId = (artistRows as EventArtistRow[] | null)?.reduce(
      (map, row) => {
        const list = map.get(row.event_id) || [];
        list.push(row);
        map.set(row.event_id, list);
        return map;
      },
      new Map<number, EventArtistRow[]>()
    ) || new Map<number, EventArtistRow[]>();
  }

  const dedupedRows = dedupeBySlot(eventRows, artistsByEventId);
  const upcomingEventIds = dedupedRows.map((event) => event.id);
  const upcomingCountsPromise = fetchSocialProofCounts(upcomingEventIds);

  const [
    upcomingCounts,
    nearbyDestinations,
    { data: highlights },
    { data: artifacts },
  ] = await Promise.all([
    upcomingCountsPromise,
    nearbyDestinationsPromise,
    highlightsPromise,
    artifactsPromise,
  ]);

  const upcomingEventsWithCounts: Array<Record<string, unknown>> = dedupedRows.map((event) => {
    const counts = upcomingCounts.get(event.id);
    const artists = (artistsByEventId.get(event.id) || []).map((artist) => ({
      name: artist.name,
      billing_order: artist.billing_order,
      is_headliner: !!artist.is_headliner,
    }));
    return {
      ...event,
      artists,
      lineup: artists.map((artist) => artist.name).join(", ") || null,
      going_count: counts?.going || 0,
      interested_count: counts?.interested || 0,
      recommendation_count: counts?.recommendations || 0,
    };
  });

  const responsePayload: SpotCachePayload = {
    spot: spotData as Record<string, unknown>,
    upcomingEvents: upcomingEventsWithCounts,
    nearbyDestinations,
    highlights: dedupeVenueHighlights(
      (highlights as VenueHighlightRow[] | null) || []
    ) as unknown as Array<Record<string, unknown>>,
    artifacts: ((artifacts || []) as Array<Record<string, unknown>>),
  };

  setCachedSpotDetailPayload(cacheKey, responsePayload);

  return NextResponse.json(responsePayload, {
    headers: {
      "Cache-Control": SPOT_DETAIL_CACHE_CONTROL,
    },
  });
}
