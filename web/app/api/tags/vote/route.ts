import { NextRequest, NextResponse } from "next/server";
import { validationError, checkBodySize } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ensureUserProfile } from "@/lib/user-utils";
import { withAuth } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

const VALID_ENTITY_TYPES = ["venue", "event", "series", "festival"] as const;
const VALID_VOTES = ["confirm", "deny"] as const;
type EntityType = (typeof VALID_ENTITY_TYPES)[number];
type VoteType = (typeof VALID_VOTES)[number];

function isValidEntityType(value: string): value is EntityType {
  return (VALID_ENTITY_TYPES as readonly string[]).includes(value);
}

function isValidVote(value: string): value is VoteType {
  return (VALID_VOTES as readonly string[]).includes(value);
}

/**
 * POST /api/tags/vote
 * Cast a vote (confirm/deny) on a tag for an entity
 */
export const POST = withAuth(async (request, { user, serviceClient }) => {
  // Check body size (10KB limit)
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  // Apply rate limiting (20 votes per hour as per PRD 004 Section 7.3)
  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { entity_type, entity_id, tag_slug, vote } = body;

    // Validate entity_type
    if (typeof entity_type !== "string" || !isValidEntityType(entity_type)) {
      return validationError("Invalid entity_type. Must be: venue, event, series, or festival");
    }

    // Validate entity_id
    if (typeof entity_id !== "number" || !Number.isInteger(entity_id) || entity_id <= 0) {
      return validationError("Invalid entity_id");
    }

    // Validate tag_slug
    if (!tag_slug || typeof tag_slug !== "string") {
      return validationError("tag_slug is required");
    }

    // Validate vote
    if (typeof vote !== "string" || !isValidVote(vote)) {
      return validationError("Invalid vote. Must be: confirm or deny");
    }

    // Ensure user has a profile
    await ensureUserProfile(user, serviceClient);

    // Look up tag definition by slug
    const { data: tagDef, error: tagError } = await serviceClient
      .from("tag_definitions")
      .select("id, entity_types")
      .eq("slug", tag_slug)
      .eq("is_active", true)
      .maybeSingle();

    if (tagError) {
      logger.error("Tag lookup error", tagError, { userId: user.id, tagSlug: tag_slug, component: "tags" });
      return NextResponse.json({ error: "Failed to lookup tag" }, { status: 500 });
    }

    if (!tagDef) {
      return validationError("Tag not found");
    }

    // Verify tag applies to this entity type
    if (!tagDef.entity_types || !tagDef.entity_types.includes(entity_type)) {
      return validationError("This tag does not apply to the specified entity type");
    }

    // Upsert the vote
    const { data, error } = await serviceClient
      .from("entity_tag_votes")
      .upsert(
        {
          entity_type,
          entity_id,
          tag_definition_id: tagDef.id,
          user_id: user.id,
          vote,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "entity_type,entity_id,tag_definition_id,user_id" }
      )
      .select()
      .single();

    if (error) {
      logger.error("Tag vote upsert error", error, {
        userId: user.id,
        entityType: entity_type,
        entityId: entity_id,
        tagSlug: tag_slug,
        component: "tags",
      });
      return NextResponse.json({ error: "Failed to save vote" }, { status: 500 });
    }

    return NextResponse.json({ success: true, vote: data });
  } catch (error) {
    logger.error("Tag vote API error", error, { userId: user.id, component: "tags" });
    return NextResponse.json({ error: "Failed to save vote" }, { status: 500 });
  }
});

/**
 * DELETE /api/tags/vote
 * Remove a vote on a tag
 */
export const DELETE = withAuth(async (request, { user, serviceClient }) => {
  try {
    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get("entity_type");
    const entity_id = searchParams.get("entity_id");
    const tag_slug = searchParams.get("tag_slug");

    // Validate entity_type
    if (!entity_type || !isValidEntityType(entity_type)) {
      return validationError("Invalid entity_type");
    }

    // Validate entity_id
    const entityIdNum = parseInt(entity_id || "", 10);
    if (!entity_id || isNaN(entityIdNum) || entityIdNum <= 0) {
      return validationError("Invalid entity_id");
    }

    // Validate tag_slug
    if (!tag_slug) {
      return validationError("tag_slug is required");
    }

    // Ensure user has a profile
    await ensureUserProfile(user, serviceClient);

    // Look up tag definition
    const { data: tagDef, error: tagError } = await serviceClient
      .from("tag_definitions")
      .select("id")
      .eq("slug", tag_slug)
      .eq("is_active", true)
      .maybeSingle();

    if (tagError) {
      logger.error("Tag lookup error", tagError, { userId: user.id, tagSlug: tag_slug, component: "tags" });
      return NextResponse.json({ error: "Failed to lookup tag" }, { status: 500 });
    }

    if (!tagDef) {
      return validationError("Tag not found");
    }

    // Delete the vote
    const { error } = await serviceClient
      .from("entity_tag_votes")
      .delete()
      .eq("entity_type", entity_type)
      .eq("entity_id", entityIdNum)
      .eq("tag_definition_id", tagDef.id)
      .eq("user_id", user.id);

    if (error) {
      logger.error("Tag vote delete error", error, {
        userId: user.id,
        entityType: entity_type,
        entityId: entityIdNum,
        tagSlug: tag_slug,
        component: "tags",
      });
      return NextResponse.json({ error: "Failed to delete vote" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Tag vote delete API error", error, { userId: user.id, component: "tags" });
    return NextResponse.json({ error: "Failed to delete vote" }, { status: 500 });
  }
});

/**
 * GET /api/tags/vote
 * Get tag votes/counts for a specific entity
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get("entity_type");
    const entity_id = searchParams.get("entity_id");

    // Validate entity_type
    if (!entity_type || !isValidEntityType(entity_type)) {
      return validationError("Invalid entity_type");
    }

    // Validate entity_id
    const entityIdNum = parseInt(entity_id || "", 10);
    if (!entity_id || isNaN(entityIdNum) || entityIdNum <= 0) {
      return validationError("Invalid entity_id");
    }

    // Get the client for the current user (may be unauthenticated)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Fetch tag summary from materialized view
    const { data: tagSummary, error: summaryError } = await supabase
      .from("entity_tag_summary")
      .select("*")
      .eq("entity_type", entity_type)
      .eq("entity_id", entityIdNum);

    if (summaryError) {
      logger.error("Tag summary fetch error", summaryError, {
        entityType: entity_type,
        entityId: entityIdNum,
        component: "tags",
      });
      return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
    }

    // If user is authenticated, also fetch their votes
    let userVotes: Array<{ tag_definition_id: string; vote: string }> = [];
    if (user) {
      const { data: votes, error: votesError } = await supabase
        .from("entity_tag_votes")
        .select("tag_definition_id, vote")
        .eq("entity_type", entity_type)
        .eq("entity_id", entityIdNum)
        .eq("user_id", user.id);

      if (votesError) {
        logger.warn("User votes fetch error", { error: votesError.message });
      } else {
        userVotes = (votes || []) as Array<{ tag_definition_id: string; vote: string }>;
      }
    }

    // Combine summary with user votes
    const tagsWithVotes = ((tagSummary || []) as Array<Record<string, unknown> & { tag_id: string }>).map((tag) => {
      const userVote = userVotes.find((v) => v.tag_definition_id === tag.tag_id);
      return {
        ...tag,
        user_vote: userVote?.vote || null,
      };
    });

    return NextResponse.json({ tags: tagsWithVotes });
  } catch (error) {
    logger.error("Tag vote GET API error", error, { component: "tags" });
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}
