import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const portalId = searchParams.get("portal_id");
  const isExclusive = searchParams.get("exclusive") === "true";

  const today = new Date().toISOString().split("T")[0];

  try {
    // Use a single efficient query with aggregation
    // This query gets venues with their event counts in one go
    let query = supabase
      .from("events")
      .select(`
        venue_id,
        venues!inner (
          id,
          name,
          slug,
          address,
          neighborhood,
          spot_type
        )
      `)
      .gte("start_date", today)
      .not("venue_id", "is", null);

    // Apply portal filter
    if (isExclusive && portalId) {
      query = query.eq("portal_id", portalId);
    } else if (portalId === "default" || !portalId) {
      query = query.is("portal_id", null);
    } else {
      query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error("Spots query error:", error);
      return NextResponse.json({ spots: [], error: error.message }, { status: 500 });
    }

    if (!events || events.length === 0) {
      return NextResponse.json({ spots: [] });
    }

    // Aggregate venue counts in memory (faster than multiple DB calls)
    const venueMap = new Map<number, {
      id: number;
      name: string;
      slug: string;
      address: string | null;
      neighborhood: string | null;
      spot_type: string | null;
      event_count: number;
    }>();

    for (const event of events) {
      const venue = event.venues as {
        id: number;
        name: string;
        slug: string;
        address: string | null;
        neighborhood: string | null;
        spot_type: string | null;
      };

      if (!venue?.id) continue;

      const existing = venueMap.get(venue.id);
      if (existing) {
        existing.event_count++;
      } else {
        venueMap.set(venue.id, {
          ...venue,
          event_count: 1,
        });
      }
    }

    // Convert to array and sort by event count
    const spots = Array.from(venueMap.values())
      .sort((a, b) => b.event_count - a.event_count);

    return NextResponse.json(
      { spots },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Spots API error:", error);
    return NextResponse.json({ spots: [], error: "Failed to fetch spots" }, { status: 500 });
  }
}
