import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export type CalendarPlan = {
  id: string;
  title: string;
  description: string | null;
  plan_date: string;
  plan_time: string | null;
  status: string;
  item_count: number;
  creator: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  participants: Array<{
    user_id: string;
    status: string;
    user: { username: string; display_name: string | null; avatar_url: string | null };
  }>;
  is_creator: boolean;
  participant_status: string | null;
};

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
  genres: string[] | null;
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
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

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

    // Use service client to bypass RLS - auth already verified above
    const supabase = createServiceClient();

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
        genres: string[] | null;
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
          category:category_id,
          genres,
          image_url,
          description,
          ticket_url,
          source_url,
          venue:places!left(
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
      logger.error("Error fetching user calendar events:", error);
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

    // Fetch plans where user is creator
    type PlanParticipantRow = {
      user_id: string;
      status: string;
      user: { username: string; display_name: string | null; avatar_url: string | null };
    };
    type PlanRow = {
      id: string;
      title: string;
      description: string | null;
      plan_date: string;
      plan_time: string | null;
      status: string;
      creator_id: string;
      creator: { id: string; username: string; display_name: string | null; avatar_url: string | null };
      item_count: { count: number }[];
      participants: PlanParticipantRow[];
    };

    const { data: creatorPlans, error: creatorError } = await supabase
      .from("plans")
      .select(`
        id, title, description, plan_date, plan_time, status, creator_id,
        creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url),
        item_count:plan_items(count),
        participants:plan_participants(
          user_id, status,
          user:profiles!plan_participants_user_id_fkey(username, display_name, avatar_url)
        )
      `)
      .eq("creator_id", user.id)
      .eq("status", "active")
      .gte("plan_date", startDate)
      .lte("plan_date", endDate)
      .order("plan_date", { ascending: true }) as { data: PlanRow[] | null; error: Error | null };

    if (creatorError) {
      logger.error("Error fetching creator plans:", creatorError);
    }

    // Fetch plans where user is a participant (not declined)
    const { data: participantRows } = await supabase
      .from("plan_participants")
      .select("plan_id")
      .eq("user_id", user.id)
      .neq("status", "declined") as { data: { plan_id: string }[] | null };

    const participantPlanIds = (participantRows || []).map((r) => r.plan_id);

    let participantPlans: PlanRow[] = [];
    if (participantPlanIds.length > 0) {
      const { data: pp } = await supabase
        .from("plans")
        .select(`
          id, title, description, plan_date, plan_time, status, creator_id,
          creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url),
          item_count:plan_items(count),
          participants:plan_participants(
            user_id, status,
            user:profiles!plan_participants_user_id_fkey(username, display_name, avatar_url)
          )
        `)
        .in("id", participantPlanIds)
        .neq("creator_id", user.id)
        .eq("status", "active")
        .gte("plan_date", startDate)
        .lte("plan_date", endDate)
        .order("plan_date", { ascending: true }) as { data: PlanRow[] | null };
      participantPlans = pp || [];
    }

    // Merge and dedupe (creator wins over participant row)
    const seenPlanIds = new Set<string>();
    const rawPlans: PlanRow[] = [];
    for (const p of (creatorPlans || [])) {
      seenPlanIds.add(p.id);
      rawPlans.push(p);
    }
    for (const p of participantPlans) {
      if (!seenPlanIds.has(p.id)) {
        seenPlanIds.add(p.id);
        rawPlans.push(p);
      }
    }

    // Find user's participant status for non-creator plans
    const participantStatusMap = new Map<string, string>();
    for (const row of participantRows || []) {
      const plan = rawPlans.find((p) => p.id === row.plan_id);
      if (plan) {
        const pp = plan.participants.find((pa) => pa.user_id === user.id);
        if (pp) participantStatusMap.set(row.plan_id, pp.status);
      }
    }

    const plans: CalendarPlan[] = rawPlans.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      plan_date: p.plan_date,
      plan_time: p.plan_time,
      status: p.status,
      item_count: Array.isArray(p.item_count) ? (p.item_count[0]?.count ?? 0) : 0,
      creator: p.creator,
      participants: p.participants,
      is_creator: p.creator_id === user.id,
      participant_status: p.creator_id === user.id
        ? null
        : (participantStatusMap.get(p.id) ?? null),
    }));

    plans.sort((a, b) => {
      const dc = a.plan_date.localeCompare(b.plan_date);
      if (dc !== 0) return dc;
      if (!a.plan_time && !b.plan_time) return 0;
      if (!a.plan_time) return -1;
      if (!b.plan_time) return 1;
      return a.plan_time.localeCompare(b.plan_time);
    });

    // Summary stats
    const goingCount = events.filter(e => e.rsvp_status === "going").length;
    const interestedCount = events.filter(e => e.rsvp_status === "interested").length;

    return NextResponse.json({
      events,
      plans,
      summary: {
        total: events.length,
        going: goingCount,
        interested: interestedCount,
        plans: plans.length,
        daysWithEvents: Object.keys(eventsByDate).length,
      },
    });
  } catch (err) {
    return errorResponse(err, "GET /api/user/calendar");
  }
}
