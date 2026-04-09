import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { parseIntParam } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (
  request: NextRequest,
  { user, serviceClient }
) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const gameIdStr = segments[segments.indexOf("rankings") + 1];
  const gameId = parseIntParam(gameIdStr);
  if (gameId === null) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const { data: categories } = await serviceClient
    .from("goblin_ranking_categories")
    .select("id")
    .eq("game_id", gameId);

  const categoryIds = (categories || []).map((c: { id: number }) => c.id);
  if (categoryIds.length === 0) {
    return NextResponse.json({ entries: [] });
  }

  const { data: items } = await serviceClient
    .from("goblin_ranking_items")
    .select("id")
    .in("category_id", categoryIds);

  const itemIds = (items || []).map((i: { id: number }) => i.id);
  if (itemIds.length === 0) {
    return NextResponse.json({ entries: [] });
  }

  const { data: entries, error } = await serviceClient
    .from("goblin_ranking_entries")
    .select("item_id, sort_order, tier_name, tier_color")
    .eq("user_id", user.id)
    .in("item_id", itemIds);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }

  return NextResponse.json({ entries: entries || [] });
});

export const POST = withAuth(async (
  request: NextRequest,
  { user, serviceClient }
) => {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    `${user.id}:ranking-save`
  );
  if (rateLimitResult) return rateLimitResult;

  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const gameIdStr = segments[segments.indexOf("rankings") + 1];
  const gameId = parseIntParam(gameIdStr);
  if (gameId === null) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const { data: game } = await serviceClient
    .from("goblin_ranking_games")
    .select("status")
    .eq("id", gameId)
    .maybeSingle();

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if ((game as { status: string }).status !== "open") {
    return NextResponse.json({ error: "Game is closed" }, { status: 403 });
  }

  const body = await request.json();
  const { category_id, entries } = body as {
    category_id: number;
    entries: { item_id: number; sort_order: number; tier_name: string | null; tier_color: string | null }[];
  };

  if (!category_id || !Array.isArray(entries)) {
    return NextResponse.json({ error: "category_id and entries array required" }, { status: 400 });
  }

  const { data: category } = await serviceClient
    .from("goblin_ranking_categories")
    .select("id")
    .eq("id", category_id)
    .eq("game_id", gameId)
    .maybeSingle();

  if (!category) {
    return NextResponse.json({ error: "Category not found in this game" }, { status: 400 });
  }

  const { data: validItems } = await serviceClient
    .from("goblin_ranking_items")
    .select("id")
    .eq("category_id", category_id);

  const validItemIds = new Set((validItems || []).map((i: { id: number }) => i.id));
  const submittedItemIds = entries.map((e) => e.item_id);

  for (const itemId of submittedItemIds) {
    if (!validItemIds.has(itemId)) {
      return NextResponse.json({ error: `Item ${itemId} does not belong to this category` }, { status: 400 });
    }
  }

  // Delete existing entries for this user in this category (scoped to category only)
  const allCategoryItemIds = [...validItemIds];
  if (allCategoryItemIds.length > 0) {
    await serviceClient
      .from("goblin_ranking_entries")
      .delete()
      .eq("user_id", user.id)
      .in("item_id", allCategoryItemIds);
  }

  // Insert new entries
  if (entries.length > 0) {
    const now = new Date().toISOString();
    const rows = entries.map((e) => ({
      item_id: e.item_id,
      user_id: user.id,
      sort_order: e.sort_order,
      tier_name: e.tier_name,
      tier_color: e.tier_color,
      created_at: now,
      updated_at: now,
    }));

    const { error: insertError } = await serviceClient
      .from("goblin_ranking_entries")
      .insert(rows as never);

    if (insertError) {
      return NextResponse.json({ error: "Failed to save rankings" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
});
