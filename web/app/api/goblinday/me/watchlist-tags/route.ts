import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { getNextTagColor } from "@/lib/goblin-log-utils";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request: NextRequest, { user, serviceClient }) => {
  const { data, error } = await serviceClient
    .from("goblin_watchlist_tags")
    .select("id, name, color, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch watchlist tags" }, { status: 500 });
  }

  return NextResponse.json({ tags: data || [] });
});

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const body = await request.json();
  const name = body.name?.trim()?.toLowerCase();

  if (!name || name.length > 50) {
    return NextResponse.json({ error: "Tag name required (max 50 chars)" }, { status: 400 });
  }

  let color = body.color?.trim() || null;
  if (!color) {
    const { count } = await serviceClient
      .from("goblin_watchlist_tags")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    color = getNextTagColor(count || 0);
  }

  const { data, error } = await serviceClient
    .from("goblin_watchlist_tags")
    .insert({ user_id: user.id, name, color } as never)
    .select("id, name, color, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }

  return NextResponse.json({ tag: data }, { status: 201 });
});
