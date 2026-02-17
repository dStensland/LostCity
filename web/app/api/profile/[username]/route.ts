import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ username: string }>;
};

// GET /api/profile/[username]?section=upcoming|venues|taste
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  const { username } = await context.params;
  const section = request.nextUrl.searchParams.get("section");

  const supabase = await createClient();

  // Look up profile
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, is_public")
    .eq("username", username)
    .maybeSingle();

  const profile = profileData as { id: string; is_public: boolean } | null;

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Check privacy — allow if public or own profile
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const isOwner = currentUser?.id === profile.id;

  if (!profile.is_public && !isOwner) {
    return NextResponse.json(
      { error: "This profile is private" },
      { status: 404 }
    );
  }

  switch (section) {
    case "upcoming": {
      const { data: rsvps } = await supabase
        .from("event_rsvps")
        .select(
          `
          event_id,
          events!inner(id, title, start_date, venues(name))
        `
        )
        .eq("user_id", profile.id)
        .eq("status", "going")
        .gt("events.start_date", new Date().toISOString())
        .order("events(start_date)", { ascending: true })
        .limit(20);

      type RsvpRow = {
        event_id: number;
        events: {
          id: number;
          title: string;
          start_date: string;
          venues: { name: string } | null;
        };
      };

      const events = ((rsvps as RsvpRow[] | null) || []).map((r) => ({
        id: r.events.id,
        title: r.events.title,
        start_date: r.events.start_date,
        venue_name: r.events.venues?.name,
      }));

      return NextResponse.json({ events });
    }

    case "venues": {
      const { data: follows } = await supabase
        .from("venue_follows")
        .select(
          `
          venue_id,
          venues!inner(id, name, slug, neighborhood)
        `
        )
        .eq("user_id", profile.id)
        .limit(30);

      type FollowRow = {
        venue_id: number;
        venues: {
          id: number;
          name: string;
          slug: string;
          neighborhood: string | null;
        };
      };

      const venues = ((follows as FollowRow[] | null) || []).map((f) => ({
        id: f.venues.id,
        name: f.venues.name,
        slug: f.venues.slug,
        neighborhood: f.venues.neighborhood,
      }));

      return NextResponse.json({ venues });
    }

    case "taste": {
      // Get inferred category preferences
      const { data: inferred } = await supabase
        .from("inferred_preferences")
        .select("signal_type, signal_value, score")
        .eq("user_id", profile.id)
        .eq("signal_type", "category")
        .order("score", { ascending: false })
        .limit(10);

      type InferredRow = {
        signal_type: string;
        signal_value: string;
        score: number;
      };

      const topCategories = ((inferred as InferredRow[] | null) || []).map(
        (i) => ({
          category: i.signal_value,
          score: i.score,
        })
      );

      // Get neighborhood preferences
      const { data: neighborhoods } = await supabase
        .from("inferred_preferences")
        .select("signal_value, score")
        .eq("user_id", profile.id)
        .eq("signal_type", "neighborhood")
        .order("score", { ascending: false })
        .limit(5);

      type NeighborhoodRow = { signal_value: string; score: number };

      const topNeighborhoods = (
        (neighborhoods as NeighborhoodRow[] | null) || []
      ).map((n) => ({
        neighborhood: n.signal_value,
        score: n.score,
      }));

      // Count events and venues
      const [{ count: totalEvents }, { count: totalVenues }] =
        await Promise.all([
          supabase
            .from("event_rsvps")
            .select("id", { count: "exact", head: true })
            .eq("user_id", profile.id),
          supabase
            .from("venue_follows")
            .select("id", { count: "exact", head: true })
            .eq("user_id", profile.id),
        ]);

      return NextResponse.json({
        topCategories,
        topNeighborhoods,
        totalEvents: totalEvents ?? 0,
        totalVenues: totalVenues ?? 0,
      });
    }

    default:
      return NextResponse.json(
        { error: "Invalid section parameter" },
        { status: 400 }
      );
  }
}
