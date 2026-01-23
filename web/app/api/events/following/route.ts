import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { format, startOfDay, endOfDay, addDays } from "date-fns";

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const cursor = searchParams.get("cursor");

    const supabase = await createClient();

    // Get followed venues
    const { data: followedVenues } = await supabase
      .from("follows")
      .select("followed_venue_id")
      .eq("follower_id", user.id)
      .not("followed_venue_id", "is", null);

    const venueIds = (followedVenues || [])
      .map((f) => f.followed_venue_id)
      .filter((id): id is number => id !== null);

    // Get followed producers
    const { data: followedProducers } = await supabase
      .from("follows")
      .select("followed_producer_id")
      .eq("follower_id", user.id)
      .not("followed_producer_id", "is", null);

    const producerIds = (followedProducers || [])
      .map((f) => f.followed_producer_id)
      .filter((id): id is string => id !== null);

    // If user doesn't follow anything, return empty
    if (venueIds.length === 0 && producerIds.length === 0) {
      return NextResponse.json({
        events: [],
        hasMore: false,
        message: "Follow venues or producers to see their events here",
      });
    }

    // Build date range (today onwards)
    const today = format(startOfDay(new Date()), "yyyy-MM-dd");

    // Build query for events from followed venues or producers
    let query = supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        end_time,
        is_all_day,
        is_free,
        price_min,
        price_max,
        category,
        subcategory,
        image_url,
        description,
        ticket_url,
        source_url,
        venue_id,
        producer_id,
        venue:venues!left(
          id,
          name,
          slug,
          neighborhood,
          address,
          city,
          state
        ),
        producer:producers!left(
          id,
          name,
          org_type,
          logo_url
        )
      `)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: true })
      .range(offset, offset + limit - 1);

    // Filter by followed venues OR followed producers
    if (venueIds.length > 0 && producerIds.length > 0) {
      query = query.or(`venue_id.in.(${venueIds.join(",")}),producer_id.in.(${producerIds.join(",")})`);
    } else if (venueIds.length > 0) {
      query = query.in("venue_id", venueIds);
    } else if (producerIds.length > 0) {
      query = query.in("producer_id", producerIds);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error("Error fetching following events:", error);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    // Add reason badges
    const eventsWithReasons = (events || []).map((event) => {
      const reasons = [];

      // Check if venue is followed
      if (event.venue_id && venueIds.includes(event.venue_id)) {
        const venue = event.venue as { name: string } | null;
        reasons.push({
          type: "followed_venue",
          label: "Followed venue",
          detail: venue?.name || "A venue you follow",
        });
      }

      // Check if producer is followed
      if (event.producer_id && producerIds.includes(event.producer_id)) {
        const producer = event.producer as { name: string } | null;
        reasons.push({
          type: "followed_producer",
          label: "Followed producer",
          detail: producer?.name || "A producer you follow",
        });
      }

      return {
        ...event,
        reasons,
      };
    });

    return NextResponse.json({
      events: eventsWithReasons,
      hasMore: (events?.length || 0) === limit,
      followingVenues: venueIds.length,
      followingProducers: producerIds.length,
    });
  } catch (err) {
    console.error("Following events API error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
