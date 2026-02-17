import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";
import { logger } from "@/lib/logger";

// POST /api/personalization/feedback - Record user feedback on events
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { eventId, signal, reason, category, venueId, neighborhood } = body as {
    eventId: number;
    signal: "positive" | "negative";
    reason?: string;
    category?: string | null;
    venueId?: number | null;
    neighborhood?: string | null;
  };

  if (!eventId || !signal) {
    return NextResponse.json(
      { error: "eventId and signal are required" },
      { status: 400 }
    );
  }

  // Use service client for mutations to avoid RLS issues
  const supabase = createServiceClient();

  const attribution = await resolvePortalAttributionForWrite(request, {
    endpoint: "/api/personalization/feedback",
    body,
    requireWhenHinted: true,
  });
  if (attribution.response) return attribution.response;
  const portalId = attribution.portalId;

  // Update inferred preferences based on feedback
  const signalMultiplier = signal === "positive" ? 1 : -0.5;

  // Update category preference if provided
  if (category) {
    await upsertInferredPreference(
      supabase,
      user.id,
      "category",
      category,
      signalMultiplier,
      portalId
    );
  }

  // Update venue preference if provided
  if (venueId) {
    await upsertInferredPreference(
      supabase,
      user.id,
      "venue",
      venueId.toString(),
      signalMultiplier,
      portalId
    );
  }

  // Update neighborhood preference if provided
  if (neighborhood) {
    await upsertInferredPreference(
      supabase,
      user.id,
      "neighborhood",
      neighborhood,
      signalMultiplier,
      portalId
    );
  }

  // Record the feedback event for analytics (ignore type errors - table exists)
  const { error: activityError } = await supabase.from("activities").insert({
    user_id: user.id,
    activity_type: signal === "positive" ? "like" : "dislike",
    event_id: eventId,
    visibility: "private",
    ...(portalId ? { portal_id: portalId } : {}),
    metadata: {
      signal,
      reason,
      category,
      venue_id: venueId,
      neighborhood,
    },
  } as never);

  if (activityError) {
    logger.error("Failed to log activity", activityError);
  }

  return NextResponse.json({ success: true });
}

async function upsertInferredPreference(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  signalType: string,
  signalValue: string,
  scoreChange: number,
  portalId: string | null = null
) {
  type InferredPref = { id: string; score: number; interaction_count: number };

  // Try to update existing preference
  const { data: existing, error: selectError } = await supabase
    .from("inferred_preferences")
    .select("id, score, interaction_count")
    .eq("user_id", userId)
    .eq("signal_type", signalType)
    .eq("signal_value", signalValue)
    .maybeSingle();

  if (selectError) {
    logger.error("Failed to fetch inferred preference", selectError);
    return;
  }

  const existingPref = existing as InferredPref | null;

  if (existingPref) {
    // Update existing preference
    const newScore = Math.max(-5, Math.min(10, existingPref.score + scoreChange));
    const { error: updateError } = await supabase
      .from("inferred_preferences")
      .update({
        score: newScore,
        interaction_count: existingPref.interaction_count + 1,
        last_interaction_at: new Date().toISOString(),
      } as never)
      .eq("id", existingPref.id);

    if (updateError) {
      logger.error("Failed to update inferred preference", updateError);
    }
  } else {
    // Create new preference
    const { error: insertError } = await supabase.from("inferred_preferences").insert({
      user_id: userId,
      signal_type: signalType,
      signal_value: signalValue,
      score: scoreChange > 0 ? 1 : 0,
      interaction_count: 1,
      ...(portalId ? { portal_id: portalId } : {}),
    } as never);

    if (insertError) {
      logger.error("Failed to insert inferred preference", insertError);
    }
  }
}
