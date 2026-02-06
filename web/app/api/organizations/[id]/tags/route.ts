import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getEntityTagsWithUserStatus,
  addTagToEntity,
  removeTagFromEntity,
} from "@/lib/venue-tags";
import type { OrgTagGroup } from "@/lib/types";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

// GET /api/organizations/[id]/tags - Get all tags for an organization
export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  // Get current user if authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tags = await getEntityTagsWithUserStatus("org", id, user?.id || null);

  return NextResponse.json({ tags });
}

// POST /api/organizations/[id]/tags - Add a tag to an organization or suggest a new tag
export async function POST(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

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

    // For org tags, we need to parse the id and pass it to suggestTag
    // Since suggestTag currently expects a venue_id number, we'll need to handle orgs differently
    // For now, return not implemented for tag suggestions on orgs
    // TODO: Extend suggestTag to handle org entity type
    return NextResponse.json(
      { error: "Tag suggestions for organizations not yet supported" },
      { status: 501 }
    );
  }

  return NextResponse.json(
    { error: "Either tagId or suggestedLabel and suggestedTagGroup required" },
    { status: 400 }
  );
}

// DELETE /api/organizations/[id]/tags?tagId=xxx - Remove your own tag
export async function DELETE(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const tagId = searchParams.get("tagId");

  if (!tagId) {
    return NextResponse.json({ error: "tagId required" }, { status: 400 });
  }

  // Require authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const result = await removeTagFromEntity("org", id, tagId, user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
