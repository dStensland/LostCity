import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/plans/:id — plan detail with items + participants
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = await createClient();

  const { data: plan, error } = await supabase
    .from("plans")
    .select(`
      id, title, description, plan_date, plan_time, status, created_at, updated_at,
      creator:profiles!plans_creator_id_fkey(id, username, display_name, avatar_url),
      items:plan_items(
        id, title, sort_order, event_id, venue_id, note, start_time, created_at,
        event:events(id, title, start_date, start_time),
        venue:venues(id, name, slug)
      ),
      participants:plan_participants(
        id, status, responded_at, created_at,
        user:profiles!plan_participants_user_id_fkey(id, username, display_name, avatar_url)
      ),
      suggestions:plan_suggestions(
        id, suggestion_type, content, status, created_at,
        user:profiles!plan_suggestions_user_id_fkey(id, username, display_name, avatar_url)
      )
    `)
    .eq("id", id)
    .single();

  if (error || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  return NextResponse.json({ plan });
}

// PATCH /api/plans/:id — update plan (creator only)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const { title, description, plan_date, plan_time, status } = body;

  const serviceClient = createServiceClient();

  // Verify creator
  const { data: plan } = await serviceClient
    .from("plans")
    .select("creator_id")
    .eq("id", id)
    .single();

  if (!plan || (plan as { creator_id: string }).creator_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (plan_date !== undefined) updates.plan_date = plan_date;
  if (plan_time !== undefined) updates.plan_time = plan_time;
  if (status !== undefined) updates.status = status;

  const { error } = await serviceClient
    .from("plans")
    .update(updates as never)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/plans/:id — delete plan (creator only)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const serviceClient = createServiceClient();

  // Verify creator
  const { data: plan } = await serviceClient
    .from("plans")
    .select("creator_id")
    .eq("id", id)
    .single();

  if (!plan || (plan as { creator_id: string }).creator_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await serviceClient.from("plans").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
