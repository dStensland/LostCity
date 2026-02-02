import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";
import { escapeSQLPattern } from "@/lib/api-utils";

type RecommendationReason = {
  type: "followed_venue" | "followed_organization" | "neighborhood" | "price" | "friends_going" | "trending";
  label: string;
  detail?: string;
};

// Helper to parse cursor for pagination
function parseCursor(cursorStr: string | null): { lastScore: number; lastId: number; lastDate: string } | null {
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

export async function GET(request: Request) {
  // Rate limit: expensive endpoint (7+ queries per request)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.expensive);
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 150);
    const portalSlug = searchParams.get("portal");

    // New filter parameters
    const categories = searchParams.get("categories")?.split(",").filter(Boolean);
    const tags = searchParams.get("tags")?.split(",").filter(Boolean);
    const neighborhoods = searchParams.get("neighborhoods")?.split(",").filter(Boolean);
    const dateFilter = searchParams.get("date"); // today, tomorrow, weekend, week
    const searchQuery = searchParams.get("search");
    const freeOnly = searchParams.get("free") === "1";
    const cursor = searchParams.get("cursor");
    const personalized = searchParams.get("personalized") !== "0"; // Default true

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get portal data if specified
  let portalId: string | null = null;
  let portalFilters: { categories?: string[]; neighborhoods?: string[] } = {};

  if (portalSlug) {
    const { data: portal } = await supabase
      .from("portals")
      .select("id, filters")
      .eq("slug", portalSlug)
      .eq("status", "active")
      .maybeSingle();

    const portalData = portal as { id: string; filters: typeof portalFilters } | null;
    if (portalData) {
      portalId = portalData.id;
      portalFilters = portalData.filters || {};
    }
  }

  // Get user preferences
  const { data: prefsData } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  type UserPrefs = {
    favorite_categories: string[] | null;
    favorite_neighborhoods: string[] | null;
    favorite_vibes: string[] | null;
    price_preference: string | null;
  };

  const prefs = prefsData as UserPrefs | null;

  // Get followed venues
  const { data: followedVenuesData } = await supabase
    .from("follows")
    .select("followed_venue_id")
    .eq("follower_id", user.id)
    .not("followed_venue_id", "is", null);

  const followedVenues = followedVenuesData as { followed_venue_id: number | null }[] | null;
  const followedVenueIds = followedVenues?.map((f) => f.followed_venue_id).filter(Boolean) as number[] || [];

  // Get followed organizations
  const { data: followedOrganizationsData } = await supabase
    .from("follows")
    .select("followed_organization_id")
    .eq("follower_id", user.id)
    .not("followed_organization_id", "is", null);

  const followedOrganizations = followedOrganizationsData as { followed_organization_id: string | null }[] | null;
  const followedOrganizationIds = followedOrganizations?.map((f) => f.followed_organization_id).filter(Boolean) as string[] || [];

  // Debug logging
  console.log("[Feed API] User follows:", {
    venueIds: followedVenueIds,
    producerIds: followedOrganizationIds,
  });

  // Get sources that map to followed organizations (for querying events via source relationship)
  // This is more reliable than querying events.organization_id directly, since that field
  // may not be populated for all events
  let producerSourceIds: number[] = [];
  const sourceOrganizationMap: Record<number, string> = {};

  if (followedOrganizationIds.length > 0) {
    const { data: producerSources } = await supabase
      .from("sources")
      .select("id, organization_id")
      .in("organization_id", followedOrganizationIds);

    if (producerSources) {
      producerSourceIds = producerSources.map((s: { id: number }) => s.id);
      for (const source of producerSources as { id: number; organization_id: string }[]) {
        sourceOrganizationMap[source.id] = source.organization_id;
      }
    }

    console.log("[Feed API] Organization sources found:", {
      producerSourceIds,
      sourceOrganizationMap,
    });
  }

  // Get friends using the friendships table
  type GetFriendIdsResult = { friend_id: string }[];
  const { data: friendIdsData } = await supabase.rpc(
    "get_friend_ids" as never,
    { user_id: user.id } as never
  ) as { data: GetFriendIdsResult | null };

  const friendIds = (friendIdsData || []).map((row) => row.friend_id);

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
        saturday.setDate(saturday.getDate() + (dayOfWeek === 6 ? 0 : daysUntilSaturday));
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

  const friendsGoingMap: Record<number, { user_id: string; username: string; display_name: string | null }[]> = {};

  if (friendIds.length > 0) {
    const { data: friendRsvps } = await supabase
      .from("event_rsvps")
      .select(`
        event_id,
        user_id
      `)
      .in("user_id", friendIds)
      .in("status", ["going", "interested"]);

    // Fetch profile data separately to avoid FK hint issues
    const rsvpUserIds = [...new Set((friendRsvps || []).map((r: { user_id: string }) => r.user_id))];
    const profilesMap: Record<string, { username: string; display_name: string | null }> = {};

    if (rsvpUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", rsvpUserIds);

      for (const p of (profilesData || []) as { id: string; username: string; display_name: string | null }[]) {
        profilesMap[p.id] = { username: p.username, display_name: p.display_name };
      }
    }

    for (const rsvp of (friendRsvps || []) as { event_id: number; user_id: string }[]) {
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

  // Build personalized event query - fetch broadly, score later
  // When personalized=true, we pre-filter to followed entities
  // When personalized=false, we show all events (with additional filters)
  let query = supabase
    .from("events")
    .select(`
      id,
      title,
      start_date,
      start_time,
      is_all_day,
      is_free,
      price_min,
      price_max,
      category,
      subcategory,
      tags,
      image_url,
      ticket_url,
      organization_id,
      source_id,
      portal_id,
      venue:venues(id, name, neighborhood, slug)
    `)
    .gte("start_date", startDateFilter)
    .is("canonical_event_id", null) // Only show canonical events, not duplicates
    .order("start_date", { ascending: true });

  // Apply end date filter if specified
  if (endDateFilter) {
    query = query.lte("start_date", endDateFilter);
  }

  // Apply portal filter if specified
  if (portalId) {
    // Show portal-specific events + public events
    // Note: portal_id is UUID, no quotes needed in PostgREST filter syntax
    query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);

    // Apply portal category filters if specified (only if no explicit category filter)
    if (portalFilters.categories?.length && !categories?.length) {
      query = query.in("category", portalFilters.categories);
    }
  } else {
    // No portal - only show public events
    query = query.is("portal_id", null);
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

  console.log("[Feed API] Filters:", {
    portalId,
    portalFilters,
    categories,
    tags,
    neighborhoods,
    dateFilter,
    searchQuery,
    freeOnly,
    personalized,
    startDateFilter,
    endDateFilter,
  });

  const { data: eventsData, error } = await query;

  // Separately fetch events from followed venues/organizations to ensure they're included
  // (the main query might miss them due to the limit)
  let followedEventsData: typeof eventsData = [];

  if (followedVenueIds.length > 0 || followedOrganizationIds.length > 0 || producerSourceIds.length > 0) {
    const eventSelect = `
      id,
      title,
      start_date,
      start_time,
      is_all_day,
      is_free,
      price_min,
      price_max,
      category,
      subcategory,
      tags,
      image_url,
      ticket_url,
      organization_id,
      source_id,
      portal_id,
      venue:venues(id, name, neighborhood, slug)
    `;

    // Fetch events from followed organizations - query by both organization_id and source_id
    // This catches events even if organization_id isn't directly set on the event
    if (followedOrganizationIds.length > 0 || producerSourceIds.length > 0) {
      // First try direct organization_id match
      if (followedOrganizationIds.length > 0) {
        const { data: producerEvents } = await supabase
          .from("events")
          .select(eventSelect)
          .in("organization_id", followedOrganizationIds)
          .gte("start_date", today)
          .is("canonical_event_id", null)
          .order("start_date", { ascending: true })
          .limit(50);

        if (producerEvents) {
          followedEventsData = [...followedEventsData, ...producerEvents];
        }
      }

      // Also fetch by source_id (events may not have organization_id set but source does)
      if (producerSourceIds.length > 0) {
        const { data: sourceEvents } = await supabase
          .from("events")
          .select(eventSelect)
          .in("source_id", producerSourceIds)
          .gte("start_date", today)
          .is("canonical_event_id", null)
          .order("start_date", { ascending: true })
          .limit(50);

        if (sourceEvents) {
          followedEventsData = [...followedEventsData, ...sourceEvents];
        }
      }
    }

    // Fetch events from followed venues
    if (followedVenueIds.length > 0) {
      const { data: venueEvents } = await supabase
        .from("events")
        .select(eventSelect)
        .in("venue_id", followedVenueIds)
        .gte("start_date", today)
        .is("canonical_event_id", null)
        .order("start_date", { ascending: true })
        .limit(50);

      if (venueEvents) {
        followedEventsData = [...followedEventsData, ...venueEvents];
      }
    }

    console.log("[Feed API] Followed events fetched:", {
      totalCount: followedEventsData.length,
      producerSourceIds: producerSourceIds,
    });
  }

  // Fetch events from favorite neighborhoods (separate from followed venues/organizations)
  let neighborhoodEventsData: typeof eventsData = [];
  const favoriteNeighborhoods = prefs?.favorite_neighborhoods || [];

  if (favoriteNeighborhoods.length > 0) {
    // First get venue IDs in favorite neighborhoods
    const { data: neighborhoodVenues } = await supabase
      .from("venues")
      .select("id")
      .in("neighborhood", favoriteNeighborhoods);

    const neighborhoodVenueIds = (neighborhoodVenues || []).map((v: { id: number }) => v.id);

    if (neighborhoodVenueIds.length > 0) {
      const eventSelect = `
        id,
        title,
        start_date,
        start_time,
        is_all_day,
        is_free,
        price_min,
        price_max,
        category,
        subcategory,
        tags,
        image_url,
        ticket_url,
        organization_id,
        source_id,
        portal_id,
        venue:venues(id, name, neighborhood, slug)
      `;

      const { data: neighborhoodEvents } = await supabase
        .from("events")
        .select(eventSelect)
        .in("venue_id", neighborhoodVenueIds)
        .gte("start_date", today)
        .is("canonical_event_id", null)
        .order("start_date", { ascending: true })
        .limit(50);

      if (neighborhoodEvents) {
        neighborhoodEventsData = neighborhoodEvents;
      }

      console.log("[Feed API] Neighborhood events fetched:", {
        favoriteNeighborhoods,
        venueCount: neighborhoodVenueIds.length,
        eventCount: neighborhoodEventsData.length,
      });
    }
  }

  // Fetch events matching user's favorite categories (interests)
  let categoryEventsData: typeof eventsData = [];
  const favoriteCategories = prefs?.favorite_categories || [];

  if (favoriteCategories.length > 0) {
    const eventSelect = `
      id,
      title,
      start_date,
      start_time,
      is_all_day,
      is_free,
      price_min,
      price_max,
      category,
      subcategory,
      tags,
      image_url,
      ticket_url,
      organization_id,
      source_id,
      portal_id,
      venue:venues(id, name, neighborhood, slug)
    `;

    const { data: categoryEvents } = await supabase
      .from("events")
      .select(eventSelect)
      .in("category", favoriteCategories)
      .gte("start_date", today)
      .is("canonical_event_id", null)
      .order("start_date", { ascending: true })
      .limit(50);

    if (categoryEvents) {
      categoryEventsData = categoryEvents;
    }

    console.log("[Feed API] Category events fetched:", {
      favoriteCategories,
      eventCount: categoryEventsData.length,
    });
  }

  if (error) {
    console.error("Feed API query error:", error);
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: 500 }
    );
  }

  // Merge followed events, neighborhood events, and category events with main results
  const mainEventIds = new Set((eventsData || []).map((e: { id: number }) => e.id));
  const uniqueFollowedEvents = (followedEventsData || []).filter(
    (e: { id: number }) => !mainEventIds.has(e.id)
  );

  // Add followed events to the set
  for (const e of uniqueFollowedEvents as { id: number }[]) {
    mainEventIds.add(e.id);
  }

  // Add neighborhood events (avoiding duplicates with main + followed)
  const uniqueNeighborhoodEvents = (neighborhoodEventsData || []).filter(
    (e: { id: number }) => !mainEventIds.has(e.id)
  );

  // Add neighborhood events to the set
  for (const e of uniqueNeighborhoodEvents as { id: number }[]) {
    mainEventIds.add(e.id);
  }

  // Add category events (avoiding duplicates with main + followed + neighborhood)
  const uniqueCategoryEvents = (categoryEventsData || []).filter(
    (e: { id: number }) => !mainEventIds.has(e.id)
  );

  const mergedEventsData = [...(eventsData || []), ...uniqueFollowedEvents, ...uniqueNeighborhoodEvents, ...uniqueCategoryEvents];

  type EventResult = {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    is_all_day: boolean;
    is_free: boolean;
    price_min: number | null;
    price_max: number | null;
    category: string | null;
    subcategory: string | null;
    tags: string[] | null;
    image_url: string | null;
    ticket_url: string | null;
    organization_id: string | null;
    source_id: number | null;
    venue: {
      id: number;
      name: string;
      neighborhood: string | null;
      slug: string | null;
    } | null;
    score?: number;
    reasons?: RecommendationReason[];
    friends_going?: { user_id: string; username: string; display_name: string | null }[];
  };

  let events = (mergedEventsData || []) as EventResult[];

  // Debug: log events with matching venue/producer
  const eventsWithMatchingVenue = events.filter(e => e.venue?.id && followedVenueIds.includes(e.venue.id));
  // Check both direct organization_id and via source mapping
  const eventsWithMatchingOrganization = events.filter(e => {
    const producerId = e.organization_id || (e.source_id ? sourceOrganizationMap[e.source_id] : null);
    return producerId && followedOrganizationIds.includes(producerId);
  });
  console.log("[Feed API] Events from query:", {
    total: events.length,
    eventsFromFollowedVenues: eventsWithMatchingVenue.map(e => ({ id: e.id, title: e.title, venueId: e.venue?.id })),
    eventsFromFollowedOrganizations: eventsWithMatchingOrganization.map(e => ({
      id: e.id,
      title: e.title,
      producerId: e.organization_id,
      sourceId: e.source_id,
      sourceOrganizationId: e.source_id ? sourceOrganizationMap[e.source_id] : null,
    })),
  });

  // Score and sort events by relevance
  events = events.map((event) => {
    let score = 0;
    const reasons: RecommendationReason[] = [];

    // Boost for friends going (highest priority)
    const friendsGoing = friendsGoingMap[event.id] || [];
    if (friendsGoing.length > 0) {
      score += 60 + (friendsGoing.length * 10); // 60 base + 10 per friend
      const friendNames = friendsGoing.slice(0, 2).map((f) => f.display_name || `@${f.username}`);
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
    const eventOrganizationId = event.organization_id || (event.source_id ? sourceOrganizationMap[event.source_id] : null);
    if (eventOrganizationId && followedOrganizationIds.includes(eventOrganizationId)) {
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
        // Don't add a reason for categories - it's implicit from the section title
      }
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

    // Price preference
    if (prefs?.price_preference === "free" && event.is_free) {
      score += 20;
      reasons.push({
        type: "price",
        label: "Free event",
      });
    } else if (prefs?.price_preference === "budget") {
      if (event.is_free || (event.price_min !== null && event.price_min <= 25)) {
        score += 15;
        reasons.push({
          type: "price",
          label: "Budget-friendly",
        });
      }
    }

    // Slight boost for events happening sooner
    const daysAway = Math.floor(
      (new Date(event.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysAway <= 7) {
      score += 10 - daysAway;
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
      return event.venue?.neighborhood && neighborhoods.includes(event.venue.neighborhood);
    });
  }

  // When personalized mode is ON, filter to only events from followed entities
  // or matching user preferences (unless user has explicitly applied other filters)
  if (personalized && !categories?.length && !searchQuery && !tags?.length && !neighborhoods?.length) {
    events = events.filter((event) => {
      // Keep events from followed venues
      if (event.venue?.id && followedVenueIds.includes(event.venue.id)) return true;
      // Keep events from followed organizations
      const eventOrgId = event.organization_id || (event.source_id ? sourceOrganizationMap[event.source_id] : null);
      if (eventOrgId && followedOrganizationIds.includes(eventOrgId)) return true;
      // Keep events matching favorite categories
      if (prefs?.favorite_categories?.length && event.category && prefs.favorite_categories.includes(event.category)) return true;
      // Keep events in favorite neighborhoods
      if (prefs?.favorite_neighborhoods?.length && event.venue?.neighborhood && prefs.favorite_neighborhoods.includes(event.venue.neighborhood)) return true;
      // Keep events where friends are going
      if (friendsGoingMap[event.id]?.length) return true;
      return false;
    });
  }

  // Debug: count events by reason
  const venueMatches = events.filter(e => e.reasons?.some(r => r.type === "followed_venue")).length;
  const producerMatches = events.filter(e => e.reasons?.some(r => r.type === "followed_organization")).length;
  console.log("[Feed API] Matched events:", {
    total: events.length,
    fromFollowedVenues: venueMatches,
    fromFollowedOrganizations: producerMatches,
    personalized,
  });

  // Sort by score descending, then by date
  events.sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) {
      return (b.score || 0) - (a.score || 0);
    }
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  });

  // Handle cursor-based pagination
  const parsedCursor = parseCursor(cursor);
  let filteredEvents = events;

  if (parsedCursor) {
    // Find events after the cursor position
    const cursorIndex = events.findIndex(
      (e) => e.score === parsedCursor.lastScore && e.id === parsedCursor.lastId
    );
    if (cursorIndex !== -1) {
      filteredEvents = events.slice(cursorIndex + 1);
    }
  }

  // Get page of results
  const pageEvents = filteredEvents.slice(0, limit);
  const hasMore = filteredEvents.length > limit;

  // Create cursor for next page
  let nextCursor: string | null = null;
  if (hasMore && pageEvents.length > 0) {
    const lastEvent = pageEvents[pageEvents.length - 1];
    nextCursor = createCursor(lastEvent.score || 0, lastEvent.id, lastEvent.start_date);
  }

  // Build personalization metadata
  const personalization = {
    followedVenueIds,
    followedOrgIds: followedOrganizationIds,
    favoriteNeighborhoods: prefs?.favorite_neighborhoods || [],
    favoriteCategories: prefs?.favorite_categories || [],
    isPersonalized: personalized,
  };

  // Return results with cursor pagination
  return NextResponse.json(
    {
      events: pageEvents,
      cursor: nextCursor,
      hasMore,
      hasPreferences: !!(
        prefs?.favorite_categories?.length ||
        prefs?.favorite_neighborhoods?.length ||
        prefs?.favorite_vibes?.length
      ),
      personalization,
      // Debug info - check browser network tab to see this
      _debug: {
        followedVenueIds,
        followedOrganizationIds,
        totalEventsFromQuery: events.length,
        matchedVenueEvents: eventsWithMatchingVenue.length,
        matchedOrganizationEvents: eventsWithMatchingOrganization.length,
        portalId,
        portalFilters,
        filters: { categories, tags, neighborhoods, dateFilter, searchQuery, freeOnly, personalized },
      },
    },
    {
      headers: {
        // Private cache for user-specific content
        "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
      },
    }
  );
  } catch (err) {
    console.error("Feed API error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
