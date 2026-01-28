import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

type RecommendationReason = {
  type: "followed_venue" | "followed_producer" | "neighborhood" | "price" | "friends_going" | "trending";
  label: string;
  detail?: string;
};

export async function GET(request: Request) {
  // Rate limit: expensive endpoint (7+ queries per request)
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.expensive);
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);
    const portalSlug = searchParams.get("portal");

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

  // Get followed producers
  const { data: followedProducersData } = await supabase
    .from("follows")
    .select("followed_producer_id")
    .eq("follower_id", user.id)
    .not("followed_producer_id", "is", null);

  const followedProducers = followedProducersData as { followed_producer_id: string | null }[] | null;
  const followedProducerIds = followedProducers?.map((f) => f.followed_producer_id).filter(Boolean) as string[] || [];

  // Debug logging
  console.log("[Feed API] User follows:", {
    venueIds: followedVenueIds,
    producerIds: followedProducerIds,
  });

  // Get sources that map to followed producers (for querying events via source relationship)
  // This is more reliable than querying events.producer_id directly, since that field
  // may not be populated for all events
  let producerSourceIds: number[] = [];
  const sourceProducerMap: Record<number, string> = {};

  if (followedProducerIds.length > 0) {
    const { data: producerSources } = await supabase
      .from("sources")
      .select("id, producer_id")
      .in("producer_id", followedProducerIds);

    if (producerSources) {
      producerSourceIds = producerSources.map((s: { id: number }) => s.id);
      for (const source of producerSources as { id: number; producer_id: string }[]) {
        sourceProducerMap[source.id] = source.producer_id;
      }
    }

    console.log("[Feed API] Producer sources found:", {
      producerSourceIds,
      sourceProducerMap,
    });
  }

  // Get friends (mutual follows)
  const { data: following } = await supabase
    .from("follows")
    .select("followed_user_id")
    .eq("follower_id", user.id)
    .not("followed_user_id", "is", null);

  const { data: followers } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("followed_user_id", user.id);

  const followingIds = new Set((following || []).map((f: { followed_user_id: string }) => f.followed_user_id));
  const followerIds = new Set((followers || []).map((f: { follower_id: string }) => f.follower_id));
  const friendIds = [...followingIds].filter((id) => followerIds.has(id));

  // Get events friends are going to
  const today = new Date().toISOString().split("T")[0];
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
  // Don't filter by category here so we can show events from followed venues/orgs
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
      image_url,
      ticket_url,
      producer_id,
      source_id,
      portal_id,
      venue:venues(id, name, neighborhood, slug)
    `)
    .gte("start_date", today)
    .is("canonical_event_id", null) // Only show canonical events, not duplicates
    .order("start_date", { ascending: true })
    .limit(limit * 3); // Fetch more to allow filtering/scoring

  // Apply portal filter if specified
  if (portalId) {
    // Show portal-specific events + public events
    // Note: portal_id is UUID, no quotes needed in PostgREST filter syntax
    query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);

    // Apply portal category filters if specified
    if (portalFilters.categories?.length) {
      query = query.in("category", portalFilters.categories);
    }
  } else {
    // No portal - only show public events
    query = query.is("portal_id", null);
  }

  console.log("[Feed API] Portal filter:", { portalId, portalFilters });

  // NOTE: We intentionally don't filter by user's favorite_categories here
  // because we want to show ALL events from followed venues/orgs regardless of category.
  // The category preferences are used for scoring, not filtering.

  const { data: eventsData, error } = await query;

  // Separately fetch events from followed venues/producers to ensure they're included
  // (the main query might miss them due to the limit)
  let followedEventsData: typeof eventsData = [];

  if (followedVenueIds.length > 0 || followedProducerIds.length > 0 || producerSourceIds.length > 0) {
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
      image_url,
      ticket_url,
      producer_id,
      source_id,
      portal_id,
      venue:venues(id, name, neighborhood, slug)
    `;

    // Fetch events from followed producers - query by both producer_id and source_id
    // This catches events even if producer_id isn't directly set on the event
    if (followedProducerIds.length > 0 || producerSourceIds.length > 0) {
      // First try direct producer_id match
      if (followedProducerIds.length > 0) {
        const { data: producerEvents } = await supabase
          .from("events")
          .select(eventSelect)
          .in("producer_id", followedProducerIds)
          .gte("start_date", today)
          .is("canonical_event_id", null)
          .order("start_date", { ascending: true })
          .limit(20);

        if (producerEvents) {
          followedEventsData = [...followedEventsData, ...producerEvents];
        }
      }

      // Also fetch by source_id (events may not have producer_id set but source does)
      if (producerSourceIds.length > 0) {
        const { data: sourceEvents } = await supabase
          .from("events")
          .select(eventSelect)
          .in("source_id", producerSourceIds)
          .gte("start_date", today)
          .is("canonical_event_id", null)
          .order("start_date", { ascending: true })
          .limit(20);

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
        .limit(20);

      if (venueEvents) {
        followedEventsData = [...followedEventsData, ...venueEvents];
      }
    }

    console.log("[Feed API] Followed events fetched:", {
      totalCount: followedEventsData.length,
      producerSourceIds: producerSourceIds,
    });
  }

  // Fetch events from favorite neighborhoods (separate from followed venues/producers)
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
        image_url,
        ticket_url,
        producer_id,
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
        .limit(30);

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
      image_url,
      ticket_url,
      producer_id,
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
      .limit(30);

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
    image_url: string | null;
    ticket_url: string | null;
    producer_id: string | null;
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
  // Check both direct producer_id and via source mapping
  const eventsWithMatchingProducer = events.filter(e => {
    const producerId = e.producer_id || (e.source_id ? sourceProducerMap[e.source_id] : null);
    return producerId && followedProducerIds.includes(producerId);
  });
  console.log("[Feed API] Events from query:", {
    total: events.length,
    eventsFromFollowedVenues: eventsWithMatchingVenue.map(e => ({ id: e.id, title: e.title, venueId: e.venue?.id })),
    eventsFromFollowedProducers: eventsWithMatchingProducer.map(e => ({
      id: e.id,
      title: e.title,
      producerId: e.producer_id,
      sourceId: e.source_id,
      sourceProducerId: e.source_id ? sourceProducerMap[e.source_id] : null,
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

    // Boost for followed producers - check both direct producer_id and via source mapping
    const eventProducerId = event.producer_id || (event.source_id ? sourceProducerMap[event.source_id] : null);
    if (eventProducerId && followedProducerIds.includes(eventProducerId)) {
      score += 45;
      reasons.push({
        type: "followed_producer",
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

  // Debug: count events by reason
  const venueMatches = events.filter(e => e.reasons?.some(r => r.type === "followed_venue")).length;
  const producerMatches = events.filter(e => e.reasons?.some(r => r.type === "followed_producer")).length;
  console.log("[Feed API] Matched events:", {
    total: events.length,
    fromFollowedVenues: venueMatches,
    fromFollowedProducers: producerMatches,
  });

  // Sort by score descending, then by date
  events.sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) {
      return (b.score || 0) - (a.score || 0);
    }
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  });

  // Return top results with private caching (user-specific)
  return NextResponse.json(
    {
      events: events.slice(0, limit),
      hasPreferences: !!(
        prefs?.favorite_categories?.length ||
        prefs?.favorite_neighborhoods?.length ||
        prefs?.favorite_vibes?.length
      ),
      // Debug info - check browser network tab to see this
      _debug: {
        followedVenueIds,
        followedProducerIds,
        totalEventsFromQuery: events.length,
        matchedVenueEvents: eventsWithMatchingVenue.length,
        matchedProducerEvents: eventsWithMatchingProducer.length,
        portalId,
        portalFilters,
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
