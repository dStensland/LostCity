import { NextResponse } from "next/server";
import { getTagDefinitionsByCategory, getAllTagDefinitions } from "@/lib/venue-tags";

export const dynamic = "force-dynamic";

// GET /api/tags - Get all tag definitions, optionally grouped by category
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const grouped = searchParams.get("grouped") === "true";

  if (grouped) {
    const tagsByCategory = await getTagDefinitionsByCategory();
    return NextResponse.json({ tags: tagsByCategory });
  }

  const tags = await getAllTagDefinitions();
  return NextResponse.json({ tags });
}
