import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseIntParam } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId: gameIdStr } = await params;
  const gameId = parseIntParam(gameIdStr);
  if (gameId === null) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data: game, error: gameError } = await serviceClient
    .from("goblin_ranking_games")
    .select("id, name, description, image_url, status, created_at")
    .eq("id", gameId)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const gameData = game as {
    id: number;
    name: string;
    description: string | null;
    image_url: string | null;
    status: string;
    created_at: string;
  };

  const { data: categories, error: catError } = await serviceClient
    .from("goblin_ranking_categories")
    .select("id, game_id, name, description, sort_order")
    .eq("game_id", gameId)
    .order("sort_order", { ascending: true });

  if (catError) {
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }

  const categoryIds = (categories || []).map((c: { id: number }) => c.id);

  const { data: items, error: itemError } = await serviceClient
    .from("goblin_ranking_items")
    .select("id, category_id, name, subtitle, description, image_url")
    .in("category_id", categoryIds.length > 0 ? categoryIds : [-1]);

  if (itemError) {
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }

  const itemsByCategory = new Map<number, typeof items>();
  for (const item of items || []) {
    const catId = (item as { category_id: number }).category_id;
    if (!itemsByCategory.has(catId)) itemsByCategory.set(catId, []);
    itemsByCategory.get(catId)!.push(item);
  }

  const result = {
    ...gameData,
    categories: (categories || []).map((cat: { id: number }) => ({
      ...cat,
      items: itemsByCategory.get(cat.id) || [],
    })),
  };

  return NextResponse.json({ game: result });
}
