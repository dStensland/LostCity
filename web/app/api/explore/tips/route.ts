import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, validationError, isValidString, isValidUUID, sanitizeString, parseIntParam } from "@/lib/api-utils";
import { ensureUserProfile } from "@/lib/user-utils";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/explore/tips
 * Get tips for a venue
 * Query params: venueId (required), trackId (optional), limit (default 50)
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const venueId = parseIntParam(searchParams.get("venueId"));
    const trackId = searchParams.get("trackId");
    const limit = parseIntParam(searchParams.get("limit"), 50);

    if (venueId === null) {
      return validationError("Missing or invalid venueId");
    }

    if (limit === null || limit < 1 || limit > 100) {
      return validationError("Invalid limit. Must be between 1 and 100");
    }

    if (trackId && !isValidUUID(trackId)) {
      return validationError("Invalid trackId. Must be a valid UUID");
    }

    const supabase = await createClient();

    let query = supabase
      .from("explore_tips")
      .select(`
        id,
        content,
        upvote_count,
        is_verified_visitor,
        created_at,
        explore_tracks (
          id,
          slug,
          name
        )
      `)
      .eq("venue_id", venueId)
      .eq("status", "approved")
      .order("upvote_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (trackId) {
      query = query.eq("track_id", trackId);
    }

    const { data: tips, error: tipsError } = await query;

    if (tipsError) {
      console.error("Tips fetch error:", tipsError);
      return NextResponse.json({ error: "Failed to fetch tips" }, { status: 500 });
    }

    return NextResponse.json(
      { tips: tips ?? [] },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180",
        },
      }
    );
  } catch (error) {
    console.error("Tips GET API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/explore/tips
 * Create a tip
 * Body: { venueId: number, trackId?: string, content: string }
 */
export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  // Check body size
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { venueId, trackId, content } = body;

    // Validate venueId
    if (typeof venueId !== "number" || !Number.isInteger(venueId) || venueId <= 0) {
      return validationError("Invalid venueId. Must be a positive integer");
    }

    // Validate trackId if provided
    if (trackId !== undefined && trackId !== null && !isValidUUID(trackId)) {
      return validationError("Invalid trackId. Must be a valid UUID or null");
    }

    // Validate content
    if (!isValidString(content, 10, 500)) {
      return validationError("Invalid content. Must be between 10 and 500 characters");
    }

    // Sanitize content
    const sanitizedContent = sanitizeString(content);

    // Ensure profile exists
    await ensureUserProfile(user, serviceClient);

    // Check rate limit: 1 tip per venue per user per week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTip } = await serviceClient
      .from("explore_tips")
      .select("id")
      .eq("venue_id", venueId)
      .eq("user_id", user.id)
      .gte("created_at", oneWeekAgo)
      .maybeSingle();

    if (recentTip) {
      return NextResponse.json(
        { error: "You can only submit one tip per venue per week" },
        { status: 429 }
      );
    }

    // Check if user is trusted (has 5+ approved tips)
    const { count: approvedTipsCount } = await serviceClient
      .from("explore_tips")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "approved");

    const isTrusted = (approvedTipsCount ?? 0) >= 5;
    const status = isTrusted ? "approved" : "pending";

    // Insert tip
    const { data: tip, error: insertError } = await serviceClient
      .from("explore_tips")
      .insert({
        venue_id: venueId,
        track_id: trackId || null,
        user_id: user.id,
        content: sanitizedContent,
        status,
      } as never)
      .select()
      .single();

    if (insertError) {
      console.error("Tip insert error:", insertError);
      return NextResponse.json({ error: "Failed to create tip" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tip: {
        id: tip.id,
        content: tip.content,
        status: tip.status,
        upvote_count: tip.upvote_count,
        is_verified_visitor: tip.is_verified_visitor,
        created_at: tip.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Tips POST API error:", error);
    return NextResponse.json({ error: "Failed to create tip" }, { status: 500 });
  }
});
