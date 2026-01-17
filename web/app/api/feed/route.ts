import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Get user preferences
  const { data: prefsData } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single();

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

  // Build personalized event query
  const today = new Date().toISOString().split("T")[0];

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
      vibes,
      venue:venues(id, name, neighborhood, slug)
    `)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(limit * 2); // Fetch more to filter

  // Apply category filter if user has preferences
  if (prefs?.favorite_categories && prefs.favorite_categories.length > 0) {
    query = query.in("category", prefs.favorite_categories);
  }

  const { data: eventsData, error } = await query;

  if (error) {
    return errorResponse(error, "feed:GET");
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
    vibes: string[] | null;
    venue: {
      id: number;
      name: string;
      neighborhood: string | null;
      slug: string | null;
    } | null;
    score?: number;
  };

  let events = (eventsData || []) as EventResult[];

  // Score and sort events by relevance
  events = events.map((event) => {
    let score = 0;

    // Boost for followed venues
    if (event.venue?.id && followedVenueIds.includes(event.venue.id)) {
      score += 50;
    }

    // Boost for matching neighborhoods
    if (prefs?.favorite_neighborhoods && event.venue?.neighborhood) {
      if (prefs.favorite_neighborhoods.includes(event.venue.neighborhood)) {
        score += 30;
      }
    }

    // Boost for matching vibes
    if (prefs?.favorite_vibes && event.vibes) {
      const matchingVibes = event.vibes.filter((v) =>
        prefs.favorite_vibes!.includes(v)
      );
      score += matchingVibes.length * 10;
    }

    // Price preference
    if (prefs?.price_preference === "free" && event.is_free) {
      score += 20;
    } else if (prefs?.price_preference === "budget") {
      if (event.is_free || (event.price_min !== null && event.price_min <= 25)) {
        score += 15;
      }
    }

    // Slight boost for events happening sooner
    const daysAway = Math.floor(
      (new Date(event.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysAway <= 7) {
      score += 10 - daysAway;
    }

    return { ...event, score };
  });

  // Sort by score descending, then by date
  events.sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) {
      return (b.score || 0) - (a.score || 0);
    }
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  });

  // Return top results
  return NextResponse.json({
    events: events.slice(0, limit),
    hasPreferences: !!(
      prefs?.favorite_categories?.length ||
      prefs?.favorite_neighborhoods?.length ||
      prefs?.favorite_vibes?.length
    ),
  });
}
