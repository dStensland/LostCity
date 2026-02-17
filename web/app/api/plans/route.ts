import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// GET /api/plans — list my plans + plans I'm invited to
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Get plans I created
  const { data: myPlans } = await supabase
    .from("plans")
    .select(`
      id, title, description, plan_date, plan_time, status, created_at, updated_at,
      creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url),
      items:plan_items(id, title, sort_order, event_id, venue_id, start_time),
      participants:plan_participants(
        id, status, responded_at,
        user:profiles!plan_participants_user_id_fkey(id, username, display_name, avatar_url)
      )
    `)
    .eq("creator_id", user.id)
    .in("status", ["active"])
    .order("plan_date", { ascending: true })
    .limit(20);

  // Get plans I'm invited to
  const { data: participantRows } = await supabase
    .from("plan_participants")
    .select("plan_id")
    .eq("user_id", user.id);

  const invitedPlanIds = (participantRows || []).map((r) => (r as { plan_id: string }).plan_id);

  let invitedPlans: typeof myPlans = [];
  if (invitedPlanIds.length > 0) {
    const { data } = await supabase
      .from("plans")
      .select(`
        id, title, description, plan_date, plan_time, status, created_at, updated_at,
        creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url),
        items:plan_items(id, title, sort_order, event_id, venue_id, start_time),
        participants:plan_participants(
          id, status, responded_at,
          user:profiles!plan_participants_user_id_fkey(id, username, display_name, avatar_url)
        )
      `)
      .in("id", invitedPlanIds)
      .neq("creator_id", user.id)
      .in("status", ["active"])
      .order("plan_date", { ascending: true })
      .limit(20);

    invitedPlans = data;
  }

  // Merge and deduplicate
  const allPlans = [...(myPlans || []), ...(invitedPlans || [])];
  const seen = new Set<string>();
  const uniquePlans = allPlans.filter((p) => {
    const id = (p as { id: string }).id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // Sort by date
  uniquePlans.sort((a, b) => {
    const da = (a as { plan_date: string }).plan_date;
    const db = (b as { plan_date: string }).plan_date;
    return da.localeCompare(db);
  });

  return NextResponse.json({ plans: uniquePlans });
}

// POST /api/plans — create a new plan
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, plan_date, plan_time, portal_id } = body;

  if (!title || !plan_date) {
    return NextResponse.json({ error: "title and plan_date required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("plans")
    .insert({
      creator_id: user.id,
      title,
      description: description || null,
      plan_date,
      plan_time: plan_time || null,
      portal_id: portal_id || null,
    } as never)
    .select("id, title, plan_date, plan_time, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }

  return NextResponse.json({ plan: data }, { status: 201 });
}
