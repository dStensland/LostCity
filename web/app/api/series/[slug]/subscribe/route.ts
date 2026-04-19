import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

const SUPPORTED_SERIES_TYPES = ["recurring_show", "class_series"] as const;

/**
 * GET /api/series/[id]/subscribe
 * Check if the current user is subscribed to this series.
 * Returns { subscribed: false } for unauthenticated users.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug: seriesId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ subscribed: false });
  }

  try {
    const serviceClient = createServiceClient();
    const { data } = await serviceClient
      .from("user_series_subscriptions" as never)
      .select("user_id")
      .eq("user_id", user.id)
      .eq("series_id", seriesId)
      .maybeSingle();

    return NextResponse.json({ subscribed: !!data });
  } catch (error) {
    logger.error("Series subscription GET error", error, {
      userId: user.id,
      seriesId,
      component: "series/[id]/subscribe",
    });
    return NextResponse.json({ error: "Failed to check subscription" }, { status: 500 });
  }
}

/**
 * POST /api/series/[id]/subscribe
 * Subscribe the current user to this series and materialize RSVPs for
 * all future active events in the series.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug: seriesId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const serviceClient = createServiceClient();

    // Fetch the series — must exist and must support subscriptions
    const { data: series, error: seriesError } = await serviceClient
      .from("series")
      .select("id, title, series_type, portal_id")
      .eq("id", seriesId)
      .maybeSingle();

    if (seriesError) {
      logger.error("Series fetch error in subscribe POST", seriesError, {
        seriesId,
        component: "series/[id]/subscribe",
      });
      return NextResponse.json({ error: "Failed to fetch series" }, { status: 500 });
    }

    if (!series) {
      return NextResponse.json({ error: "Series not found" }, { status: 404 });
    }

    if (
      !SUPPORTED_SERIES_TYPES.includes(
        (series as { series_type: string }).series_type as (typeof SUPPORTED_SERIES_TYPES)[number]
      )
    ) {
      return NextResponse.json(
        { error: "This series type does not support subscriptions" },
        { status: 400 }
      );
    }

    const s = series as { id: string; title: string; series_type: string; portal_id: string };

    // Insert the subscription
    const { error: insertError } = await serviceClient
      .from("user_series_subscriptions" as never)
      .insert({
        user_id: user.id,
        series_id: seriesId,
        portal_id: s.portal_id,
      } as never);

    if (insertError) {
      // Postgres unique violation — already subscribed
      if ((insertError as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "Already subscribed" }, { status: 409 });
      }
      logger.error("Series subscription insert error", insertError, {
        userId: user.id,
        seriesId,
        component: "series/[id]/subscribe",
      });
      return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
    }

    // Materialize plans for all future active events in the series.
    // event_rsvps is now a read-only VIEW — writes go to plans + plan_invitees.
    const today = new Date().toISOString().split("T")[0];
    const { data: futureEvents } = await serviceClient
      .from("events")
      .select("id, start_date, portal_id")
      .eq("series_id", seriesId)
      .gte("start_date", today)
      .eq("is_active", true);

    if (futureEvents && futureEvents.length > 0) {
      for (const evt of futureEvents as { id: number; start_date: string | null; portal_id: string }[]) {
        // Idempotent: skip if the user already has an active plan for this event
        const { data: existing } = await serviceClient
          .from("plans")
          .select("id")
          .eq("creator_id", user.id)
          .eq("anchor_event_id", evt.id)
          .in("status", ["planning", "active"])
          .maybeSingle();

        if (existing) continue;

        // Insert plan row
        const { data: planRow } = await serviceClient
          .from("plans")
          .insert({
            creator_id: user.id,
            portal_id: evt.portal_id ?? s.portal_id,
            anchor_event_id: evt.id,
            starts_at: evt.start_date ?? new Date().toISOString(),
            visibility: "friends",
            updated_by: user.id,
          } as never)
          .select("id")
          .single();

        // Insert creator invitee row
        if (planRow) {
          await serviceClient.from("plan_invitees").insert({
            plan_id: (planRow as { id: string }).id,
            user_id: user.id,
            rsvp_status: "going",
            invited_by: user.id,
            responded_at: new Date().toISOString(),
          } as never);
        }
      }
    }

    // Create activity entry for the subscription
    await serviceClient.from("activities").insert({
      user_id: user.id,
      activity_type: "series_subscription",
      entity_type: "series",
      entity_id: seriesId,
      visibility: "public",
      portal_id: s.portal_id,
      metadata: { series_title: s.title },
    } as never);

    return NextResponse.json({
      subscribed: true,
      materialized_count: futureEvents?.length ?? 0,
    });
  } catch (error) {
    logger.error("Series subscription POST error", error, {
      userId: user.id,
      seriesId,
      component: "series/[id]/subscribe",
    });
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}

/**
 * DELETE /api/series/[id]/subscribe
 * Unsubscribe the current user and remove future subscription-sourced RSVPs.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug: seriesId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const serviceClient = createServiceClient();

    // Fetch future event IDs for this series so we can cancel their plans.
    // event_rsvps is now a read-only VIEW — cancel plans instead of deleting rows.
    const today = new Date().toISOString().split("T")[0];
    const { data: futureEvents } = await serviceClient
      .from("events")
      .select("id")
      .eq("series_id", seriesId)
      .gte("start_date", today)
      .eq("is_active", true);

    const futureEventIds = (futureEvents ?? []).map((e: { id: number }) => e.id);
    let removedRsvps = 0;

    if (futureEventIds.length > 0) {
      // Count active plans that will be cancelled for the response
      const { count } = await serviceClient
        .from("plans")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", user.id)
        .in("status", ["planning", "active"])
        .in("anchor_event_id", futureEventIds);

      removedRsvps = count ?? 0;

      // Soft-cancel subscription-sourced plans (don't delete — preserves audit trail)
      await serviceClient
        .from("plans")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() } as never)
        .eq("creator_id", user.id)
        .in("status", ["planning", "active"])
        .in("anchor_event_id", futureEventIds);
    }

    // Delete the subscription record
    const { error: deleteError } = await serviceClient
      .from("user_series_subscriptions" as never)
      .delete()
      .eq("user_id", user.id)
      .eq("series_id", seriesId);

    if (deleteError) {
      logger.error("Series unsubscribe delete error", deleteError, {
        userId: user.id,
        seriesId,
        component: "series/[id]/subscribe",
      });
      return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
    }

    return NextResponse.json({
      unsubscribed: true,
      removed_rsvps: removedRsvps,
    });
  } catch (error) {
    logger.error("Series unsubscribe DELETE error", error, {
      userId: user.id,
      seriesId,
      component: "series/[id]/subscribe",
    });
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
