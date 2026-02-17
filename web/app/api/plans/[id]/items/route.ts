import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/plans/:id/items — add item to plan
export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await context.params;
  const body = await request.json();
  const { title, event_id, venue_id, note, start_time, sort_order } = body;

  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
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

  const { data, error } = await serviceClient
    .from("plan_items")
    .insert({
      plan_id: planId,
      title,
      event_id: event_id || null,
      venue_id: venue_id || null,
      note: note || null,
      start_time: start_time || null,
      sort_order: sort_order ?? 0,
    } as never)
    .select("id, title, sort_order, event_id, venue_id, note, start_time")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }

  // Update plan timestamp
  await serviceClient
    .from("plans")
    .update({ updated_at: new Date().toISOString() } as never)
    .eq("id", planId);

  return NextResponse.json({ item: data }, { status: 201 });
}

// DELETE /api/plans/:id/items — remove item
export async function DELETE(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await context.params;
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("item_id");

  if (!itemId) {
    return NextResponse.json({ error: "item_id required" }, { status: 400 });
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

  await serviceClient
    .from("plan_items")
    .delete()
    .eq("id", itemId)
    .eq("plan_id", planId);

  return NextResponse.json({ success: true });
}
