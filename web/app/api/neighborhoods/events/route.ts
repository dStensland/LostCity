import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLocalDateString } from "@/lib/formats";

// Cached per (neighborhood, limit) tuple for 120s. The drill-down fetches
// this on every map-polygon click; without caching, each click hits Supabase.
// Event data for the current day shifts within the 2-min window at worst.
// Per Hard Rule 9 (web/CLAUDE.md § Portal Surface Architecture).
export const revalidate = 120;

type VenueRow = { id: number; name: string; slug: string; neighborhood: string | null };
type EventRow = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  category_id: string | null;
  is_free: boolean | null;
  venue_id: number | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const neighborhood = searchParams.get("neighborhood");
  const limitParam = searchParams.get("limit");
  const limit = Math.max(1, Math.min(parseInt(limitParam || "5", 10) || 5, 20));

  if (!neighborhood) {
    return NextResponse.json({ error: "neighborhood is required" }, { status: 400 });
  }

  const today = getLocalDateString();

  // Two-step: get venue IDs for this neighborhood, then events at those venues
  const { data: rawVenues } = await supabase
    .from("places")
    .select("id, name, slug, neighborhood")
    .eq("neighborhood", neighborhood)
    .eq("is_active", true);

  const venues = (rawVenues ?? []) as VenueRow[];
  if (venues.length === 0) {
    return NextResponse.json(
      { events: [] },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
    );
  }

  const venueIds = venues.map((v) => v.id);
  const venueMap = new Map(venues.map((v) => [v.id, v]));

  const { data: rawEvents, error } = await supabase
    .from("events")
    .select("id, title, start_date, start_time, end_time, is_all_day, category_id, is_free, place_id")
    .eq("is_active", true)
    .is("canonical_event_id", null)
    .in("place_id", venueIds)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }

  const events = (rawEvents ?? []) as EventRow[];

  // Attach venue info
  const enriched = events.map((ev) => ({
    ...ev,
    venue: (ev.venue_id ? venueMap.get(ev.venue_id) : null) ?? null,
  }));

  return NextResponse.json(
    { events: enriched },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
