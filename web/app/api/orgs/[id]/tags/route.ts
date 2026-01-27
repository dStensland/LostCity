import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getEntityTagsWithUserStatus,
  addTagToEntity,
} from "@/lib/venue-tags";
import type { OrgTagGroup } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

// GET /api/orgs/[id]/tags - Get all tags for an organization
export async function GET(request: NextRequest, { params }: Props) {
  const { id } = await params;

  // Org IDs are UUIDs
  if (!id || id.length < 10) {
    return NextResponse.json({ error: "Invalid org ID" }, { status: 400 });
  }

  // Get current user if authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tags = await getEntityTagsWithUserStatus("org", id, user?.id || null);

  return NextResponse.json({ tags });
}

// POST /api/orgs/[id]/tags - Add a tag to an organization or suggest a new tag
export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;

  if (!id || id.length < 10) {
    return NextResponse.json({ error: "Invalid org ID" }, { status: 400 });
  }

  // Require authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();

  // If tagId is provided, add existing tag
  if (body.tagId) {
    const result = await addTagToEntity("org", id, body.tagId, user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  // If suggesting a new tag
  if (body.suggestedLabel && body.suggestedTagGroup) {
    const validOrgGroups: OrgTagGroup[] = [
      "values",
      "structure",
      "engagement",
      "heads_up",
    ];

    if (!validOrgGroups.includes(body.suggestedTagGroup)) {
      return NextResponse.json({ error: "Invalid tag group" }, { status: 400 });
    }

    // For suggestions, we still need an integer ID for the venue_tag_suggestions table
    // This is a limitation of the current schema - suggestions are venue-centric
    // For now, we'll return an error for org tag suggestions
    return NextResponse.json(
      { error: "Tag suggestions for organizations coming soon" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: "Either tagId or suggestedLabel and suggestedTagGroup required" },
    { status: 400 }
  );
}
