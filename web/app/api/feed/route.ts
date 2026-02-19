import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";
import { escapeSQLPattern, errorResponse } from "@/lib/api-utils";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import {
  applyPortalScopeToQuery,
  filterByPortalCity,
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
import { isSuppressedFromGeneralEventFeed } from "@/lib/event-content-classification";

import { fetchSocialProofCounts } from "@/lib/search";
import { format, startOfDay, addDays } from "date-fns";

type RecommendationReason = {
  type:
    | "followed_venue"
    | "followed_organization"
    | "neighborhood"
    | "price"
    | "friends_going"
    | "trending"
    | "category";
  label: string;
  detail?: string;
};

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
    const includeExhibits = ["1", "true"].includes(
      (searchParams.get("include_exhibits") || "").toLowerCase(),
    );

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const responseHeaders = {
      // Private cache for user-specific content
      "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
    };
    const cacheKey = `${user.id}|${searchParams.toString()}|${Math.floor(Date.now() / FEED_RESPONSE_CACHE_TTL_MS)}`;
    const cachedResponse = await getCachedFeedResponse(cacheKey);
    if (cachedResponse) {
      return NextResponse.json(cachedResponse, {
        headers: responseHeaders,
      });
    }

    const existingFeedLoad = FEED_RESPONSE_IN_FLIGHT_LOADS.get(cacheKey);
    if (existingFeedLoad) {
      return existingFeedLoad;
    }

    const feedLoadPromise = (async (): Promise<Response> => {
    const supabase = await createClient();

    // Calculate date range for trending events
    const now = new Date();
    const todayForTrending = format(startOfDay(now), "yyyy-MM-dd");
    const weekFromNow = format(addDays(startOfDay(now), 7), "yyyy-MM-dd");
    const hours48Ago = new Date(
      now.getTime() - 48 * 60 * 60 * 1000,
    ).toISOString();

    // Get portal context, user preferences, and trending events in parallel (independent queries)
    const [portalContext, prefsResult, trendingEventsResult] =
      await Promise.all([
        resolvePortalQueryContext(supabase, searchParams),
        supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        // Fetch trending events (same logic as /api/trending)
        supabase
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
        category,
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
        venue:venues(id, name, slug, neighborhood, location_designator, blurhash, city)
      `,
          )
          .gte("start_date", todayForTrending)
          .lte("start_date", weekFromNow)
          .eq("is_active", true)
          .is("canonical_event_id", null)
          .is("portal_id", null)
          .order("start_date", { ascending: true })
          .limit(200),
      ]);

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
    const portalFilters: {
      categories?: string[];
      neighborhoods?: string[];
      city?: string;
    } = portalContext.filters;

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

    // Get followed venues and organizations in parallel
    const [{ data: followedVenuesData }, { data: followedOrganizationsData }] =
      await Promise.all([
        supabase
          .from("follows")
          .select("followed_venue_id")
          .eq("follower_id", user.id)
          .not("followed_venue_id", "is", null),
        supabase
          .from("follows")
          .select("followed_organization_id")
          .eq("follower_id", user.id)
          .not("followed_organization_id", "is", null),
      ]);

    const followedVenues = followedVenuesData as
      | { followed_venue_id: number | null }[]
      | null;
    const followedVenueIds =
      (followedVenues
        ?.map((f) => f.followed_venue_id)
        .filter(Boolean) as number[]) || [];

    const followedOrganizations = followedOrganizationsData as
      | { followed_organization_id: string | null }[]
      | null;
    const followedOrganizationIds =
      (followedOrganizations
        ?.map((f) => f.followed_organization_id)
        .filter(Boolean) as string[]) || [];

    // Parallelize independent queries: producerSources and friend IDs
    type GetFriendIdsResult = { friend_id: string }[];
    const [producerSourcesResult, friendIdsResult] = await Promise.all([
      // Get sources that map to followed organizations (for querying events via source relationship)
      followedOrganizationIds.length > 0
        ? supabase
            .from("sources")
            .select("id, organization_id")
            .in("organization_id", followedOrganizationIds)
        : Promise.resolve({ data: null }),
      // Get friends using the friendships table
      supabase.rpc(
        "get_friend_ids" as never,
        { user_id: user.id } as never,
      ) as unknown as Promise<{ data: GetFriendIdsResult | null }>,
    ]);

    // Extract producer sources data
    let producerSourceIds: number[] = [];
    const sourceOrganizationMap: Record<number, string> = {};

    if (producerSourcesResult.data) {
      producerSourceIds = producerSourcesResult.data.map(
        (s: { id: number }) => s.id,
      );
      for (const source of producerSourcesResult.data as {
        id: number;
        organization_id: string;
      }[]) {
        sourceOrganizationMap[source.id] = source.organization_id;
      }
    }

    // Extract friend IDs
    const friendIds = (friendIdsResult.data || []).map((row) => row.friend_id);

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
    let query = supabase
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
      category,
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
      venue:venues(id, name, neighborhood, slug, location_designator, blurhash, city)
    `,
      )
      .or(`start_date.gte.${startDateFilter},end_date.gte.${startDateFilter}`) // Include ongoing events (exhibitions with end_date)
      .eq("is_active", true)
      .is("canonical_event_id", null) // Only show canonical events, not duplicates
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null")
      .order("start_date", { ascending: true });

    if (hideAdultContent) {
      query = query.or("is_adult.eq.false,is_adult.is.null");
    }

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
      query = query.in("category", portalFilters.categories);
    }

    // Apply explicit category filter
    if (categories?.length) {
      query = query.in("category", categories);
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
    query = query.limit(personalized ? limit * 3 : limit + 1);

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
    category,
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
    venue:venues(id, name, neighborhood, slug, location_designator, blurhash, city)
  `;

    // Build all queries, tracking which ones we're running
    const queries = [];
    const queryTypes: string[] = [];

    queries.push(query);
    queryTypes.push("main");

    // Followed venues query
    if (followedVenueIds.length > 0) {
      let venueQuery = supabase
        .from("events")
        .select(eventSelect)
        .in("venue_id", followedVenueIds)
        .gte("start_date", today)
        .eq("is_active", true)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .order("start_date", { ascending: true })
        .limit(50);

      if (hideAdultContent) {
        venueQuery = venueQuery.or("is_adult.eq.false,is_adult.is.null");
      }

      venueQuery = applyPortalScopeToQuery(venueQuery, {
        portalId,
        portalExclusive: shouldRestrictToPortal,
        publicOnlyWhenNoPortal: true,
      });

      queries.push(venueQuery);
      queryTypes.push("venue");
    }

    // Followed organizations by organization_id query
    if (followedOrganizationIds.length > 0) {
      let producerQuery = supabase
        .from("events")
        .select(eventSelect)
        .in("organization_id", followedOrganizationIds)
        .gte("start_date", today)
        .eq("is_active", true)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .order("start_date", { ascending: true })
        .limit(50);

      if (hideAdultContent) {
        producerQuery = producerQuery.or("is_adult.eq.false,is_adult.is.null");
      }

      producerQuery = applyPortalScopeToQuery(producerQuery, {
        portalId,
        portalExclusive: shouldRestrictToPortal,
        publicOnlyWhenNoPortal: true,
      });

      queries.push(producerQuery);
      queryTypes.push("org");
    }

    // Followed organizations by source_id query
    if (producerSourceIds.length > 0) {
      let sourceQuery = supabase
        .from("events")
        .select(eventSelect)
        .in("source_id", producerSourceIds)
        .gte("start_date", today)
        .eq("is_active", true)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .order("start_date", { ascending: true })
        .limit(50);

      if (hideAdultContent) {
        sourceQuery = sourceQuery.or("is_adult.eq.false,is_adult.is.null");
      }

      sourceQuery = applyPortalScopeToQuery(sourceQuery, {
        portalId,
        portalExclusive: shouldRestrictToPortal,
        publicOnlyWhenNoPortal: true,
      });

      queries.push(sourceQuery);
      queryTypes.push("source");
    }

    // OPTIMIZATION: Fetch neighborhood events directly with venue join
    // This avoids the sequential query pattern (venues -> venue_ids -> events)
    if (favoriteNeighborhoods.length > 0) {
      // Query events with venues in favorite neighborhoods
      // We filter by joining venue data and checking neighborhood
      let neighborhoodQuery = supabase
        .from("events")
        .select(`${eventSelect}, venue!inner(neighborhood)`)
        .in("venue.neighborhood", favoriteNeighborhoods)
        .gte("start_date", today)
        .eq("is_active", true)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .order("start_date", { ascending: true })
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

      queries.push(neighborhoodQuery);
      queryTypes.push("neighborhood");
    }

    // Category events query
    if (favoriteCategories.length > 0) {
      let categoryQuery = supabase
        .from("events")
        .select(eventSelect)
        .in("category", favoriteCategories)
        .gte("start_date", today)
        .eq("is_active", true)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .order("start_date", { ascending: true })
        .limit(50);

      if (hideAdultContent) {
        categoryQuery = categoryQuery.or("is_adult.eq.false,is_adult.is.null");
      }

      categoryQuery = applyPortalScopeToQuery(categoryQuery, {
        portalId,
        portalExclusive: shouldRestrictToPortal,
        publicOnlyWhenNoPortal: true,
      });

      queries.push(categoryQuery);
      queryTypes.push("category");
    }

    // Execute all queries in parallel
    const results = await Promise.all(queries);

    // Extract main result
    const mainResult = results[0];
    const { data: eventsData, error } = mainResult;

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
        if (
          queryType === "venue" ||
          queryType === "org" ||
          queryType === "source"
        ) {
          followedEventsData = [
            ...followedEventsData,
            ...(data as typeof eventsData),
          ];
        } else if (queryType === "neighborhood") {
          neighborhoodEventsData = data as typeof eventsData;
        } else if (queryType === "category") {
          categoryEventsData = data as typeof eventsData;
        }
      }
    }

    const mainEventIds = new Set(
      (eventsData || []).map((e: { id: number }) => e.id),
    );
    const uniqueFollowedEvents = (followedEventsData || []).filter(
      (e: { id: number }) => !mainEventIds.has(e.id),
    );

    // Add followed events to the set
    for (const e of uniqueFollowedEvents as { id: number }[]) {
      mainEventIds.add(e.id);
    }

    // Add neighborhood events (avoiding duplicates with main + followed)
    const uniqueNeighborhoodEvents = (neighborhoodEventsData || []).filter(
      (e: { id: number }) => !mainEventIds.has(e.id),
    );

    // Add neighborhood events to the set
    for (const e of uniqueNeighborhoodEvents as { id: number }[]) {
      mainEventIds.add(e.id);
    }

    // Add category events (avoiding duplicates with main + followed + neighborhood)
    const uniqueCategoryEvents = (categoryEventsData || []).filter(
      (e: { id: number }) => !mainEventIds.has(e.id),
    );

    const mergedEventsData = [
      ...(eventsData || []),
      ...uniqueFollowedEvents,
      ...uniqueNeighborhoodEvents,
      ...uniqueCategoryEvents,
    ];

    const friendsGoingMap: Record<
      number,
      { user_id: string; username: string; display_name: string | null }[]
    > = {};
    if (friendIds.length > 0 && mergedEventsData.length > 0) {
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
      const rsvpUserIds = [...new Set(friendRsvps.map((rsvp) => rsvp.user_id))];

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
      } | null;
      score?: number;
      reasons?: RecommendationReason[];
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

    // Filter out cross-city events that leak via portal_id=NULL
    events = filterByPortalCity(events, portalFilters.city, {
      allowMissingCity: true,
    });
    events = events.filter(
      (event) => includeExhibits || !isSuppressedFromGeneralEventFeed(event),
    );

    // Score and sort events by relevance
    events = events.map((event) => {
      let score = 0;
      const reasons: RecommendationReason[] = [];
      const tasteMatches: string[] = [];
      const eventGenres = normalizeLowercaseStringList(event.genres);
      const haystack = [event.title, ...(event.tags || []), ...eventGenres]
        .join(" ")
        .toLowerCase();

      // Boost for friends going (highest priority)
      const friendsGoing = friendsGoingMap[event.id] || [];
      if (friendsGoing.length > 0) {
        score += 60 + friendsGoing.length * 10; // 60 base + 10 per friend
        const friendNames = friendsGoing
          .slice(0, 2)
          .map((f) => f.display_name || `@${f.username}`);
        const othersCount = friendsGoing.length - 2;
        let detail = friendNames.join(" and ");
        if (othersCount > 0) {
          detail = `${friendNames[0]} and ${friendsGoing.length - 1} others`;
        }
        reasons.push({
          type: "friends_going",
          label: "Friends going",
          detail,
        });
      }

      // Boost for followed venues
      if (event.venue?.id && followedVenueIds.includes(event.venue.id)) {
        score += 50;
        reasons.push({
          type: "followed_venue",
          label: "You follow this venue",
          detail: event.venue.name,
        });
      }

      // Boost for followed organizations - check both direct organization_id and via source mapping
      const eventOrganizationId =
        event.organization_id ||
        (event.source_id ? sourceOrganizationMap[event.source_id] : null);
      if (
        eventOrganizationId &&
        followedOrganizationIds.includes(eventOrganizationId)
      ) {
        score += 45;
        reasons.push({
          type: "followed_organization",
          label: "From an organizer you follow",
        });
      }

      // Boost for matching favorite categories
      if (prefs?.favorite_categories && event.category) {
        if (prefs.favorite_categories.includes(event.category)) {
          score += 25;
          tasteMatches.push(event.category);
        }
      }

      // Boost for matching favorite genres
      const matchingGenres = eventGenres.filter((genre) =>
        favoriteGenreSet.has(genre),
      );
      if (matchingGenres.length > 0) {
        score += Math.min(24, 8 + matchingGenres.length * 4);
        tasteMatches.push(...matchingGenres.slice(0, 2));
      }

      // Boost for matching neighborhoods
      if (prefs?.favorite_neighborhoods && event.venue?.neighborhood) {
        if (prefs.favorite_neighborhoods.includes(event.venue.neighborhood)) {
          score += 30;
          reasons.push({
            type: "neighborhood",
            label: "In your favorite area",
            detail: event.venue.neighborhood,
          });
        }
      }

      if (
        needsAccessibility.length > 0 &&
        needsAccessibility.some((need) => haystack.includes(need))
      ) {
        score += 8;
      }

      if (
        needsDietary.length > 0 &&
        ((event.category || "").toLowerCase() === "food_drink" ||
          needsDietary.some((need) => haystack.includes(need)))
      ) {
        score += 8;
      }

      if (
        needsFamily.length > 0 &&
        ((event.category || "").toLowerCase() === "family" ||
          needsFamily.some((need) => haystack.includes(need)))
      ) {
        score += 12;
      }

      // Price preference
      if (prefs?.price_preference === "free" && event.is_free) {
        score += 20;
        reasons.push({
          type: "price",
          label: "Free event",
        });
      } else if (prefs?.price_preference === "budget") {
        if (
          event.is_free ||
          (event.price_min !== null && event.price_min <= 25)
        ) {
          score += 15;
          reasons.push({
            type: "price",
            label: "Budget-friendly",
          });
        }
      }

      // Quality boost: events with images are more engaging
      if (event.image_url) {
        score += 5;
      }

      // Slight boost for events happening sooner
      const daysAway = Math.max(
        0,
        Math.floor(
          (new Date(event.start_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      if (daysAway <= 7) {
        score += Math.max(0, 14 - daysAway * 2);
      } else if (daysAway <= 14) {
        score += Math.max(0, 7 - (daysAway - 7));
      }

      if (tasteMatches.length > 0) {
        const detail = tasteMatches[0]
          .split("-")
          .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
          .join(" ");
        reasons.push({
          type: "category",
          label: "Fits your interests",
          detail,
        });
      }

      return {
        ...event,
        score,
        reasons: reasons.length > 0 ? reasons : undefined,
        friends_going: friendsGoing.length > 0 ? friendsGoing : undefined,
      };
    });

    // Apply tag filter (post-query since tags is an array field)
    if (tags?.length) {
      events = events.filter((event) => {
        const eventTags = (event as { tags?: string[] }).tags || [];
        return tags.some((tag) => eventTags.includes(tag));
      });
    }

    // Apply neighborhood filter (post-query since it requires venue join)
    if (neighborhoods?.length) {
      events = events.filter((event) => {
        return (
          event.venue?.neighborhood &&
          neighborhoods.includes(event.venue.neighborhood)
        );
      });
    }

    // Filter only chain-cinema regular showtimes from curated feed.
    // Indie theaters (Plaza/Tara/Landmark/Starlight, etc.) are intentionally kept.
    // Followed venues always bypass suppression.
    events = events.filter((event) => {
      if (!isRegularShowtimeEvent(event.tags)) return true;
      if (event.venue?.id && followedVenueIds.includes(event.venue.id))
        return true;
      return !isChainCinemaVenue(event.venue);
    });

    // When personalized mode is ON, filter to only events from followed entities
    // or matching user preferences (unless user has explicitly applied other filters)
    if (
      personalized &&
      !categories?.length &&
      !searchQuery &&
      !tags?.length &&
      !neighborhoods?.length
    ) {
      events = events.filter((event) => {
        const haystack = [
          event.title,
          ...(event.tags || []),
          ...(event.genres || []),
        ]
          .join(" ")
          .toLowerCase();
        // Keep events from followed venues
        if (event.venue?.id && followedVenueIds.includes(event.venue.id))
          return true;
        // Keep events from followed organizations
        const eventOrgId =
          event.organization_id ||
          (event.source_id ? sourceOrganizationMap[event.source_id] : null);
        if (eventOrgId && followedOrganizationIds.includes(eventOrgId))
          return true;
        // Keep events matching favorite categories
        if (
          prefs?.favorite_categories?.length &&
          event.category &&
          prefs.favorite_categories.includes(event.category)
        )
          return true;
        // Keep events matching favorite genres
        if (
          event.genres?.some(
            (genre) =>
              typeof genre === "string" &&
              favoriteGenreSet.has(genre.toLowerCase()),
          )
        )
          return true;
        // Keep events in favorite neighborhoods
        if (
          prefs?.favorite_neighborhoods?.length &&
          event.venue?.neighborhood &&
          prefs.favorite_neighborhoods.includes(event.venue.neighborhood)
        )
          return true;
        // Keep events matching declared needs
        if (
          needsAccessibility.length &&
          needsAccessibility.some((need) => haystack.includes(need))
        )
          return true;
        if (
          needsDietary.length &&
          ((event.category || "").toLowerCase() === "food_drink" ||
            needsDietary.some((need) => haystack.includes(need)))
        )
          return true;
        if (
          needsFamily.length &&
          ((event.category || "").toLowerCase() === "family" ||
            needsFamily.some((need) => haystack.includes(need)))
        )
          return true;
        // Keep events where friends are going
        if (friendsGoingMap[event.id]?.length) return true;
        return false;
      });
    }

    // Sort by relevance first, then by date/time.
    events.sort((a, b) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;

      const dateCompare = a.start_date.localeCompare(b.start_date);
      if (dateCompare !== 0) return dateCompare;

      const timeA = a.start_time || "23:59:59";
      const timeB = b.start_time || "23:59:59";
      const timeCompare = timeA.localeCompare(timeB);
      if (timeCompare !== 0) return timeCompare;

      return a.id - b.id;
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

    const shouldBuildSections =
      !parsedCursor &&
      personalized &&
      !categories?.length &&
      !searchQuery &&
      !tags?.length &&
      !neighborhoods?.length &&
      !dateFilter &&
      !freeOnly;

    const sections: FeedSection[] = [];

    if (shouldBuildSections) {
      const sectionSeenIds = new Set<number>();
      const takeForSection = (
        candidates: EventResult[],
        maxEvents = 8,
      ): EventResult[] => {
        const selected: EventResult[] = [];
        for (const candidate of candidates) {
          if (sectionSeenIds.has(candidate.id)) continue;
          sectionSeenIds.add(candidate.id);
          selected.push(candidate);
          if (selected.length >= maxEvents) break;
        }
        return selected;
      };

      const isFollowedOrSocial = (event: EventResult) =>
        Boolean(
          event.friends_going?.length ||
          event.reasons?.some(
            (reason) =>
              reason.type === "friends_going" ||
              reason.type === "followed_venue" ||
              reason.type === "followed_organization",
          ),
        );

      const matchesTaste = (event: EventResult) =>
        Boolean(
          (event.category && favoriteCategories.includes(event.category)) ||
          event.genres?.some(
            (genre) =>
              typeof genre === "string" &&
              favoriteGenreSet.has(genre.toLowerCase()),
          ) ||
          (event.venue?.neighborhood &&
            favoriteNeighborhoods.includes(event.venue.neighborhood)),
        );

      const matchesNeeds = (event: EventResult) => {
        if (
          !needsAccessibility.length &&
          !needsDietary.length &&
          !needsFamily.length
        )
          return false;
        const haystack = [
          event.title,
          ...(event.tags || []),
          ...(event.genres || []),
        ]
          .join(" ")
          .toLowerCase();

        if (
          needsAccessibility.length &&
          needsAccessibility.some((need) => haystack.includes(need))
        )
          return true;
        if (
          needsDietary.length &&
          ((event.category || "").toLowerCase() === "food_drink" ||
            needsDietary.some((need) => haystack.includes(need)))
        )
          return true;
        if (
          needsFamily.length &&
          ((event.category || "").toLowerCase() === "family" ||
            needsFamily.some((need) => haystack.includes(need)))
        )
          return true;
        return false;
      };

      const tonightCandidates = events.filter(
        (event) =>
          event.start_date === today &&
          ((event.score || 0) >= 40 ||
            isFollowedOrSocial(event) ||
            matchesTaste(event)),
      );
      const tonightForYou = takeForSection(tonightCandidates, 6);
      if (tonightForYou.length >= 2) {
        sections.push({
          id: "tonight_for_you",
          title: "Tonight for You",
          description: "Strong social and taste matches happening today.",
          events: tonightForYou,
        });
      }

      const thisWeekCandidates = events.filter((event) => {
        if (event.start_date < today || event.start_date > weekFromNow)
          return false;
        return matchesTaste(event) || matchesNeeds(event);
      });
      const thisWeekFitsYourTaste = takeForSection(thisWeekCandidates, 8);
      if (thisWeekFitsYourTaste.length >= 2) {
        sections.push({
          id: "this_week_fits_your_taste",
          title: "This Week Fits Your Taste",
          description:
            "Shortlisted from your categories, genres, neighborhoods, and needs.",
          events: thisWeekFitsYourTaste,
        });
      }

      const followedCandidates = events.filter((event) =>
        isFollowedOrSocial(event),
      );
      const fromPlacesPeopleYouFollow = takeForSection(followedCandidates, 8);
      if (fromPlacesPeopleYouFollow.length >= 2) {
        sections.push({
          id: "from_places_people_you_follow",
          title: "From Places and People You Follow",
          description: "Social proof and followed venues/organizers first.",
          events: fromPlacesPeopleYouFollow,
        });
      }

      const exploreCandidates = events.filter(
        (event) => !isFollowedOrSocial(event) && !matchesTaste(event),
      );
      const exploreSomethingNew = takeForSection(
        exploreCandidates.length > 0 ? exploreCandidates : events,
        8,
      );
      if (exploreSomethingNew.length >= 2) {
        sections.push({
          id: "explore_something_new",
          title: "Explore Something New",
          description: "A stretch set outside your usual pattern.",
          events: exploreSomethingNew,
        });
      }
    }

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
        ? await fetchSocialProofCounts(countEventIds)
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
      category: string | null;
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
      } | null;
    };

    const trendingEventsRaw = suppressEventImagesIfVenueFlagged(
      (trendingEventsResult.data || []) as TrendingEventData[],
    );
    // Filter by city to prevent cross-city leakage, then by adult content preference
    const trendingEventsData = filterByPortalCity(
      trendingEventsRaw,
      portalFilters.city || "Atlanta",
      { allowMissingCity: true },
    );
    const filteredTrendingEventsData = (hideAdultContent
      ? trendingEventsData.filter((event) => event.is_adult !== true)
      : trendingEventsData).filter(
      (event) => includeExhibits || !isSuppressedFromGeneralEventFeed(event),
    );
    let trendingEvents: (TrendingEventData & {
      score: number;
      going_count: number;
    })[] = [];

    if (filteredTrendingEventsData.length > 0) {
      const trendingEventIds = filteredTrendingEventsData.map((e) => e.id);

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
      const scored = filteredTrendingEventsData.map((event) => ({
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
      headers: responseHeaders,
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
