import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    // Verify ownership
    const { data: list } = await serviceClient
      .from("goblin_lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const { order } = await request.json();
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: "order array required" }, { status: 400 });
    }

    const updates = order.map((item: { movie_id: number; sort_order: number }) =>
      serviceClient
        .from("goblin_list_movies")
        .update({ sort_order: item.sort_order } as never)
        .eq("list_id", listId)
        .eq("movie_id", item.movie_id)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  }
);
