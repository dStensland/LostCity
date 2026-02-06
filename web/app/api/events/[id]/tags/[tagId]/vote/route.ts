import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { voteOnEntityTag } from "@/lib/venue-tags";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; tagId: string }>;
};

// POST /api/events/[id]/tags/[tagId]/vote - Vote on a tag
export async function POST(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id, tagId } = await params;

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
  const voteType = body.voteType;

  // Validate vote type
  if (voteType !== "up" && voteType !== "down" && voteType !== null) {
    return NextResponse.json(
      { error: 'Invalid vote type. Must be "up", "down", or null' },
      { status: 400 }
    );
  }

  const result = await voteOnEntityTag("event", eventId, tagId, user.id, voteType);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
