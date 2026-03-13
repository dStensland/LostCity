import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, errorApiResponse } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

/**
 * GET /api/auth/preferences
 *
 * Fetches the current user's preferences (cross_portal_recommendations, hide_adult_content).
 */
export const GET = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { data, error } = await serviceClient
      .from("user_preferences")
      .select("cross_portal_recommendations, hide_adult_content")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      logger.error("Error fetching preferences", error, { userId: user.id, component: "auth/preferences" });
      return errorApiResponse("Failed to fetch preferences", 500);
    }

    return NextResponse.json({ preferences: data });
  } catch (error) {
    logger.error("Preferences GET error", error, { component: "auth/preferences" });
    return errorApiResponse("Internal server error", 500);
  }
});

/**
 * PATCH /api/auth/preferences
 *
 * Upserts the current user's preferences.
 * Accepts: cross_portal_recommendations (boolean), hide_adult_content (boolean)
 */
export const PATCH = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const sizeCheck = checkBodySize(request, 10 * 1024);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { cross_portal_recommendations, hide_adult_content } = body;

    if (cross_portal_recommendations !== undefined && typeof cross_portal_recommendations !== "boolean") {
      return NextResponse.json({ error: "cross_portal_recommendations must be a boolean" }, { status: 400 });
    }
    if (hide_adult_content !== undefined && typeof hide_adult_content !== "boolean") {
      return NextResponse.json({ error: "hide_adult_content must be a boolean" }, { status: 400 });
    }

    const payload: Record<string, unknown> = { user_id: user.id };
    if (cross_portal_recommendations !== undefined) payload.cross_portal_recommendations = cross_portal_recommendations;
    if (hide_adult_content !== undefined) payload.hide_adult_content = hide_adult_content;

    const { error } = await serviceClient
      .from("user_preferences")
      .upsert(payload as never, { onConflict: "user_id" });

    if (error) {
      logger.error("Error saving preferences", error, { userId: user.id, component: "auth/preferences" });
      return errorApiResponse("Failed to save preferences", 500);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Preferences PATCH error", error, { component: "auth/preferences" });
    return errorApiResponse("Internal server error", 500);
  }
});
