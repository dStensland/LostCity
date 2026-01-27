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

  // Build personalized event query
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
      portal_id,
      venue:venues(id, name, neighborhood, slug)
    `)
    .gte("start_date", today)
    .is("canonical_event_id", null) // Only show canonical events, not duplicates
    .order("start_date", { ascending: true })
    .limit(limit * 2); // Fetch more to filter

  // Apply portal filter if specified
  if (portalId) {
    // Show portal-specific events + public events
    // Use filter instead of .or() string interpolation to prevent injection
    query = query.or(`portal_id.eq."${portalId.replace(/"/g, "")}",portal_id.is.null`);

    // Apply portal category filters
    if (portalFilters.categories?.length) {
      query = query.in("category", portalFilters.categories);
    }
  } else {
    // No portal - only show public events
    query = query.is("portal_id", null);
  }

  // Apply user category filter (on top of portal filters)
  if (prefs?.favorite_categories && prefs.favorite_categories.length > 0) {
    // Only apply if no portal filter already set categories
    if (!portalFilters.categories?.length) {
      query = query.in("category", prefs.favorite_categories);
    }
  }

  const { data: eventsData, error } = await query;

  if (error) {
    console.error("Feed API query error:", error);
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: 500 }
    );
  }

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

  let events = (eventsData || []) as EventResult[];

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

    // Boost for followed producers
    if (event.producer_id && followedProducerIds.includes(event.producer_id)) {
      score += 45;
      reasons.push({
        type: "followed_producer",
        label: "From an organizer you follow",
      });
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
