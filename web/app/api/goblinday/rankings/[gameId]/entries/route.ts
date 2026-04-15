import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseIntParam } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  // Rate limit before auth
  const rateLimitResult = applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  // Require auth. This endpoint returns display_name + avatar_url of every
  // ranking participant for a given gameId. Anonymous gameId enumeration
  // was leaking participant identities — PII, not just aggregated data.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gameId: gameIdStr } = await params;
  const gameId = parseIntParam(gameIdStr);
  if (gameId === null) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data: categories } = await serviceClient
    .from("goblin_ranking_categories")
    .select("id")
    .eq("game_id", gameId);

  const categoryIds = (categories || []).map((c: { id: number }) => c.id);
  if (categoryIds.length === 0) {
    return NextResponse.json({ participants: [] });
  }

  const { data: items } = await serviceClient
    .from("goblin_ranking_items")
    .select("id")
    .in("category_id", categoryIds);

  const itemIds = (items || []).map((i: { id: number }) => i.id);
  if (itemIds.length === 0) {
    return NextResponse.json({ participants: [] });
  }

  const { data: entries, error: entryError } = await serviceClient
    .from("goblin_ranking_entries")
    .select("item_id, user_id, sort_order, tier_name, tier_color")
    .in("item_id", itemIds);

  if (entryError) {
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }

  const byUser = new Map<string, typeof entries>();
  for (const entry of entries || []) {
    const uid = (entry as { user_id: string }).user_id;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push(entry);
  }

  const userIds = [...byUser.keys()];
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileMap = new Map<string, { display_name: string; avatar_url: string | null }>();
  for (const p of profiles || []) {
    const profile = p as { id: string; display_name: string; avatar_url: string | null };
    profileMap.set(profile.id, { display_name: profile.display_name, avatar_url: profile.avatar_url });
  }

  const participants = userIds.map((uid) => {
    const userEntries = byUser.get(uid) || [];
    const profile = profileMap.get(uid);
    return {
      user_id: uid,
      display_name: profile?.display_name || "Unknown",
      avatar_url: profile?.avatar_url || null,
      items_ranked: userEntries.length,
      entries: userEntries.map((e) => ({
        item_id: (e as { item_id: number }).item_id,
        sort_order: (e as { sort_order: number }).sort_order,
        tier_name: (e as { tier_name: string | null }).tier_name,
        tier_color: (e as { tier_color: string | null }).tier_color,
      })),
    };
  });

  return NextResponse.json({ participants });
}
