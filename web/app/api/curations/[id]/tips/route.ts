import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, validationError, isValidString, isValidUUID, sanitizeString, parseIntParam } from "@/lib/api-utils";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { TIP_MIN_LENGTH, TIP_MAX_LENGTH, TRUSTED_TIP_THRESHOLD } from "@/lib/curation-utils";

/**
 * GET /api/curations/[id]/tips
 * Get approved tips for a curation, optionally filtered by item_id
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: listId } = await params;

  if (!isValidUUID(listId)) {
    return validationError("Invalid curation ID");
  }

  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("item_id");
    const limit = parseIntParam(searchParams.get("limit"), 50);

    if (limit === null || limit < 1 || limit > 100) {
      return validationError("Invalid limit. Must be between 1 and 100");
    }

    if (itemId && !isValidUUID(itemId)) {
      return validationError("Invalid item_id");
    }

    const supabase = await createClient();

    let query = supabase
      .from("curation_tips")
      .select(`
        id,
        list_item_id,
        content,
        upvote_count,
        is_verified_visitor,
        status,
        created_at
      `)
      .eq("list_id", listId)
      .eq("status", "approved")
      .order("upvote_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (itemId) {
      query = query.eq("list_item_id", itemId);
    }

    const { data: tips, error } = await query;

    if (error) {
      console.error("Curation tips fetch error:", error);
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
    console.error("Curation tips GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/curations/[id]/tips
 * Create a tip on a curation or specific item
 */
export const POST = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sizeCheck = checkBodySize(request);
    if (sizeCheck) return sizeCheck;

    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;

    const listId = params.id;

    if (!isValidUUID(listId)) {
      return validationError("Invalid curation ID");
    }

    try {
      const body = await request.json();
      const { item_id, content } = body;

      // Validate item_id if provided
      if (item_id !== undefined && item_id !== null && !isValidUUID(item_id)) {
        return validationError("Invalid item_id");
      }

      // Validate content
      if (!isValidString(content, TIP_MIN_LENGTH, TIP_MAX_LENGTH)) {
        return validationError(`Tip must be between ${TIP_MIN_LENGTH} and ${TIP_MAX_LENGTH} characters`);
      }

      const sanitizedContent = sanitizeString(content);

      // Verify the curation exists and is public
      const { data: list } = await serviceClient
        .from("lists")
        .select("id, is_public, status")
        .eq("id", listId)
        .eq("status", "active")
        .eq("is_public", true)
        .maybeSingle();

      if (!list) {
        return NextResponse.json({ error: "Curation not found" }, { status: 404 });
      }

      // Rate limit: 1 tip per curation per user per week
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentTip } = await serviceClient
        .from("curation_tips")
        .select("id")
        .eq("list_id", listId)
        .eq("user_id", user.id)
        .gte("created_at", oneWeekAgo)
        .maybeSingle();

      if (recentTip) {
        return NextResponse.json(
          { error: "You can only submit one tip per curation per week" },
          { status: 429 }
        );
      }

      // Check if user is trusted (has 5+ approved tips across curations)
      const { count: approvedCount } = await serviceClient
        .from("curation_tips")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "approved");

      const isTrusted = (approvedCount ?? 0) >= TRUSTED_TIP_THRESHOLD;
      const status = isTrusted ? "approved" : "pending";

      const { data: tip, error: insertError } = await serviceClient
        .from("curation_tips")
        .insert({
          list_id: listId,
          list_item_id: item_id || null,
          user_id: user.id,
          content: sanitizedContent,
          status,
        } as never)
        .select()
        .single();

      if (insertError) {
        console.error("Curation tip insert error:", insertError);
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
      console.error("Curation tips POST error:", error);
      return NextResponse.json({ error: "Failed to create tip" }, { status: 500 });
    }
  }
);
