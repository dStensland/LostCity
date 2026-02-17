import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";
import { errorResponse } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

type HideReason = "not_interested" | "seen_enough" | "wrong_category" | null;

export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { event_id, reason } = body as { event_id: number; reason?: HideReason };

    if (!event_id) {
      return NextResponse.json(
        { error: "Missing required field: event_id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const attribution = await resolvePortalAttributionForWrite(request, {
      endpoint: "/api/events/hide",
      body,
      requireWhenHinted: true,
    });
    if (attribution.response) return attribution.response;
    const portalId = attribution.portalId;

    // Insert or update hidden event
    const { error } = await supabase.from("hidden_events").upsert(
      {
        user_id: user.id,
        event_id,
        reason: reason || null,
        ...(portalId ? { portal_id: portalId } : {}),
      } as never,
      {
        onConflict: "user_id,event_id",
      }
    );

    if (error) {
      logger.error("Error hiding event:", error);
      return NextResponse.json(
        { error: "Failed to hide event" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Event hidden",
      event_id,
    });
  } catch (err) {
    return errorResponse(err, "POST /api/events/hide");
  }
}

export async function DELETE(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("event_id");

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing required parameter: event_id" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("hidden_events")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", parseInt(eventId, 10));

    if (error) {
      logger.error("Error unhiding event:", error);
      return NextResponse.json(
        { error: "Failed to unhide event" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Event unhidden",
      event_id: parseInt(eventId, 10),
    });
  } catch (err) {
    return errorResponse(err, "DELETE /api/events/hide");
  }
}
