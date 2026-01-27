import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getEntityTagsWithUserStatus,
  addTagToEntity,
  suggestTag,
} from "@/lib/venue-tags";
import type { EventTagGroup, TagGroup } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

// GET /api/events/[id]/tags - Get all tags for an event
export async function GET(request: NextRequest, { params }: Props) {
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
