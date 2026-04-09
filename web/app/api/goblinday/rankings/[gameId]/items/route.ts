import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { parseIntParam } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// ─── POST — add a new item ───────────────────────────────────────────────────

export const POST = withAuthAndParams<{ gameId: string }>(async (
  request: NextRequest,
  { user, serviceClient, params }
) => {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    `${user.id}:ranking-item-add`
  );
  if (rateLimitResult) return rateLimitResult;

  const gameId = parseIntParam(params.gameId);
  if (gameId === null) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const body = await request.json();
  const { category_id, name, subtitle } = body as {
    category_id: number;
    name: string;
    subtitle?: string;
  };

  if (typeof category_id !== "number" || !name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "category_id (number) and name (string) are required" }, { status: 400 });
  }

  // Validate category belongs to the game
  const { data: category } = await serviceClient
    .from("goblin_ranking_categories")
    .select("id")
    .eq("id", category_id)
    .eq("game_id", gameId)
    .maybeSingle();

  if (!category) {
    return NextResponse.json({ error: "Category not found in this game" }, { status: 400 });
  }

  const { data: item, error: insertError } = await serviceClient
    .from("goblin_ranking_items")
    .insert({
      category_id,
      name: name.trim(),
      subtitle: subtitle?.trim() ?? null,
    } as never)
    .select("id, category_id, name, subtitle, image_url")
    .maybeSingle();

  if (insertError || !item) {
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }

  return NextResponse.json({ item }, { status: 201 });
});

// ─── PATCH — edit an existing item ──────────────────────────────────────────

export const PATCH = withAuthAndParams<{ gameId: string }>(async (
  request: NextRequest,
  { user, serviceClient, params }
) => {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    `${user.id}:ranking-item-edit`
  );
  if (rateLimitResult) return rateLimitResult;

  const gameId = parseIntParam(params.gameId);
  if (gameId === null) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const body = await request.json();
  const { item_id, name, subtitle } = body as {
    item_id: number;
    name?: string;
    subtitle?: string;
  };

  if (typeof item_id !== "number") {
    return NextResponse.json({ error: "item_id (number) is required" }, { status: 400 });
  }

  // Validate item belongs to a category in this game
  const { data: categories } = await serviceClient
    .from("goblin_ranking_categories")
    .select("id")
    .eq("game_id", gameId);

  const categoryIds = (categories || []).map((c: { id: number }) => c.id);
  if (categoryIds.length === 0) {
    return NextResponse.json({ error: "Item not found in this game" }, { status: 404 });
  }

  const { data: existingItem } = await serviceClient
    .from("goblin_ranking_items")
    .select("id")
    .eq("id", item_id)
    .in("category_id", categoryIds)
    .maybeSingle();

  if (!existingItem) {
    return NextResponse.json({ error: "Item not found in this game" }, { status: 404 });
  }

  // Build update payload — only include fields that were provided
  const updates: Record<string, string | null> = {};
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    updates.name = name.trim();
  }
  if (subtitle !== undefined) {
    updates.subtitle = typeof subtitle === "string" ? subtitle.trim() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error: updateError } = await serviceClient
    .from("goblin_ranking_items")
    .update(updates as never)
    .eq("id", item_id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});

// ─── DELETE — remove an item (entries cascade automatically) ─────────────────

export const DELETE = withAuthAndParams<{ gameId: string }>(async (
  request: NextRequest,
  { user, serviceClient, params }
) => {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    `${user.id}:ranking-item-delete`
  );
  if (rateLimitResult) return rateLimitResult;

  const gameId = parseIntParam(params.gameId);
  if (gameId === null) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const body = await request.json();
  const { item_id } = body as { item_id: number };

  if (typeof item_id !== "number") {
    return NextResponse.json({ error: "item_id (number) is required" }, { status: 400 });
  }

  // Validate item belongs to a category in this game
  const { data: categories } = await serviceClient
    .from("goblin_ranking_categories")
    .select("id")
    .eq("game_id", gameId);

  const categoryIds = (categories || []).map((c: { id: number }) => c.id);
  if (categoryIds.length === 0) {
    return NextResponse.json({ error: "Item not found in this game" }, { status: 404 });
  }

  const { data: existingItem } = await serviceClient
    .from("goblin_ranking_items")
    .select("id")
    .eq("id", item_id)
    .in("category_id", categoryIds)
    .maybeSingle();

  if (!existingItem) {
    return NextResponse.json({ error: "Item not found in this game" }, { status: 404 });
  }

  const { error: deleteError } = await serviceClient
    .from("goblin_ranking_items")
    .delete()
    .eq("id", item_id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
