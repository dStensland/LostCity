import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/plans/:id/suggestions — suggest a change
export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await context.params;
  const body = await request.json();
  const { suggestion_type, content } = body;

  if (!suggestion_type || !content) {
    return NextResponse.json({ error: "suggestion_type and content required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("plan_suggestions")
    .insert({
      plan_id: planId,
      user_id: user.id,
      suggestion_type,
      content,
    } as never)
    .select("id, suggestion_type, content, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to suggest" }, { status: 500 });
  }

  return NextResponse.json({ suggestion: data }, { status: 201 });
}

// PATCH /api/plans/:id/suggestions — accept/decline (creator only)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await context.params;
  const body = await request.json();
  const { suggestion_id, status } = body as { suggestion_id: string; status: string };

  if (!suggestion_id || !["accepted", "declined"].includes(status)) {
    return NextResponse.json({ error: "suggestion_id and valid status required" }, { status: 400 });
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

  const { error } = await serviceClient
    .from("plan_suggestions")
    .update({ status } as never)
    .eq("id", suggestion_id)
    .eq("plan_id", planId);

  if (error) {
    return NextResponse.json({ error: "Failed to update suggestion" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
