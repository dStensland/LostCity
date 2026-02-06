import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getEntityTagsWithUserStatus,
  addTagToEntity,
  removeTagFromEntity,
  suggestTag,
} from "@/lib/venue-tags";
import type { EventTagGroup, TagGroup } from "@/lib/types";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

// GET /api/events/[id]/tags - Get all tags for an event
export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  const eventId = parseInt(id);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
  }

  // Get current user if authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tags = await getEntityTagsWithUserStatus("event", eventId, user?.id || null);

  return NextResponse.json({ tags });
}

// POST /api/events/[id]/tags - Add a tag to an event or suggest a new tag
export async function POST(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  const eventId = parseInt(id);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
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
    const result = await addTagToEntity("event", eventId, body.tagId, user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  // If suggesting a new tag
  if (body.suggestedLabel && body.suggestedTagGroup) {
    const validEventGroups: EventTagGroup[] = [
      "audience",
      "social",
      "vibe",
      "format",
      "practical",
      "heads_up",
    ];

    if (!validEventGroups.includes(body.suggestedTagGroup)) {
      return NextResponse.json({ error: "Invalid tag group" }, { status: 400 });
    }

    const result = await suggestTag(
      eventId,
      body.suggestedLabel,
      body.suggestedTagGroup as TagGroup,
      user.id,
      "event"
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      suggestionId: result.suggestionId,
      message: "Tag suggestion submitted for review",
    });
  }

  return NextResponse.json(
    { error: "Either tagId or suggestedLabel and suggestedTagGroup required" },
    { status: 400 }
  );
}

// DELETE /api/events/[id]/tags?tagId=xxx - Remove your own tag
export async function DELETE(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const tagId = searchParams.get("tagId");

  if (!tagId) {
    return NextResponse.json({ error: "tagId required" }, { status: 400 });
  }

  const eventId = parseInt(id);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
  }

  // Require authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const result = await removeTagFromEntity("event", eventId, tagId, user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
