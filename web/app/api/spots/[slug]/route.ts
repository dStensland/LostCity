import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }

  const supabase = await createClient();

  // Fetch spot/venue data
  const { data: spotData, error } = await supabase
    .from("venues")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !spotData) {
    return Response.json({ error: "Spot not found" }, { status: 404 });
  }

  // Cast to avoid TypeScript 'never' type issue
  const spot = spotData as { id: number; [key: string]: unknown };

  // Get today's date for filtering upcoming events
  const today = new Date().toISOString().split("T")[0];

  // Fetch upcoming events at this venue
  const { data: upcomingEvents } = await supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, end_time, is_free, price_min, category
    `)
    .eq("venue_id", spot.id)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(20);

  return Response.json({
    spot: spotData,
    upcomingEvents: upcomingEvents || [],
  });
}
