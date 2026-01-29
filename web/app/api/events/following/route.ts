import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { format, startOfDay } from "date-fns";

type FollowingEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  description: string | null;
  ticket_url: string | null;
  source_url: string | null;
  venue_id: number | null;
  organization_id: string | null;
  venue: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  organization: {
    id: string;
    name: string;
    org_type: string | null;
    logo_url: string | null;
  } | null;
};

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const supabase = await createClient();

    // Get followed venues
    const { data: followedVenues } = await supabase
      .from("follows")
      .select("followed_venue_id")
      .eq("follower_id", user.id)
      .not("followed_venue_id", "is", null) as { data: { followed_venue_id: number | null }[] | null };

    const venueIds = (followedVenues || [])
      .map((f) => f.followed_venue_id)
      .filter((id): id is number => id !== null);

    // Get followed organizations
    const { data: followedOrganizations } = await supabase
      .from("follows")
      .select("followed_organization_id")
      .eq("follower_id", user.id)
      .not("followed_organization_id", "is", null) as { data: { followed_organization_id: string | null }[] | null };

    const organizationIds = (followedOrganizations || [])
      .map((f) => f.followed_organization_id)
      .filter((id): id is string => id !== null);

    // If user doesn't follow anything, return empty
    if (venueIds.length === 0 && organizationIds.length === 0) {
      return NextResponse.json({
        events: [],
        hasMore: false,
        message: "Follow venues or organizations to see their events here",
      });
    }

    // Build date range (today onwards)
    const today = format(startOfDay(new Date()), "yyyy-MM-dd");

    // Build query for events from followed venues or organizations
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
        organization_id,
        venue:venues!left(
          id,
          name,
          slug,
          neighborhood,
          address,
          city,
          state
        ),
        organization:organizations!left(
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

    // Filter by followed venues OR followed organizations
    if (venueIds.length > 0 && organizationIds.length > 0) {
      query = query.or(`venue_id.in.(${venueIds.join(",")}),organization_id.in.(${organizationIds.join(",")})`);
    } else if (venueIds.length > 0) {
      query = query.in("venue_id", venueIds);
    } else if (organizationIds.length > 0) {
      query = query.in("organization_id", organizationIds);
    }

    const { data: events, error } = await query as { data: FollowingEvent[] | null; error: Error | null };

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

      // Check if organization is followed
      if (event.organization_id && organizationIds.includes(event.organization_id)) {
        const organization = event.organization as { name: string } | null;
        reasons.push({
          type: "followed_organization",
          label: "Followed organization",
          detail: organization?.name || "An organization you follow",
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
      followingOrganizations: organizationIds.length,
    });
  } catch (err) {
    console.error("Following events API error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
