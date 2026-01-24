import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

// POST /api/personalization/feedback - Record user feedback on events
export async function POST(request: Request) {
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

  const supabase = await createClient();

  // Update inferred preferences based on feedback
  const signalMultiplier = signal === "positive" ? 1 : -0.5;

  // Update category preference if provided
  if (category) {
    await upsertInferredPreference(
      supabase,
      user.id,
      "category",
      category,
      signalMultiplier
    );
  }

  // Update venue preference if provided
  if (venueId) {
    await upsertInferredPreference(
      supabase,
      user.id,
      "venue",
      venueId.toString(),
      signalMultiplier
    );
  }

  // Update neighborhood preference if provided
  if (neighborhood) {
    await upsertInferredPreference(
      supabase,
      user.id,
      "neighborhood",
      neighborhood,
      signalMultiplier
    );
  }

  // Record the feedback event for analytics (ignore type errors - table exists)
  await supabase.from("activities").insert({
    user_id: user.id,
    activity_type: signal === "positive" ? "like" : "dislike",
    event_id: eventId,
    visibility: "private",
    metadata: {
      signal,
      reason,
      category,
      venue_id: venueId,
      neighborhood,
    },
  } as never);

  return NextResponse.json({ success: true });
}

async function upsertInferredPreference(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  signalType: string,
  signalValue: string,
  scoreChange: number
) {
  type InferredPref = { id: string; score: number; interaction_count: number };

  // Try to update existing preference
  const { data: existing } = await supabase
    .from("inferred_preferences")
    .select("id, score, interaction_count")
    .eq("user_id", userId)
    .eq("signal_type", signalType)
    .eq("signal_value", signalValue)
    .single();

  const existingPref = existing as InferredPref | null;

  if (existingPref) {
    // Update existing preference
    const newScore = Math.max(-5, Math.min(10, existingPref.score + scoreChange));
    await supabase
      .from("inferred_preferences")
      .update({
        score: newScore,
        interaction_count: existingPref.interaction_count + 1,
        last_interaction_at: new Date().toISOString(),
      } as never)
      .eq("id", existingPref.id);
  } else {
    // Create new preference
    await supabase.from("inferred_preferences").insert({
      user_id: userId,
      signal_type: signalType,
      signal_value: signalValue,
      score: scoreChange > 0 ? 1 : 0,
      interaction_count: 1,
    } as never);
  }
}
