import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";

export type UserCalendarEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
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
  rsvp_status: "going" | "interested" | "went";
  rsvp_created_at: string;
  venue: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
};

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse date range - default to current month + 2 months ahead
    const now = new Date();
    const defaultStart = format(startOfMonth(now), "yyyy-MM-dd");
    const defaultEnd = format(endOfMonth(addMonths(now, 2)), "yyyy-MM-dd");

    const startDate = searchParams.get("start") || defaultStart;
    const endDate = searchParams.get("end") || defaultEnd;

    // Parse status filter - default to going and interested (active RSVPs)
    const statusParam = searchParams.get("status");
    const statuses = statusParam
      ? statusParam.split(",").filter(s => ["going", "interested", "went"].includes(s))
      : ["going", "interested"];

    const supabase = await createClient();

    // Type for RSVP query result
    type RsvpRow = {
      status: string;
      created_at: string;
      event: {
        id: number;
        title: string;
        start_date: string;
        start_time: string | null;
        end_date: string | null;
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
        venue: {
          id: number;
          name: string;
          slug: string | null;
          neighborhood: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
        } | null;
      };
    };

    // Query RSVPs with joined event and venue data
    const { data: rsvps, error } = await supabase
      .from("event_rsvps")
      .select(`
        status,
        created_at,
        event:events!inner(
          id,
          title,
          start_date,
          start_time,
          end_date,
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
          venue:venues!left(
            id,
            name,
            slug,
            neighborhood,
            address,
            city,
            state
          )
        )
      `)
      .eq("user_id", user.id)
      .in("status", statuses)
      .gte("event.start_date", startDate)
      .lte("event.start_date", endDate)
      .order("event(start_date)", { ascending: true }) as { data: RsvpRow[] | null; error: Error | null };

    if (error) {
      console.error("Error fetching user calendar events:", error);
      return NextResponse.json(
        { error: "Failed to fetch calendar events" },
        { status: 500 }
      );
    }

    // Transform to flat event structure with RSVP info
    const events: UserCalendarEvent[] = (rsvps || []).map((rsvp) => ({
      ...rsvp.event,
      rsvp_status: rsvp.status as "going" | "interested" | "went",
      rsvp_created_at: rsvp.created_at,
    }));

    // Sort by date and time
    events.sort((a, b) => {
      const dateCompare = a.start_date.localeCompare(b.start_date);
      if (dateCompare !== 0) return dateCompare;
      if (!a.start_time && !b.start_time) return 0;
      if (!a.start_time) return -1;
      if (!b.start_time) return 1;
      return a.start_time.localeCompare(b.start_time);
    });

    // Group by date for calendar display
    const eventsByDate: Record<string, UserCalendarEvent[]> = {};
    events.forEach((event) => {
      if (!eventsByDate[event.start_date]) {
        eventsByDate[event.start_date] = [];
      }
      eventsByDate[event.start_date].push(event);
    });

    // Summary stats
    const goingCount = events.filter(e => e.rsvp_status === "going").length;
    const interestedCount = events.filter(e => e.rsvp_status === "interested").length;

    return NextResponse.json({
      events,
      eventsByDate,
      summary: {
        total: events.length,
        going: goingCount,
        interested: interestedCount,
        daysWithEvents: Object.keys(eventsByDate).length,
      },
    });
  } catch (err) {
    console.error("User calendar API error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
