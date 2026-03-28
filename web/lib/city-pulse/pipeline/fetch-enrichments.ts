/**
 * Pipeline stage 4: Enrichment queries.
 *
 * Fires in two sub-phases:
 *
 *  Phase A (parallel with event pools):
 *    - Weather venues
 *    - Venue specials
 *    - CMS curated sections
 *    - Feed headers
 *    - User profile (for display_name in header)
 *    - User signals (prefs, follows, friends)
 *
 *  Phase B (depends on Phase A + event IDs):
 *    - Social proof counts
 *    - Friend RSVPs + profiles
 *    - New-from-followed-spots events
 *
 * Phase A runs inside the same big Promise.all as fetchEventPools and
 * fetchFeedCounts. Phase B runs in a second Promise.all after event IDs
 * are known.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedEventData } from "@/components/EventCard";
import type { Spot } from "@/lib/spots-constants";
import type { PipelineContext } from "./resolve-portal";
import type { RawPortalSection } from "@/lib/city-pulse/curated-sections";
import type { FeedHeaderRow, FriendGoingInfo } from "@/lib/city-pulse/types";
import type { UserSignals } from "@/lib/city-pulse/types";
import { getWeatherVenueFilter } from "@/lib/city-pulse/weather-mapping";
import { getSpecialStatus } from "@/lib/city-pulse/specials";
import type { SpecialRow } from "@/lib/city-pulse/specials";
import { loadUserSignals } from "@/lib/city-pulse/user-signals";
import { fetchSocialProofCounts } from "@/lib/social-proof";
import { buildFriendsGoingMap } from "@/lib/city-pulse/counts";
import { fetchNewFromSpots } from "./fetch-events";
import type { CityPulseSpecialItem, EditorialMention } from "@/lib/city-pulse/types";
import type { WeatherData } from "@/lib/weather-utils";

// ---------------------------------------------------------------------------
// Shared venue SELECT
// ---------------------------------------------------------------------------

export const VENUE_SELECT = `
  id, name, slug, address, neighborhood, city, place_type,
  venue_types, lat, lng, image_url, short_description,
  vibes, genres, price_level, hours_display,
  hours, featured, active,
  location_designator
`;

// ---------------------------------------------------------------------------
// Phase A: parallel enrichments (no event ID dependency)
// ---------------------------------------------------------------------------

export type PhaseAEnrichments = {
  weatherVenues: Spot[];
  weatherFilter: ReturnType<typeof getWeatherVenueFilter> | null;
  activeSpecials: CityPulseSpecialItem["special"][];
  rawCuratedSections: RawPortalSection[];
  headerCandidates: FeedHeaderRow[];
  userProfile: { display_name: string | null; username: string | null } | null;
  userSignals: UserSignals | null;
};

/**
 * Fetch all Phase A enrichments in a single Promise.all.
 * Should be called inside the same outer Promise.all as fetchEventPools/fetchFeedCounts.
 */
export async function fetchPhaseAEnrichments(
  supabase: SupabaseClient,
  ctx: PipelineContext,
): Promise<PhaseAEnrichments> {
  const skipSpecials = ctx.manifest.contentPolicy.skipEnrichments.specials;
  const skipWeatherVenues = ctx.manifest.contentPolicy.skipEnrichments.weatherVenues;

  const weatherFilter = ctx.feedContext.weather
    ? getWeatherVenueFilter(ctx.feedContext.weather as WeatherData)
    : null;

  // Build weather venue query
  const weatherVenuePromise: Promise<{ data: unknown[] | null }> = !skipWeatherVenues && weatherFilter
    ? (() => {
        const typesList = weatherFilter.venue_types.join(",");
        const vibesList = weatherFilter.vibes.join(",");
        let q = supabase
          .from("places")
          .select(VENUE_SELECT)
          .eq("active", true)
          .or(`venue_type.in.(${typesList}),vibes.ov.{${vibesList}}`);
        if (ctx.geoCenter) {
          const radiusKm = ctx.portalFilters.geo_radius_km ?? 25;
          const degOffset = radiusKm / 111;
          q = q
            .gte("lat", ctx.geoCenter[0] - degOffset)
            .lte("lat", ctx.geoCenter[0] + degOffset)
            .gte("lng", ctx.geoCenter[1] - degOffset)
            .lte("lng", ctx.geoCenter[1] + degOffset);
        } else if (ctx.portalCity) {
          q = q.ilike("city", `%${ctx.portalCity}%`);
        }
        return q.limit(20) as unknown as Promise<{ data: unknown[] | null }>;
      })()
    : Promise.resolve({ data: [] });

  // Specials query
  const specialsPromise = skipSpecials
    ? Promise.resolve({ data: [] })
    : (() => {
        let q = supabase
          .from("place_specials")
          .select(`
        id, place_id, title, type, description,
        days_of_week, time_start, time_end,
        start_date, end_date, price_note,
        venue:places!inner(id, name, slug, neighborhood, place_type, image_url, city)
      `)
          .eq("is_active", true)
          .eq("venue.is_active", true);
        if (ctx.portalCity) {
          q = q.ilike("venue.city", `%${ctx.portalCity}%`);
        }
        return q.limit(50);
      })();

  const [
    weatherVenuesResult,
    specialsResult,
    curatedResult,
    headersResult,
    profileResult,
    userSignals,
  ] = await Promise.all([
    weatherVenuePromise,
    specialsPromise,
    // Curated portal sections
    supabase
      .from("portal_sections")
      .select(`
        id, title, slug, description, section_type, block_type,
        layout, items_per_row, max_items, auto_filter, block_content,
        display_order, is_visible,
        schedule_start, schedule_end, show_on_days,
        show_after_time, show_before_time, style,
        portal_section_items(id, entity_type, entity_id, display_order)
      `)
      .eq("portal_id", ctx.portalData.id)
      .eq("is_visible", true)
      .order("display_order", { ascending: true }),
    // Feed header CMS configs
    supabase
      .from("portal_feed_headers")
      .select("*")
      .eq("portal_id", ctx.portalData.id)
      .eq("is_active", true)
      .order("priority", { ascending: true }),
    // User profile for header template vars
    ctx.userId
      ? supabase
          .from("profiles")
          .select("display_name, username")
          .eq("id", ctx.userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // User personalization signals
    loadUserSignals(supabase, ctx.userId, ctx.portalData.id),
  ]);

  // Process specials: compute live status and filter to active/soon
  const rawSpecials = (specialsResult.data || []) as unknown as Array<
    SpecialRow & {
      venue: Pick<Spot, "id" | "name" | "slug" | "neighborhood" | "venue_type" | "image_url">;
    }
  >;

  const activeSpecials: CityPulseSpecialItem["special"][] = [];
  for (const s of rawSpecials) {
    const status = getSpecialStatus(s, ctx.now, ctx.today);
    if (status.state === "active_now" || status.state === "starting_soon") {
      activeSpecials.push({
        id: s.id,
        venue: s.venue,
        title: s.title,
        type: s.type,
        state: status.state,
        starts_in_minutes: status.startsInMinutes,
        remaining_minutes: status.remainingMinutes,
        price_note: s.price_note,
        description: s.description,
      });
    }
  }

  // Sort: active_now first, then starting_soon by time
  activeSpecials.sort((a, b) => {
    if (a.state === "active_now" && b.state !== "active_now") return -1;
    if (a.state !== "active_now" && b.state === "active_now") return 1;
    return (a.starts_in_minutes ?? 999) - (b.starts_in_minutes ?? 999);
  });

  return {
    weatherVenues: (weatherVenuesResult.data || []) as Spot[],
    weatherFilter,
    activeSpecials,
    rawCuratedSections: (curatedResult.data || []) as unknown as RawPortalSection[],
    headerCandidates: (headersResult.data || []) as FeedHeaderRow[],
    userProfile: profileResult.data as {
      display_name: string | null;
      username: string | null;
    } | null,
    userSignals,
  };
}

// ---------------------------------------------------------------------------
// Phase B: social proof + friend RSVPs + new from spots
// ---------------------------------------------------------------------------

export type PhaseBEnrichments = {
  socialCounts: Map<number, { going: number; interested: number }>;
  friendsGoingMap: Record<number, FriendGoingInfo[]>;
  newFromSpots: FeedEventData[];
  editorialMap: Record<number, EditorialMention[]>;
};

/**
 * Fetch Phase B enrichments in parallel. Requires event IDs from Phase A
 * event pools and userSignals from Phase A enrichments.
 */
export async function fetchPhaseBEnrichments(
  supabase: SupabaseClient,
  portalClient: SupabaseClient,
  ctx: PipelineContext,
  allEventIds: number[],
  allPlaceIds: number[],
  userSignals: UserSignals | null,
): Promise<PhaseBEnrichments> {
  const editorialPromise: Promise<EditorialMention[]> = allPlaceIds.length > 0
    ? Promise.resolve(
        supabase
          .from("editorial_mentions")
          .select("place_id, source_key, snippet, article_url, guide_name")
          .in("place_id", allPlaceIds),
      ).then(({ data }) => (data ?? []) as unknown as EditorialMention[])
    : Promise.resolve([]);

  const [socialCounts, friendsGoingMap, newFromSpots, editorialRows] =
    await Promise.all([
      fetchSocialProofCounts(allEventIds),
      buildFriendsGoingMap(
        supabase,
        allEventIds,
        userSignals?.friendIds ?? [],
      ),
      fetchNewFromSpots(
        portalClient,
        ctx,
        userSignals?.followedVenueIds ?? [],
      ),
      editorialPromise,
    ]);

  // Quality filter for editorial snippets — reject catalog intros and generic boilerplate
  const LOW_QUALITY_SNIPPET_PATTERNS = [
    /^in addition to/i,
    /^the following/i,
    /listed below/i,
    /^here are/i,
    /^check out/i,
    /^see (the|our|more)/i,
  ];

  function isQualitySnippet(snippet: string): boolean {
    return !LOW_QUALITY_SNIPPET_PATTERNS.some((p) => p.test(snippet));
  }

  // Build place_id → EditorialMention[] lookup map
  // (DB column is still venue_id until Deploy 10)
  const editorialMap: Record<number, EditorialMention[]> = {};
  for (const row of editorialRows as Array<EditorialMention & { venue_id: number }>) {
    if (!row.snippet || !isQualitySnippet(row.snippet)) continue;
    const placeId = row.venue_id;
    if (!editorialMap[placeId]) editorialMap[placeId] = [];
    editorialMap[placeId].push({
      source_key: row.source_key,
      snippet: row.snippet,
      article_url: row.article_url,
      guide_name: row.guide_name,
    });
  }

  return { socialCounts, friendsGoingMap, newFromSpots, editorialMap };
}
