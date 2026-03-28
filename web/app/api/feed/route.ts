import { NextResponse } from "next/server";
import { createClient, createPortalScopedClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";
import { escapeSQLPattern, errorResponse } from "@/lib/api-utils";
import { resolvePortalQueryContext, getVerticalFromRequest } from "@/lib/portal-query-context";
import {
  applyPortalScopeToQuery,
  filterByPortalCity,
  filterByPortalContentScope,
  type PortalContentFilters,
} from "@/lib/portal-scope";
import {
  isChainCinemaVenue,
  isRegularShowtimeEvent,
} from "@/lib/cinema-filter";
import {
  suppressEventImageIfVenueFlagged,
  suppressEventImagesIfVenueFlagged,
} from "@/lib/image-quality-suppression";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";

import { filterOutInactiveVenueEvents } from "@/lib/event-feed-health";
import { applyFeedGate } from "@/lib/feed-gate";
import {
  buildPersonalizedFeedSections,
  rankAndFilterPersonalizedFeedEvents,
  type FeedRecommendationReason,
} from "@/lib/feed-personalization";
import { isSceneEvent } from "@/lib/scene-event-routing";
import { buildFeedRequestPlan } from "@/lib/feed-request-plan";
import { getCachedFeedSocialGraphContext } from "@/lib/feed-social-graph-context";
import { ENABLE_INTEREST_CHANNELS_V1 } from "@/lib/launch-flags";
import { createServerTimingRecorder } from "@/lib/server-timing";
import {
  getUserSubscribedChannelMatchesForEvents,
  type EventChannelMatch,
} from "@/lib/interest-channel-matches";

import { fetchSocialProofCounts } from "@/lib/social-proof";
import { format, startOfDay, addDays } from "date-fns";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type FeedSectionId =
  | "tonight_for_you"
  | "this_week_fits_your_taste"
  | "from_places_people_you_follow"
  | "explore_something_new";

const FEED_RESPONSE_CACHE_TTL_MS = 30 * 1000;
const FEED_RESPONSE_CACHE_MAX_ENTRIES = 200;
const FEED_RESPONSE_CACHE_NAMESPACE = "api:feed";
const FEED_RESPONSE_IN_FLIGHT_LOADS = new Map<string, Promise<Response>>();

async function getCachedFeedResponse(
  key: string
): Promise<Record<string, unknown> | null> {
  return getSharedCacheJson<Record<string, unknown>>(
    FEED_RESPONSE_CACHE_NAMESPACE,
    key
  );
}

async function setCachedFeedResponse(
  key: string,
  payload: Record<string, unknown>
): Promise<void> {
  await setSharedCacheJson(
    FEED_RESPONSE_CACHE_NAMESPACE,
    key,
    payload,
    FEED_RESPONSE_CACHE_TTL_MS,
    { maxEntries: FEED_RESPONSE_CACHE_MAX_ENTRIES }
  );
}

// Helper to parse cursor for pagination
function parseCursor(
  cursorStr: string | null,
): { lastScore: number; lastId: number; lastDate: string } | null {
  if (!cursorStr) return null;
  try {
    const decoded = Buffer.from(cursorStr, "base64").toString("utf-8");
    const [score, id, date] = decoded.split("|");
    return {
      lastScore: parseFloat(score),
      lastId: parseInt(id, 10),
      lastDate: date,
    };
  } catch {
    return null;
  }
}

// Helper to create cursor for pagination
function createCursor(score: number, id: number, date: string): string {
  return Buffer.from(`${score}|${id}|${date}`).toString("base64");
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is string => typeof value === "string");
}

function normalizeLowercaseStringList(values: unknown): string[] {
  return normalizeStringList(values).map((value) => value.toLowerCase());
}

export async function GET(request: Request) {
  // Rate limit: expensive endpoint (7+ queries per request)
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.feed,
    getClientIdentifier(request),
    {
      bucket: "feed:global",
      logContext: "feed:global",
    }
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const timing = createServerTimingRecorder();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      150,
    );

    // New filter parameters
    const categories = searchParams
      .get("categories")
      ?.split(",")
      .filter(Boolean);
    const tags = searchParams.get("tags")?.split(",").filter(Boolean);
    const neighborhoods = searchParams
      .get("neighborhoods")
      ?.split(",")
      .filter(Boolean);
    const dateFilter = searchParams.get("date"); // today, tomorrow, weekend, week
    const searchQuery = searchParams.get("search");
    const freeOnly = searchParams.get("free") === "1";
    const cursor = searchParams.get("cursor");
    const personalized = searchParams.get("personalized") !== "0"; // Default true

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const responseHeaders = {
      // Private cache for user-specific content
      "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
    };
    const requestPlan = buildFeedRequestPlan({
      personalized,
      hasCategories: Boolean(categories?.length),
      hasSearchQuery: Boolean(searchQuery),
      hasTags: Boolean(tags?.length),
      hasNeighborhoods: Boolean(neighborhoods?.length),
      hasDateFilter: Boolean(dateFilter),
      freeOnly,
      hasCursor: Boolean(cursor),
    });
    const cacheKey = `${user.id}|${searchParams.toString()}|${Math.floor(Date.now() / FEED_RESPONSE_CACHE_TTL_MS)}`;
    const cachedResponse = await timing.measure("cache_lookup", () =>
      getCachedFeedResponse(cacheKey)
    );
    if (cachedResponse) {
      timing.addMetric("cache_hit", 0, "shared");
      return NextResponse.json(cachedResponse, {
        headers: {
          ...responseHeaders,
          "Server-Timing": timing.toHeader(),
        },
      });
    }

    const existingFeedLoad = FEED_RESPONSE_IN_FLIGHT_LOADS.get(cacheKey);
    if (existingFeedLoad) {
      return existingFeedLoad;
    }

    const feedLoadPromise = (async (): Promise<Response> => {
    const supabase = await createClient();
    const serviceClient = createServiceClient();

    // Calculate date range for trending events
    const now = new Date();
    const todayForTrending = format(startOfDay(now), "yyyy-MM-dd");
    const weekFromNow = format(addDays(startOfDay(now), 7), "yyyy-MM-dd");
    const hours48Ago = new Date(
      now.getTime() - 48 * 60 * 60 * 1000,
    ).toISOString();

    // Get portal context, user preferences, and trending events in parallel (independent queries)
    const [portalContext, prefsResult, trendingEventsResult] =
      await timing.measure("bootstrap", () =>
        Promise.all([
          resolvePortalQueryContext(supabase, searchParams, getVerticalFromRequest(request)),
          supabase
            .from("user_preferences")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
          // Fetch trending events (same logic as /api/trending)
          requestPlan.shouldFetchTrending
            ? supabase
                .from("events")
                .select(
                  `
        id,
        title,
        start_date,
        start_time,
        end_date,
        end_time,
        is_all_day,
        is_free,
        is_adult,
        is_recurring,
        is_tentpole,
        category_id,
        genres,
        tags,
        image_url,
        blurhash,
        series_id,
        series:series_id(
          id,
          slug,
          title,
          series_type,
          image_url,
          frequency,
          day_of_week,
          festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
        ),
        venue:venues(id, name, slug, neighborhood, location_designator, blurhash, city, image_url, active)
      `,
              )
              .gte("start_date", todayForTrending)
              .lte("start_date", weekFromNow)
              .is("canonical_event_id", null)
              .is("portal_id", null)
              .or("is_feed_ready.eq.true,is_feed_ready.is.null")
              .or("is_sensitive.eq.false,is_sensitive.is.null")
              .order("start_date", { ascending: true })
              .order("data_quality", { ascending: false, nullsFirst: false })
                .limit(200)
            : Promise.resolve({ data: null, error: null }),
        ])
      );

    if (portalContext.hasPortalParamMismatch) {
      return NextResponse.json(
        {
          error:
            "portal and portal_id parameters must reference the same portal",
        },
        { status: 400 },
      );
    }

    const portalId = portalContext.portalId;
    const portalSettings = portalContext.portalSettings;
    const recommendationLabels = (
      typeof portalSettings.recommendation_labels === "object" &&
      portalSettings.recommendation_labels !== null &&
      !Array.isArray(portalSettings.recommendation_labels)
    )
      ? (portalSettings.recommendation_labels as Record<string, string>)
      : null;
    const portalClient = await createPortalScopedClient(portalId);
    const portalFilters = portalContext.filters;

    const prefsData = prefsResult.data;

    type UserPrefs = {
      favorite_categories: string[] | null;
      favorite_genres?: Record<string, string[]> | null;
      favorite_neighborhoods: string[] | null;
      favorite_vibes: string[] | null;
      hide_adult_content?: boolean | null;
      needs_accessibility?: string[] | null;
      needs_dietary?: string[] | null;
      needs_family?: string[] | null;
      cross_portal_recommendations?: boolean | null;
      price_preference: string | null;
    };

    const prefs = prefsData as UserPrefs | null;
    const favoriteNeighborhoods = normalizeStringList(
      prefs?.favorite_neighborhoods,
    );
    const favoriteCategories = normalizeStringList(prefs?.favorite_categories);
    const favoriteGenres = Object.values(prefs?.favorite_genres || {})
      .flat()
      .filter((genre): genre is string => typeof genre === "string")
      .map((genre) => genre.toLowerCase());
    const favoriteGenreSet = new Set(favoriteGenres);
    const needsAccessibility = normalizeLowercaseStringList(
      prefs?.needs_accessibility,
    );
    const needsDietary = normalizeLowercaseStringList(prefs?.needs_dietary);
    const needsFamily = normalizeLowercaseStringList(prefs?.needs_family);
    const hideAdultContent = prefs?.hide_adult_content ?? false;
    const crossPortalRecommendations =
      prefs?.cross_portal_recommendations ?? true;
    const shouldRestrictToPortal = Boolean(
      portalId && !crossPortalRecommendations,
    );

    const {
      followedVenueIds,
      followedOrganizationIds,
      producerSourceIds,
      sourceOrganizationMap,
      friendIds,
    } = await timing.measure("social_graph_context", () =>
      getCachedFeedSocialGraphContext(supabase as never, user.id, portalId)
    );

    // Get events friends are going to
    // Use local date (not UTC from toISOString)
    const today = getLocalDateString();

    // Calculate date range based on dateFilter parameter
    let startDateFilter = today;
    let endDateFilter: string | null = null;

    if (dateFilter) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      switch (dateFilter) {
        case "today":
          startDateFilter = today;
          endDateFilter = today;
          break;
        case "tomorrow": {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          startDateFilter = getLocalDateString(tomorrow);
          endDateFilter = startDateFilter;
          break;
        }
        case "weekend": {
          const dayOfWeek = now.getDay();
          const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
          const saturday = new Date(now);
          saturday.setDate(
            saturday.getDate() + (dayOfWeek === 6 ? 0 : daysUntilSaturday),
          );
          const sunday = new Date(saturday);
          sunday.setDate(sunday.getDate() + 1);
          startDateFilter = getLocalDateString(saturday);
          endDateFilter = getLocalDateString(sunday);
          break;
        }
        case "week": {
          const weekEnd = new Date(now);
          weekEnd.setDate(weekEnd.getDate() + 7);
          startDateFilter = today;
          endDateFilter = getLocalDateString(weekEnd);
          break;
        }
      }
    }

    // Build personalized event query - fetch broadly, score later
    // When personalized=true, we pre-filter to followed entities
    // When personalized=false, we show all events (with additional filters)
    let query = portalClient
      .from("events")
      .select(
        `
      id,
      title,
      start_date,
      start_time,
      end_date,
      end_time,
      is_all_day,
      is_free,
      price_min,
      price_max,
      category_id,
      genres,
      tags,
      image_url,
      blurhash,
      ticket_url,
      organization_id,
      source_id,
      portal_id,
      is_recurring,
      is_tentpole,
      series_id,
      series:series_id(
        id,
        slug,
        title,
        series_type,
        image_url,
        frequency,
        day_of_week,
        festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
      ),
      venue:venues(id, name, neighborhood, slug, location_designator, blurhash, city, lat, lng, image_url, active)
    `,
      )
      .or(`start_date.gte.${startDateFilter},end_date.gte.${startDateFilter}`) // Include ongoing events (multi-day events with end_date)
      .is("canonical_event_id", null) // Only show canonical events, not duplicates
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null")
      .not("category_id", "in", "(support,support_group)") // Support/recovery meetings never in the main discovery feed
      .order("start_date", { ascending: true })
      .order("data_quality", { ascending: false, nullsFirst: false });

    if (hideAdultContent) {
      query = query.or("is_adult.eq.false,is_adult.is.null");
    }

    query = applyFeedGate(query);

    // Apply end date filter if specified
    if (endDateFilter) {
      query = query.lte("start_date", endDateFilter);
    }

    query = applyPortalScopeToQuery(query, {
      portalId,
      portalExclusive: shouldRestrictToPortal,
      publicOnlyWhenNoPortal: true,
    });

    // Apply portal category filters if specified (only if no explicit category filter)
    if (portalId && portalFilters.categories?.length && !categories?.length) {
      query = query.in("category_id", portalFilters.categories);
    }

    // Exclude categories from portal filters (always apply)
    if (portalId && portalFilters.exclude_categories?.length) {
      query = query.not(
        "category_id",
        "in",
        `(${portalFilters.exclude_categories.join(",")})`
      );
    }

    // Apply explicit category filter
    if (categories?.length) {
      query = query.in("category_id", categories);
    }

    // Apply free filter
    if (freeOnly) {
      query = query.eq("is_free", true);
    }

    // Apply search filter
    if (searchQuery) {
      query = query.ilike("title", `%${escapeSQLPattern(searchQuery)}%`);
    }

    // Set limit based on personalized mode
    // When personalized, we need to fetch more for scoring/filtering
    // When not personalized, use standard limit
    query = query.limit(personalized ? Math.max(limit * 4, 150) : limit + 1);

    // Parallelize all independent event queries
    const eventSelect = `
    id,
    title,
    start_date,
    start_time,
    end_date,
    end_time,
    is_all_day,
    is_free,
    price_min,
    price_max,
    category:category_id,
    genres,
    tags,
    image_url,
    blurhash,
    ticket_url,
    organization_id,
    source_id,
    portal_id,
    series_id,
    series:series_id(
      id,
      slug,
      title,
      series_type,
      image_url,
      frequency,
      day_of_week,
      festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
    ),
    venue:venues(id, name, neighborhood, slug, location_designator, blurhash, city, image_url, active)
  `;

    const shouldRunSupplementalQueries =
      requestPlan.shouldRunSupplementalQueries;

    // Build all queries, tracking which ones we're running
    type FeedQueryResult = {
      data: unknown[] | null;
      error: unknown;
    };
    const queries: Array<PromiseLike<FeedQueryResult>> = [];
    const queryTypes: string[] = [];

    queries.push(query);
    queryTypes.push("main");

    // Followed venues query
    if (shouldRunSupplementalQueries && followedVenueIds.length > 0) {
      let venueQuery = portalClient
        .from("events")
        .select(eventSelect)
        .in("venue_id", followedVenueIds)
        .gte("start_date", today)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .order("start_date", { ascending: true })
        .order("data_quality", { ascending: false, nullsFirst: false })
        .limit(50);

      if (hideAdultContent) {
        venueQuery = venueQuery.or("is_adult.eq.false,is_adult.is.null");
      }

      venueQuery = applyPortalScopeToQuery(venueQuery, {
        portalId,
        portalExclusive: shouldRestrictToPortal,
        publicOnlyWhenNoPortal: true,
      });

      venueQuery = applyFeedGate(venueQuery);
      queries.push(venueQuery);
      queryTypes.push("venue");
    }

    // Followed organizations by organization_id query
    if (shouldRunSupplementalQueries && followedOrganizationIds.length > 0) {
      let producerQuery = portalClient
        .from("events")
        .select(eventSelect)
        .in("organization_id", followedOrganizationIds)
        .gte("start_date", today)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .order("start_date", { ascending: true })
        .order("data_quality", { ascending: false, nullsFirst: false })
        .limit(50);

      if (hideAdultContent) {
        producerQuery = producerQuery.or("is_adult.eq.false,is_adult.is.null");
      }

      producerQuery = applyPortalScopeToQuery(producerQuery, {
        portalId,
        portalExclusive: shouldRestrictToPortal,
        publicOnlyWhenNoPortal: true,
      });

      producerQuery = applyFeedGate(producerQuery);
      queries.push(producerQuery);
      queryTypes.push("org");
    }

    // Followed organizations by source_id query
    if (shouldRunSupplementalQueries && producerSourceIds.length > 0) {
      let sourceQuery = portalClient
        .from("events")
        .select(eventSelect)
        .in("source_id", producerSourceIds)
        .gte("start_date", today)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .order("start_date", { ascending: true })
        .order("data_quality", { ascending: false, nullsFirst: false })
        .limit(50);

      if (hideAdultContent) {
        sourceQuery = sourceQuery.or("is_adult.eq.false,is_adult.is.null");
      }

      sourceQuery = applyPortalScopeToQuery(sourceQuery, {
        portalId,
        portalExclusive: shouldRestrictToPortal,
        publicOnlyWhenNoPortal: true,
      });

      sourceQuery = applyFeedGate(sourceQuery);
      queries.push(sourceQuery);
      queryTypes.push("source");
    }

    // OPTIMIZATION: Fetch neighborhood events directly with venue join
    // This avoids the sequential query pattern (venues -> venue_ids -> events)
    if (shouldRunSupplementalQueries && favoriteNeighborhoods.length > 0) {
      // Query events with venues in favorite neighborhoods
      // We filter by joining venue data and checking neighborhood
      let neighborhoodQuery = portalClient
        .from("events")
        .select(`${eventSelect}, venue!inner(neighborhood)`)
        .in("venue.neighborhood", favoriteNeighborhoods)
        .gte("start_date", today)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .order("start_date", { ascending: true })
        .order("data_quality", { ascending: false, nullsFirst: false })
        .limit(50);

      if (hideAdultContent) {
        neighborhoodQuery = neighborhoodQuery.or(
          "is_adult.eq.false,is_adult.is.null",
        );
      }

      neighborhoodQuery = applyPortalScopeToQuery(neighborhoodQuery, {
        portalId,
        portalExclusive: shouldRestrictToPortal,
        publicOnlyWhenNoPortal: true,
      });

      neighborhoodQuery = applyFeedGate(neighborhoodQuery);
      queries.push(neighborhoodQuery);
      queryTypes.push("neighborhood");
    }

    // Category events query
    if (shouldRunSupplementalQueries && favoriteCategories.length > 0) {
      let categoryQuery = portalClient
        .from("events")
        .select(eventSelect)
        .in("category_id", favoriteCategories)
        .gte("start_date", today)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .order("start_date", { ascending: true })
        .order("data_quality", { ascending: false, nullsFirst: false })
        .limit(50);

      if (hideAdultContent) {
        categoryQuery = categoryQuery.or("is_adult.eq.false,is_adult.is.null");
      }

      categoryQuery = applyPortalScopeToQuery(categoryQuery, {
        portalId,
        portalExclusive: shouldRestrictToPortal,
        publicOnlyWhenNoPortal: true,
      });

      categoryQuery = applyFeedGate(categoryQuery);
      queries.push(categoryQuery);
      queryTypes.push("category");
    }

    // Execute all queries in parallel
    const results = await timing.measure("event_queries", () =>
      Promise.all(queries)
    );

    // Extract main result
    const mainResult = results[0];
    const { data: rawEventsData, error } = mainResult;
    const eventsData = ((rawEventsData || []) as Array<
      { id: number } & Record<string, unknown>
    >);

    if (error) {
      return errorResponse(error, "GET /api/feed");
    }

    // Merge additional results into followedEventsData, neighborhoodEventsData, categoryEventsData
    let followedEventsData: typeof eventsData = [];
    let neighborhoodEventsData: typeof eventsData = [];
    let categoryEventsData: typeof eventsData = [];

    // Parse additional results based on query types
    for (let i = 1; i < results.length; i++) {
      const result = results[i];
      const queryType = queryTypes[i];
      const { data } = result;

      if (data) {
        const supplementalData = data as typeof eventsData;
        if (
          queryType === "venue" ||
          queryType === "org" ||
          queryType === "source"
        ) {
          followedEventsData = [
            ...followedEventsData,
            ...supplementalData,
          ];
        } else if (queryType === "neighborhood") {
          neighborhoodEventsData = supplementalData;
        } else if (queryType === "category") {
          categoryEventsData = supplementalData;
        }
      }
    }

    const mainEventIds = new Set(
      eventsData.map((e) => e.id),
    );
    const uniqueFollowedEvents = followedEventsData.filter(
      (e) => !mainEventIds.has(e.id),
    );

    // Add followed events to the set
    for (const e of uniqueFollowedEvents as { id: number }[]) {
      mainEventIds.add(e.id);
    }

    // Add neighborhood events (avoiding duplicates with main + followed)
    const uniqueNeighborhoodEvents = neighborhoodEventsData.filter(
      (e) => !mainEventIds.has(e.id),
    );

    // Add neighborhood events to the set
    for (const e of uniqueNeighborhoodEvents as { id: number }[]) {
      mainEventIds.add(e.id);
    }

    // Add category events (avoiding duplicates with main + followed + neighborhood)
    const uniqueCategoryEvents = categoryEventsData.filter(
      (e) => !mainEventIds.has(e.id),
    );

    const mergedEventsData = [
      ...eventsData,
      ...uniqueFollowedEvents,
      ...uniqueNeighborhoodEvents,
      ...uniqueCategoryEvents,
    ];

    const friendsGoingMap: Record<
      number,
      { user_id: string; username: string; display_name: string | null }[]
    > = {};
    if (friendIds.length > 0 && mergedEventsData.length > 0) {
      await timing.measure("friend_signals", async () => {
        const candidateEventIds = [
          ...new Set((mergedEventsData as { id: number }[]).map((e) => e.id)),
        ];
        const { data: friendRsvpsData } = await supabase
          .from("event_rsvps")
          .select("event_id, user_id")
          .in("event_id", candidateEventIds)
          .in("user_id", friendIds)
          .in("status", ["going", "interested"]);

        const friendRsvps = (friendRsvpsData || []) as {
          event_id: number;
          user_id: string;
        }[];
        const rsvpUserIds = [
          ...new Set(friendRsvps.map((rsvp) => rsvp.user_id)),
        ];

        let profilesMap: Record<
          string,
          { username: string; display_name: string | null }
        > = {};
        if (rsvpUserIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, username, display_name")
            .in("id", rsvpUserIds);

          profilesMap = (profilesData || []).reduce(
            (acc, p) => {
              const profile = p as {
                id: string;
                username: string;
                display_name: string | null;
              };
              acc[profile.id] = {
                username: profile.username,
                display_name: profile.display_name,
              };
              return acc;
            },
            {} as Record<
              string,
              { username: string; display_name: string | null }
            >,
          );
        }

        for (const rsvp of friendRsvps) {
          const profile = profilesMap[rsvp.user_id];
          if (!profile) continue;
          if (!friendsGoingMap[rsvp.event_id]) {
            friendsGoingMap[rsvp.event_id] = [];
          }
          friendsGoingMap[rsvp.event_id].push({
            user_id: rsvp.user_id,
            username: profile.username,
            display_name: profile.display_name,
          });
        }
      });
    }

    type EventResult = {
      id: number;
      title: string;
      start_date: string;
      start_time: string | null;
      end_date: string | null;
      end_time: string | null;
      is_all_day: boolean;
      is_free: boolean;
      price_min: number | null;
      price_max: number | null;
      category: string | null;
      genres: string[] | null;
      tags: string[] | null;
      image_url: string | null;
      blurhash: string | null;
      ticket_url: string | null;
      organization_id: string | null;
      source_id: number | null;
      portal_id: string | null;
      series_id?: string | null;
      series?: {
        id: string;
        slug: string;
        title: string;
        series_type: string;
        image_url: string | null;
        frequency: string | null;
        day_of_week: string | null;
        festival?: {
          id: string;
          slug: string;
          name: string;
          image_url: string | null;
          blurhash: string | null;
          festival_type?: string | null;
          location: string | null;
          neighborhood: string | null;
        } | null;
      } | null;
      venue: {
        id: number;
        name: string;
        neighborhood: string | null;
        slug: string | null;
        blurhash: string | null;
        city?: string | null;
        active?: boolean | null;
      } | null;
      score?: number;
      reasons?: FeedRecommendationReason[];
      friends_going?: {
        user_id: string;
        username: string;
        display_name: string | null;
      }[];
      going_count?: number;
      interested_count?: number;
      recommendation_count?: number;
    };

    let events = suppressEventImagesIfVenueFlagged(
      (mergedEventsData || []) as EventResult[],
    );
    events = filterOutInactiveVenueEvents(events);

    // Filter out cross-city events that leak via portal_id=NULL
    events = filterByPortalCity(events, portalFilters.city, {
      allowMissingCity: true,
    });

    // Apply portal content filters (geo, neighborhoods, tags, venue_ids, price)
    if (portalId) {
      const contentFilters: PortalContentFilters = {
        neighborhoods: portalFilters.neighborhoods,
        geo_center: portalFilters.geo_center,
        geo_radius_km: portalFilters.geo_radius_km,
        price_max: portalFilters.price_max,
        venue_ids: portalFilters.venue_ids,
        tags: portalFilters.tags,
      };
      events = filterByPortalContentScope(events, contentFilters);
    }

    events = events.filter((event) => !isSceneEvent(event));

    let followedChannelCount = 0;
    let channelMatchesByEventId = new Map<number, EventChannelMatch[]>();

    if (ENABLE_INTEREST_CHANNELS_V1 && events.length > 0) {
      const channelMatchResult = await timing.measure("channel_matches", () =>
        getUserSubscribedChannelMatchesForEvents(
          serviceClient,
          user.id,
          events.map((event) => ({
            id: event.id,
            source_id: event.source_id ?? null,
            organization_id: event.organization_id ?? null,
            category: event.category ?? null,
            tags: event.tags || [],
            venue: event.venue ? { id: event.venue.id } : null,
          })),
          {
            portalId,
            includeUnscoped: true,
          },
        )
      );

      followedChannelCount = channelMatchResult.subscribedChannelCount;
      channelMatchesByEventId = channelMatchResult.matchesByEventId;
    }

    // Score, filter, and sort events by relevance
    await timing.measure("ranking", async () => {
      events = rankAndFilterPersonalizedFeedEvents(events, {
        now,
        tagsFilter: tags,
        neighborhoodsFilter: neighborhoods,
        favoriteCategories,
        favoriteGenreSet,
        favoriteNeighborhoods,
        needsAccessibility,
        needsDietary,
        needsFamily,
        followedVenueIds,
        followedOrganizationIds,
        sourceOrganizationMap,
        channelMatchesByEventId,
        friendsGoingMap,
        recommendationLabels,
        pricePreference: prefs?.price_preference || null,
        restrictToPersonalizedMatches:
          requestPlan.shouldRestrictToPersonalizedMatches,
        shouldSuppressRegularShowtime: (event) => {
          if (!isRegularShowtimeEvent(event.tags)) return false;
          if (event.venue?.id && followedVenueIds.includes(event.venue.id)) {
            return false;
          }
          return !event.venue || isChainCinemaVenue(event.venue);
        },
      });
    });

    // Handle cursor-based pagination
    const parsedCursor = parseCursor(cursor);
    let filteredEvents = events;

    if (parsedCursor) {
      // Find events after the cursor position
      const cursorIndex = events.findIndex(
        (e) =>
          e.score === parsedCursor.lastScore && e.id === parsedCursor.lastId,
      );
      if (cursorIndex !== -1) {
        filteredEvents = events.slice(cursorIndex + 1);
      }
    }

    type FeedSection = {
      id: FeedSectionId;
      title: string;
      description: string;
      events: EventResult[];
    };

    const shouldBuildSections = requestPlan.shouldBuildSections && !parsedCursor;

    const sections: FeedSection[] = [];

    await timing.measure("sections", async () => {
      if (shouldBuildSections) {
        sections.push(
          ...buildPersonalizedFeedSections(events, {
            now,
            today,
            weekFromNow,
            favoriteCategories,
            favoriteGenreSet,
            favoriteNeighborhoods,
            needsAccessibility,
            needsDietary,
            needsFamily,
          }),
        );
      }
    });

    // Get page of results
    const pageEvents = filteredEvents.slice(0, limit);
    const sectionEventIds = sections.flatMap((section) =>
      section.events.map((event) => event.id),
    );
    const countEventIds = [
      ...new Set([...pageEvents.map((event) => event.id), ...sectionEventIds]),
    ];
    const counts =
      countEventIds.length > 0
        ? await timing.measure("social_counts", () =>
            fetchSocialProofCounts(countEventIds)
          )
        : new Map<
            number,
            { going: number; interested: number; recommendations: number }
          >();

    const withCounts = (event: EventResult) => {
      const eventCounts = counts.get(event.id);
      return {
        ...event,
        going_count: eventCounts?.going || 0,
        interested_count: eventCounts?.interested || 0,
        recommendation_count: eventCounts?.recommendations || 0,
      };
    };

    const pageEventsWithCounts = pageEvents.map(withCounts);
    const sectionsWithCounts = sections.map((section) => ({
      ...section,
      events: section.events.map(withCounts),
    }));
    const hasMore = filteredEvents.length > limit;

    // Create cursor for next page
    let nextCursor: string | null = null;
    if (hasMore && pageEvents.length > 0) {
      const lastEvent = pageEventsWithCounts[pageEventsWithCounts.length - 1];
      nextCursor = createCursor(
        lastEvent.score || 0,
        lastEvent.id,
        lastEvent.start_date,
      );
    }

    // Build personalization metadata
    const personalization = {
      followedVenueIds,
      followedOrgIds: followedOrganizationIds,
      followedChannelCount,
      favoriteNeighborhoods,
      favoriteCategories,
      favoriteGenres,
      needsAccessibility,
      needsDietary,
      needsFamily,
      hideAdultContent,
      crossPortalRecommendations,
      isPersonalized: personalized,
    };

    // Process trending events (same logic as /api/trending)
    type TrendingEventData = {
      id: number;
      title: string;
      start_date: string;
      start_time: string | null;
      end_date: string | null;
      end_time: string | null;
      is_all_day: boolean;
      is_free: boolean;
      is_adult: boolean | null;
      is_recurring?: boolean | null;
      is_tentpole?: boolean | null;
      category: string | null;
      genres?: string[] | null;
      tags?: string[] | null;
      image_url: string | null;
      series_id?: string | null;
      series?: {
        id: string;
        slug: string;
        title: string;
        series_type: string;
        image_url: string | null;
        frequency: string | null;
        day_of_week: string | null;
        festival?: {
          id: string;
          slug: string;
          name: string;
          image_url: string | null;
          festival_type?: string | null;
          location: string | null;
          neighborhood: string | null;
        } | null;
      } | null;
      venue: {
        id: number;
        name: string;
        slug: string;
        neighborhood: string | null;
        city?: string | null;
        active?: boolean | null;
      } | null;
    };

    let trendingEvents: (TrendingEventData & {
      score: number;
      going_count: number;
    })[] = [];

    await timing.measure("trending", async () => {
      const trendingEventsRaw = suppressEventImagesIfVenueFlagged(
        (trendingEventsResult.data || []) as TrendingEventData[],
      );
      // Filter by city to prevent cross-city leakage, then by adult content preference
      const trendingEventsData = filterByPortalCity(
        filterOutInactiveVenueEvents(trendingEventsRaw),
        portalFilters.city || "Atlanta",
        { allowMissingCity: true },
      );
      const filteredTrendingEventsData = hideAdultContent
        ? trendingEventsData.filter((event) => event.is_adult !== true)
        : trendingEventsData;
      const routableTrendingEventsData = filteredTrendingEventsData.filter(
        (event) => !isSceneEvent(event),
      );

      if (routableTrendingEventsData.length > 0) {
        const trendingEventIds = routableTrendingEventsData.map((e) => e.id);

        // Get recent RSVPs and total going counts in parallel
        const [recentRsvpsResult, goingCountsResult] = await Promise.all([
          supabase
            .from("event_rsvps")
            .select("event_id")
            .in("event_id", trendingEventIds)
            .gte("created_at", hours48Ago),
          supabase
            .from("event_rsvps")
            .select("event_id")
            .in("event_id", trendingEventIds)
            .eq("status", "going"),
        ]);

        // Count recent RSVPs per event
        const recentRsvpCounts: Record<number, number> = {};
        for (const rsvp of (recentRsvpsResult.data || []) as {
          event_id: number;
        }[]) {
          recentRsvpCounts[rsvp.event_id] =
            (recentRsvpCounts[rsvp.event_id] || 0) + 1;
        }

        // Count total going per event
        const totalGoingCounts: Record<number, number> = {};
        for (const rsvp of (goingCountsResult.data || []) as {
          event_id: number;
        }[]) {
          totalGoingCounts[rsvp.event_id] =
            (totalGoingCounts[rsvp.event_id] || 0) + 1;
        }

        // Score events based on recent activity + total interest
        const scored = routableTrendingEventsData.map((event) => ({
          ...suppressEventImageIfVenueFlagged(event),
          score:
            (recentRsvpCounts[event.id] || 0) * 3 +
            (totalGoingCounts[event.id] || 0),
          going_count: totalGoingCounts[event.id] || 0,
        }));

        // Sort by score descending, take top 6
        scored.sort((a, b) => b.score - a.score);
        trendingEvents = scored.slice(0, 6);
      }
    });

    // Build preferences response object (matching /api/preferences format)
    const preferencesResponse = prefs
      ? {
          favorite_categories: favoriteCategories,
          favorite_genres: prefs.favorite_genres || {},
          favorite_neighborhoods: favoriteNeighborhoods,
          favorite_vibes: prefs.favorite_vibes || [],
          needs_accessibility: needsAccessibility,
          needs_dietary: needsDietary,
          needs_family: needsFamily,
          hide_adult_content: hideAdultContent,
          cross_portal_recommendations: crossPortalRecommendations,
          price_preference: prefs.price_preference || null,
        }
      : {
          favorite_categories: [],
          favorite_genres: {},
          favorite_neighborhoods: [],
          favorite_vibes: [],
          needs_accessibility: [],
          needs_dietary: [],
          needs_family: [],
          hide_adult_content: false,
          cross_portal_recommendations: true,
          price_preference: null,
        };

    // Return results with cursor pagination, trending, and preferences
    const payload = {
      events: pageEventsWithCounts,
      sections: parsedCursor ? [] : sectionsWithCounts,
      trending: trendingEvents,
      preferences: preferencesResponse,
      cursor: nextCursor,
      hasMore,
      hasPreferences: !!(
        favoriteCategories.length ||
        favoriteNeighborhoods.length ||
        favoriteGenres.length ||
        prefs?.favorite_vibes?.length ||
        needsAccessibility.length ||
        needsDietary.length ||
        needsFamily.length
      ),
      personalization,
    };
    await setCachedFeedResponse(cacheKey, payload);

    return NextResponse.json(payload, {
      headers: {
        ...responseHeaders,
        "Server-Timing": timing.toHeader(),
      },
    });
    })();

    FEED_RESPONSE_IN_FLIGHT_LOADS.set(cacheKey, feedLoadPromise);
    try {
      return await feedLoadPromise;
    } finally {
      const currentFeedLoad = FEED_RESPONSE_IN_FLIGHT_LOADS.get(cacheKey);
      if (currentFeedLoad === feedLoadPromise) {
        FEED_RESPONSE_IN_FLIGHT_LOADS.delete(cacheKey);
      }
    }
  } catch (err) {
    return errorResponse(err, "GET /api/feed");
  }
}
