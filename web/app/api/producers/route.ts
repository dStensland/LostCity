import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Producer = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  website: string | null;
  instagram: string | null;
  logo_url: string | null;
  description: string | null;
  categories: string[] | null;
  neighborhood: string | null;
  featured: boolean;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  try {
    // Get current date for event counting
    const today = new Date().toISOString().split("T")[0];

    // Fetch producers
    const { data: producers, error } = await supabase
      .from("event_producers")
      .select("id, name, slug, org_type, website, instagram, logo_url, description, categories, neighborhood, featured")
      .eq("hidden", false)
      .order("featured", { ascending: false })
      .order("name");

    if (error) {
      console.error("Error fetching producers:", error);
      return NextResponse.json({ error: "Failed to fetch producers" }, { status: 500 });
    }

    // Get event counts for each producer
    const { data: events } = await supabase
      .from("events")
      .select("producer_id")
      .gte("start_date", today)
      .not("producer_id", "is", null);

    const eventCounts: Record<string, number> = {};
    for (const event of (events || []) as { producer_id: string }[]) {
      eventCounts[event.producer_id] = (eventCounts[event.producer_id] || 0) + 1;
    }

    // Add event counts to producers
    const producersWithCounts = ((producers || []) as Producer[]).map((p) => ({
      ...p,
      event_count: eventCounts[p.id] || 0,
    }));

    return NextResponse.json({ producers: producersWithCounts });
  } catch (err) {
    console.error("Error in producers API:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
