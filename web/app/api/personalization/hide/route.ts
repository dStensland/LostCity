import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { errorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// POST /api/personalization/hide - Hide an event from recommendations
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { eventId, reason } = body as {
    eventId: number;
    reason?: "not_interested" | "seen_enough" | "wrong_category" | "wrong_neighborhood";
  };

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  // Use service client for mutations to avoid RLS issues
  const supabase = createServiceClient();

  // Check if already hidden
  const { data: existing } = await supabase
    .from("hidden_events")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: true, message: "Already hidden" });
  }

  // Hide the event
  const { error } = await supabase.from("hidden_events").insert({
    user_id: user.id,
    event_id: eventId,
    reason: reason || null,
  } as never);

  if (error) {
    return errorResponse(error, "hidden_events");
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/personalization/hide - Unhide an event
export async function DELETE(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  // Use service client for mutations to avoid RLS issues
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("hidden_events")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", parseInt(eventId, 10));

  if (error) {
    return errorResponse(error, "hidden_events");
  }

  return NextResponse.json({ success: true });
}
