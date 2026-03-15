import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import type { CalendarPreferences } from "@/lib/types/calendar";

const VALID_VIEWS = ["agenda", "month", "week"];
const VALID_WEEK_STARTS = ["sunday", "monday"];

export const GET = withAuth(async (request, { user, serviceClient }) => {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { data, error } = await serviceClient
    .from("calendar_preferences")
    .select("default_view, week_start, show_friend_events, show_past_events")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }

  // Return defaults if no row exists
  const preferences: CalendarPreferences = (data as CalendarPreferences) ?? {
    default_view: "agenda",
    week_start: "sunday",
    show_friend_events: true,
    show_past_events: true,
  };

  return NextResponse.json({ preferences });
});

export const PATCH = withAuth(async (request, { user, serviceClient }) => {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.default_view !== undefined) {
    if (!VALID_VIEWS.includes(body.default_view)) {
      return NextResponse.json(
        { error: "Invalid default_view" },
        { status: 400 }
      );
    }
    updates.default_view = body.default_view;
  }

  if (body.week_start !== undefined) {
    if (!VALID_WEEK_STARTS.includes(body.week_start)) {
      return NextResponse.json(
        { error: "Invalid week_start" },
        { status: 400 }
      );
    }
    updates.week_start = body.week_start;
  }

  if (body.show_friend_events !== undefined) {
    updates.show_friend_events = Boolean(body.show_friend_events);
  }

  if (body.show_past_events !== undefined) {
    updates.show_past_events = Boolean(body.show_past_events);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await serviceClient
    .from("calendar_preferences")
    .upsert(
      { user_id: user.id, ...updates } as never,
      { onConflict: "user_id" }
    )
    .select("default_view, week_start, show_friend_events, show_past_events")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }

  return NextResponse.json({ preferences: data });
});
