import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { format, startOfDay } from "date-fns";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type TonightEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  category: string | null;
  image_url: string | null;
  venue: {
    name: string;
    neighborhood: string | null;
  } | null;
};

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    // Use date-fns format to get local date (not UTC from toISOString)
    const today = format(startOfDay(new Date()), "yyyy-MM-dd");
    const now = new Date();
    const currentHour = now.getHours();

    // Calculate time filter - show events that haven't ended yet (started within last 2 hours or upcoming)
    const twoHoursAgo = format(new Date(now.getTime() - 2 * 60 * 60 * 1000), "HH:mm:ss");

    const supabase = await createClient();
    const { data: events, error } = await supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        is_all_day,
        is_free,
        category,
        image_url,
        venue:venues(name, neighborhood)
      `)
      .eq("start_date", today)
      .is("canonical_event_id", null) // Only show canonical events
      .is("portal_id", null) // Only show public events
      // Time filter: show events starting in future or started within last 2 hours, or all-day events
      .or(`start_time.gte.${twoHoursAgo},is_all_day.eq.true`)
      .order("start_time", { ascending: true })
      .limit(30); // Fetch more to allow for category diversity filtering

    if (error || !events) {
      console.error("Failed to fetch tonight events:", error);
      return NextResponse.json({ events: [] }, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120"
        }
      });
    }

    // Cast to expected type
    const typedEvents = events as unknown as TonightEvent[];

    // Diversify by category: pick at most 2 events per category
    const categoryCount: Record<string, number> = {};
    const diverse: TonightEvent[] = [];
    const overflow: TonightEvent[] = [];

    for (const event of typedEvents) {
      const cat = event.category || "other";
      const count = categoryCount[cat] || 0;
      if (count < 2) {
        diverse.push(event);
        categoryCount[cat] = count + 1;
      } else {
        overflow.push(event);
      }
      if (diverse.length >= 6) break;
    }

    // If we need more, fill from overflow
    while (diverse.length < 6 && overflow.length > 0) {
      diverse.push(overflow.shift()!);
    }

    return NextResponse.json({ events: diverse }, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    console.error("Error in tonight API:", error);
    return NextResponse.json({ events: [] }, { status: 500 });
  }
}
