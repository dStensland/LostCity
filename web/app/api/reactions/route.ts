import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";

// POST /api/reactions — upsert a reaction
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { target_type, target_id, emoji } = body as {
    target_type: string;
    target_id: number;
    emoji: string;
  };

  if (!target_type || !target_id || !emoji) {
    return NextResponse.json({ error: "target_type, target_id, and emoji required" }, { status: 400 });
  }

  if (!["rsvp", "follow", "save"].includes(target_type)) {
    return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });
  }

  // Validate emoji is in allowed set
  const ALLOWED_EMOJIS = ["🔥", "❤️", "🎉", "😂", "💯", "👀"];
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const attribution = await resolvePortalAttributionForWrite(request, {
    endpoint: "/api/reactions",
    body,
    requireWhenHinted: true,
  });
  if (attribution.response) return attribution.response;
  const portalId = attribution.portalId;

  const { error } = await serviceClient
    .from("activity_reactions")
    .upsert(
      {
        user_id: user.id,
        target_type,
        target_id,
        emoji,
        ...(portalId ? { portal_id: portalId } : {}),
      } as never,
      { onConflict: "user_id,target_type,target_id" }
    );

  if (error) {
    return NextResponse.json({ error: "Failed to save reaction" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/reactions — remove a reaction
export async function DELETE(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("target_type");
  const targetId = searchParams.get("target_id");

  if (!targetType || !targetId) {
    return NextResponse.json({ error: "target_type and target_id required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  await serviceClient
    .from("activity_reactions")
    .delete()
    .eq("user_id", user.id)
    .eq("target_type", targetType)
    .eq("target_id", parseInt(targetId, 10));

  return NextResponse.json({ success: true });
}

// GET /api/reactions — batch fetch reactions for activity items
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("target_type");
  const targetIdsParam = searchParams.get("target_ids"); // comma-separated

  if (!targetType || !targetIdsParam) {
    return NextResponse.json({ error: "target_type and target_ids required" }, { status: 400 });
  }

  const targetIds = targetIdsParam.split(",").map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

  if (targetIds.length === 0 || targetIds.length > 100) {
    return NextResponse.json({ error: "Invalid target_ids" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("activity_reactions")
    .select("target_id, emoji, user_id")
    .eq("target_type", targetType)
    .in("target_id", targetIds);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 });
  }

  type ReactionRow = { target_id: number; emoji: string; user_id: string };
  const rows = (data || []) as unknown as ReactionRow[];

  // Group by target_id, then by emoji
  const reactionsMap: Record<number, { emoji: string; count: number; hasReacted: boolean }[]> = {};

  for (const row of rows) {
    if (!reactionsMap[row.target_id]) {
      reactionsMap[row.target_id] = [];
    }

    const existing = reactionsMap[row.target_id].find((r) => r.emoji === row.emoji);
    if (existing) {
      existing.count++;
      if (row.user_id === user.id) existing.hasReacted = true;
    } else {
      reactionsMap[row.target_id].push({
        emoji: row.emoji,
        count: 1,
        hasReacted: row.user_id === user.id,
      });
    }
  }

  return NextResponse.json({ reactions: reactionsMap });
}
