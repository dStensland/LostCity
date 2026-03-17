import { createClient } from "@/lib/supabase/server";
import { getDistanceMiles } from "@/lib/geo";
import { getLocalDateString } from "@/lib/formats";
import { fetchSocialProofCounts } from "@/lib/social-proof";
import { applyVenueGate } from "@/lib/feed-gate";
import { ATTACHED_CHILD_DESTINATION_VENUE_TYPES } from "@/lib/destination-graph";
import {
  getYonderDestinationIntelligence,
  type YonderDestinationIntelligence,
} from "@/config/yonder-destination-intelligence";
import {
  getYonderAccommodationInventorySource,
  type YonderAccommodationInventorySource,
} from "@/config/yonder-accommodation-inventory";
import {
  getYonderRuntimeInventorySnapshot,
  type YonderRuntimeInventorySnapshot,
} from "@/lib/yonder-provider-inventory";

// ---------------------------------------------------------------------------
// Destination category mappings for venues (post-consolidation types)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  category_id: string | null;
  source_url: string | null;
  ticket_url: string | null;
  series_id: string | null;
  image_url: string | null;
  series: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
  } | null;
};

export type NearbyDestination = {
  id: number;
  name: string;
  slug: string;
  venue_type: string | null;
  location_designator: "standard" | "private_after_signup" | "virtual" | "recovery_meeting" | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  distance?: number;
  image_url: string | null;
  short_description: string | null;
  hours: Record<string, { open: string; close: string } | null> | null;
  hours_display: string | null;
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

type VenueFeatureRow = {
  id: number;
  slug: string;
  title: string;
  feature_type: string;
  description: string | null;
  image_url: string | null;
  url: string | null;
  is_seasonal: boolean;
  start_date: string | null;
  end_date: string | null;
  price_note: string | null;
  is_free: boolean;
  sort_order: number;
};

type VenueSpecialRow = {
  id: number;
  title: string;
  type: string;
  description: string | null;
  days_of_week: number[] | null;
  time_start: string | null;
  time_end: string | null;
  price_note: string | null;
  image_url: string | null;
  source_url: string | null;
};

export type EditorialMentionRow = {
  id: number;
  source_key: string;
  article_url: string;
  article_title: string;
  mention_type: string;
  published_at: string | null;
  guide_name: string | null;
  snippet: string | null;
};

export type VenueOccasionRow = {
  occasion: string;
  confidence: number;
  source: string;
};

export type AttachedChildDestinationRow = {
  id: number;
  name: string;
  slug: string | null;
  venue_type: string | null;
  image_url: string | null;
  short_description: string | null;
};

export type WalkableNeighbor = {
  id: number;
  name: string;
  slug: string;
  walk_minutes: number;
};

export type LibraryPass = {
  eligible: boolean;
  program: string;
  benefit: string;
  passes_per_checkout: number | null;
  notes: string | null;
  url: string;
};

export type SpotDetailPayload = {
  spot: Record<string, unknown>;
  upcomingEvents: Array<Record<string, unknown>>;
  nearbyDestinations: Record<string, NearbyDestination[]>;
  highlights: Array<Record<string, unknown>>;
  attachedChildDestinations: AttachedChildDestinationRow[];
  // Compatibility alias for older consumers that still expect the previous field name.
  artifacts: Array<Record<string, unknown>>;
  features: VenueFeatureRow[];
  specials: VenueSpecialRow[];
  editorialMentions: EditorialMentionRow[];
  occasions: VenueOccasionRow[];
  walkableNeighbors: WalkableNeighbor[];
  yonderDestinationIntelligence: YonderDestinationIntelligence | null;
  yonderAccommodationInventorySource: YonderAccommodationInventorySource | null;
  yonderRuntimeInventorySnapshot: YonderRuntimeInventorySnapshot | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  artistsByEventId: Map<number, EventArtistRow[]>,
  isCinema = false
) => {
  const winnersBySlot = new Map<string, UpcomingEventRow>();
  for (const row of rows) {
    // For cinemas, include normalized title in the key so different films
    // at the same time don't collide
    const slotKey = isCinema
      ? `${row.start_date}|${row.start_time || "00:00"}|${normalizeText(row.title)}`
      : `${row.start_date}|${row.start_time || "00:00"}`;
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

  const limit = isCinema ? 50 : 20;
  return [...winnersBySlot.values()]
    .sort((a, b) => {
      if (a.start_date !== b.start_date) {
        return a.start_date.localeCompare(b.start_date);
      }
      return (a.start_time || "").localeCompare(b.start_time || "");
    })
    .slice(0, limit);
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
    "id, name, slug, venue_type, location_designator, neighborhood, lat, lng, image_url, short_description, hours, hours_display, vibes";

  let spots: NearbyDestination[] | null = null;

  if (spot.neighborhood) {
    const { data, error } = await supabase
      .from("venues")
      .select(selectFields)
      .eq("neighborhood", spot.neighborhood)
      .in("venue_type", allDestinationTypes)
      .eq("active", true)
      .neq("id", spot.id)
      .limit(100);
    if (error) {
      console.error("[spot-detail] nearby query failed:", error.message);
      return nearbyDestinations;
    }
    spots = (data || null) as NearbyDestination[] | null;
  } else if (spot.lat && spot.lng) {
    // Geo-bounded query: fetch venues within ~1.5mi bounding box instead of full table scan
    const latDelta = 1.5 / 69; // ~1.5 miles in degrees latitude
    const lngDelta = 1.5 / (69 * Math.cos((spot.lat * Math.PI) / 180));
    const { data, error } = await supabase
      .from("venues")
      .select(selectFields)
      .in("venue_type", allDestinationTypes)
      .eq("active", true)
      .neq("id", spot.id)
      .gte("lat", spot.lat - latDelta)
      .lte("lat", spot.lat + latDelta)
      .gte("lng", spot.lng - lngDelta)
      .lte("lng", spot.lng + lngDelta)
      .limit(50);
    if (error) {
      console.error("[spot-detail] nearby geo query failed:", error.message);
      return nearbyDestinations;
    }
    spots = (data || null) as NearbyDestination[] | null;
  }

  if (!spots) {
    return nearbyDestinations;
  }

  for (const dest of spots) {
    let distance: number | undefined;

    if (dest.lat && dest.lng && spot.lat && spot.lng) {
      distance = getDistanceMiles(spot.lat, spot.lng, dest.lat, dest.lng);
      // Cap at 1.5 miles — "nearby" means walkable/short-drive, not across town
      if (distance > 1.5) {
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

// ---------------------------------------------------------------------------
// Main shared function
// ---------------------------------------------------------------------------

export async function getSpotDetail(slug: string): Promise<SpotDetailPayload | null> {
  const supabase = await createClient();

  const { data: spotData, error } = await supabase
    .from("venues")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !spotData) {
    return null;
  }

  const spot = spotData as SpotRecord;
  const spotSlug = typeof spot.slug === "string" ? spot.slug : slug;
  const yonderDestinationIntelligence =
    getYonderDestinationIntelligence(spotSlug);
  const yonderAccommodationInventorySource =
    getYonderAccommodationInventorySource(spotSlug);
  const yonderRuntimeInventorySnapshotPromise =
    getYonderRuntimeInventorySnapshot(spotSlug);
  const today = getLocalDateString();

  const nearbyDestinationsPromise = fetchNearbyDestinations(supabase, spot);
  const highlightsPromise = supabase
    .from("venue_highlights")
    .select("id, highlight_type, title, description, image_url, sort_order, url")
    .eq("venue_id", spot.id)
    .order("sort_order", { ascending: true });
  const artifactsPromise = supabase
    .from("venues")
    .select("id, name, slug, venue_type, image_url, short_description")
    .eq("parent_venue_id", spot.id)
    .in("venue_type", [...ATTACHED_CHILD_DESTINATION_VENUE_TYPES])
    .eq("active", true)
    .order("name", { ascending: true });
  const featuresPromise = supabase
    .from("venue_features")
    .select("id, slug, title, feature_type, description, image_url, is_seasonal, start_date, end_date, price_note, is_free, sort_order, url")
    .eq("venue_id", spot.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  const specialsPromise = supabase
    .from("venue_specials")
    .select("id, title, type, description, days_of_week, time_start, time_end, price_note, image_url, source_url")
    .eq("venue_id", spot.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  const editorialMentionsPromise = supabase
    .from("editorial_mentions")
    .select("id, source_key, article_url, article_title, mention_type, published_at, guide_name, snippet, relevance")
    .eq("venue_id", spot.id)
    .eq("is_active", true)
    .eq("relevance", "primary")
    .order("published_at", { ascending: false })
    .limit(10);
  const occasionsPromise = supabase
    .from("venue_occasions")
    .select("occasion, confidence, source")
    .eq("venue_id", spot.id)
    .gte("confidence", 0.5)
    .order("confidence", { ascending: false });

  type WalkableRow = {
    walk_minutes: number;
    neighbor: { id: number; name: string; slug: string } | null;
  };

  const walkableNeighborCount =
    typeof spot.walkable_neighbor_count === "number" ? spot.walkable_neighbor_count : 0;
  const walkableNeighborsPromise =
    walkableNeighborCount > 0
      ? supabase
          .from("walkable_neighbors" as never)
          .select(`walk_minutes, neighbor:neighbor_id(id, name, slug)`)
          .eq("venue_id", spot.id)
          .order("walk_minutes", { ascending: true })
          .limit(10)
      : Promise.resolve({ data: [] as WalkableRow[] });

  const isCinema = (spotData as Record<string, unknown>).venue_type === "cinema";

  // Over-fetch to allow post-query slot dedupe and quality ranking.
  const { data: upcomingEvents } = await applyVenueGate(
    supabase
      .from("events")
      .select(`
        id, title, start_date, end_date, start_time, end_time, is_free, price_min, category_id, source_url, ticket_url,
        series_id, image_url,
        series:series!events_series_id_fkey(id, slug, title, series_type, image_url)
      `)
      .eq("venue_id", spot.id)
      .is("canonical_event_id", null)
      .or(`start_date.gte.${today},end_date.gte.${today}`)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(isCinema ? 150 : 60)
  );

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

    artistsByEventId =
      (artistRows as EventArtistRow[] | null)?.reduce(
        (map, row) => {
          const list = map.get(row.event_id) || [];
          list.push(row);
          map.set(row.event_id, list);
          return map;
        },
        new Map<number, EventArtistRow[]>()
      ) || new Map<number, EventArtistRow[]>();
  }

  const dedupedRows = dedupeBySlot(eventRows, artistsByEventId, isCinema);
  const upcomingEventIds = dedupedRows.map((event) => event.id);
  const upcomingCountsPromise = fetchSocialProofCounts(upcomingEventIds);

  const [
    upcomingCounts,
    nearbyDestinations,
    yonderRuntimeInventorySnapshot,
    { data: highlights },
    { data: artifacts },
    { data: features },
    { data: specials },
    { data: editorialMentions },
    { data: occasions },
    { data: walkableNeighborsRaw },
  ] = await Promise.all([
    upcomingCountsPromise,
    nearbyDestinationsPromise,
    yonderRuntimeInventorySnapshotPromise,
    highlightsPromise,
    artifactsPromise,
    featuresPromise,
    specialsPromise,
    editorialMentionsPromise,
    occasionsPromise,
    walkableNeighborsPromise,
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
      category: event.category_id,
      series_id: event.series_id,
      series: event.series,
      image_url: event.image_url,
      artists,
      lineup: artists.map((artist) => artist.name).join(", ") || null,
      going_count: counts?.going || 0,
      interested_count: counts?.interested || 0,
      recommendation_count: counts?.recommendations || 0,
    };
  });

  const walkableNeighbors: WalkableNeighbor[] = (
    (walkableNeighborsRaw || []) as unknown as WalkableRow[]
  )
    .filter((row) => row.neighbor != null)
    .map((row) => ({
      id: row.neighbor!.id,
      name: row.neighbor!.name,
      slug: row.neighbor!.slug,
      walk_minutes: row.walk_minutes,
    }));

  return {
    spot: spotData as Record<string, unknown>,
    upcomingEvents: upcomingEventsWithCounts,
    nearbyDestinations,
    highlights: dedupeVenueHighlights(
      (highlights as VenueHighlightRow[] | null) || []
    ) as unknown as Array<Record<string, unknown>>,
    attachedChildDestinations:
      (artifacts as AttachedChildDestinationRow[] | null) || [],
    artifacts: (artifacts || []) as Array<Record<string, unknown>>,
    features: (features as VenueFeatureRow[] | null) || [],
    specials: (specials as VenueSpecialRow[] | null) || [],
    editorialMentions: (editorialMentions as EditorialMentionRow[] | null) || [],
    occasions: (occasions as VenueOccasionRow[] | null) || [],
    walkableNeighbors,
    yonderDestinationIntelligence,
    yonderAccommodationInventorySource,
    yonderRuntimeInventorySnapshot,
  };
}

/**
 * Standalone helper to fetch nearby destinations for any venue.
 * Used by the SSR event page to populate "Around Here" without duplicating query logic.
 */
export async function getNearbyDestinationsForVenue(venue: {
  id: number;
  neighborhood?: string | null;
  lat?: number | null;
  lng?: number | null;
}): Promise<Record<string, NearbyDestination[]>> {
  const supabase = await createClient();
  return fetchNearbyDestinations(supabase, venue as SpotRecord);
}
