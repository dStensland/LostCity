import { NextResponse } from "next/server";
import { getTagDefinitionsByGroup, getAllTagDefinitions } from "@/lib/venue-tags";
import type { TagEntityType } from "@/lib/types";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/tags - Get all tag definitions, optionally grouped by tag_group and/or filtered by entity type
export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const grouped = searchParams.get("grouped") === "true";
  const entityType = searchParams.get("entityType") as TagEntityType | null;

  if (grouped) {
    const tagsByGroup = await getTagDefinitionsByGroup(entityType || undefined);
    return NextResponse.json({ tags: tagsByGroup });
  }

  const tags = await getAllTagDefinitions(entityType || undefined);
  return NextResponse.json({ tags });
}
