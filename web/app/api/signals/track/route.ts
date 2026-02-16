import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorResponse, checkBodySize } from "@/lib/api-utils";
import { resolvePortalId } from "@/lib/portal-resolution";
import { logger } from "@/lib/logger";

type ActionType = "view" | "save" | "share" | "rsvp_going" | "rsvp_interested" | "went";

type EventWithVenue = {
  id: number;
  category: string | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
};

type InferredPref = {
  id: string;
  score: number;
  interaction_count: number;
};

// Signal weights for different actions
const ACTION_WEIGHTS: Record<ActionType, number> = {
  view: 2,           // Click into detail (2s+)
  save: 8,           // Save event
  share: 15,         // Share event
  rsvp_going: 10,    // RSVP "going"
  rsvp_interested: 5,// RSVP "interested"
  went: 12,          // Mark "went"
};

export async function POST(request: NextRequest) {
  // Check body size
  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { event_id, action } = body as { event_id: number; action: ActionType };

    // Validate input
    if (!event_id || !action) {
      return NextResponse.json(
        { error: "Missing required fields: event_id and action" },
        { status: 400 }
      );
    }

    if (!ACTION_WEIGHTS[action]) {
      return NextResponse.json(
        { error: `Invalid action type. Must be one of: ${Object.keys(ACTION_WEIGHTS).join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get event details to extract signals
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(`
        id,
        category,
        venue:venues(id, name, neighborhood)
      `)
      .eq("id", event_id)
      .maybeSingle() as { data: EventWithVenue | null; error: Error | null };

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Resolve portal context for attribution
    const portalId = await resolvePortalId(request);

    const weight = ACTION_WEIGHTS[action];
    const signals: { type: string; value: string }[] = [];

    // Extract signals from event
    if (event.category) {
      signals.push({ type: "category", value: event.category });
    }

    const venue = event.venue as { id: number; name: string; neighborhood: string | null } | null;
    if (venue?.id) {
      signals.push({ type: "venue", value: `venue:${venue.id}` });
    }

    if (venue?.neighborhood) {
      signals.push({ type: "neighborhood", value: venue.neighborhood });
    }

    // Upsert each signal into inferred_preferences
    const upsertPromises = signals.map(async (signal) => {
      // Use upsert with ON CONFLICT handling
      const { error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ error: Error | null }>)("upsert_inferred_preference", {
        p_user_id: user.id,
        p_signal_type: signal.type,
        p_signal_value: signal.value,
        p_score_increment: weight,
      });

      if (error) {
        // Fallback to manual upsert if RPC doesn't exist
        const errorCode = (error as Error & { code?: string }).code;
        if (errorCode === "42883") {
          // Function doesn't exist, do manual upsert
          const { data: existing, error: selectError } = await supabase
            .from("inferred_preferences")
            .select("id, score, interaction_count")
            .eq("user_id", user.id)
            .eq("signal_type", signal.type)
            .eq("signal_value", signal.value)
            .maybeSingle() as { data: InferredPref | null; error: Error | null };

          if (selectError) {
            logger.error("Failed to fetch preference for signal:", selectError.message);
            return;
          }

          if (existing) {
            const { error: updateError } = await supabase
              .from("inferred_preferences")
              .update({
                score: (existing.score || 0) + weight,
                interaction_count: (existing.interaction_count || 0) + 1,
                last_interaction_at: new Date().toISOString(),
              } as never)
              .eq("id", existing.id);

            if (updateError) {
              logger.error("Failed to update preference for signal:", updateError.message);
            }
          } else {
            const { error: insertError } = await supabase.from("inferred_preferences").insert({
              user_id: user.id,
              signal_type: signal.type,
              signal_value: signal.value,
              score: weight,
              interaction_count: 1,
              ...(portalId ? { portal_id: portalId } : {}),
            } as never);

            if (insertError) {
              logger.error("Failed to insert preference for signal:", insertError.message);
            }
          }
        } else {
          logger.error("Error upserting signal:", error);
        }
      }
    });

    await Promise.all(upsertPromises);

    return NextResponse.json({
      success: true,
      tracked: signals.length,
      action,
      weight,
    });
  } catch (err) {
    return errorResponse(err, "POST /api/signals/track");
  }
}
