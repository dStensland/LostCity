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

  // Fetch producer data
  const { data: producerData, error } = await supabase
    .from("event_producers")
    .select("*")
    .eq("slug", slug)
    .eq("hidden", false)
    .single();

  if (error || !producerData) {
    return Response.json({ error: "Organizer not found" }, { status: 404 });
  }

  // Cast to avoid TypeScript 'never' type issue
  const producer = producerData as { id: string; [key: string]: unknown };

  // Get today's date for filtering upcoming events
  const today = new Date().toISOString().split("T")[0];

  // Fetch upcoming events for this producer
  const { data: eventsData } = await supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, end_time, is_free, price_min, category,
      venue:venues(id, name, slug, neighborhood)
    `)
    .eq("producer_id", producer.id)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(30);

  return Response.json({
    producer: producerData,
    events: eventsData || [],
  });
}
