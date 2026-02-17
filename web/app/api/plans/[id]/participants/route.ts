import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/plans/:id/participants — invite friends
export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await context.params;
  const body = await request.json();
  const { user_ids } = body as { user_ids: string[] };

  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return NextResponse.json({ error: "user_ids required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Verify creator
  const { data: plan } = await serviceClient
    .from("plans")
    .select("creator_id")
    .eq("id", planId)
    .single();

  if (!plan || (plan as { creator_id: string }).creator_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const rows = user_ids.map((uid) => ({
    plan_id: planId,
    user_id: uid,
    status: "invited",
  }));

  const { error } = await serviceClient
    .from("plan_participants")
    .upsert(rows as never, { onConflict: "plan_id,user_id" });

  if (error) {
    return NextResponse.json({ error: "Failed to invite" }, { status: 500 });
  }

  return NextResponse.json({ success: true, invited: user_ids.length });
}

// PATCH /api/plans/:id/participants — respond to invite
export async function PATCH(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await context.params;
  const body = await request.json();
  const { status } = body as { status: string };

  if (!["accepted", "declined", "maybe"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { error } = await serviceClient
    .from("plan_participants")
    .update({
      status,
      responded_at: new Date().toISOString(),
    } as never)
    .eq("plan_id", planId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to respond" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
