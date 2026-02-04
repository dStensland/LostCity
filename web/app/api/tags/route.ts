import { NextResponse } from "next/server";
import { getTagDefinitionsByGroup, getAllTagDefinitions } from "@/lib/venue-tags";
import type { TagEntityType } from "@/lib/types";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";

// Revalidate every 10 minutes - tag definitions rarely change
export const revalidate = 600;

// GET /api/tags - Get all tag definitions, optionally grouped by tag_group and/or filtered by entity type
export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const grouped = searchParams.get("grouped") === "true";
  const entityType = searchParams.get("entityType") as TagEntityType | null;

  const cacheHeaders = {
    "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800"
  };

  if (grouped) {
    const tagsByGroup = await getTagDefinitionsByGroup(entityType || undefined);
    return NextResponse.json({ tags: tagsByGroup }, { headers: cacheHeaders });
  }

  const tags = await getAllTagDefinitions(entityType || undefined);
  return NextResponse.json({ tags }, { headers: cacheHeaders });
}
