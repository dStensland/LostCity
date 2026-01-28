import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { voteOnEntityTag } from "@/lib/venue-tags";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; tagId: string }>;
};

// POST /api/producers/[id]/tags/[tagId]/vote - Vote on a tag
export async function POST(request: NextRequest, { params }: Props) {
  const { id, tagId } = await params;

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

  const result = await voteOnEntityTag("org", id, tagId, user.id, voteType);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
