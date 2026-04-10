import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const recId = parseInt(params.id);
    if (isNaN(recId)) {
      return NextResponse.json({ error: "Invalid recommendation ID" }, { status: 400 });
    }

    const body = await request.json();
    const action = body.action;

    if (action !== "add" && action !== "dismiss") {
      return NextResponse.json({ error: "action must be 'add' or 'dismiss'" }, { status: 400 });
    }

    // Verify ownership and get movie_id
    const { data: rec } = await serviceClient
      .from("goblin_watchlist_recommendations")
      .select("id, movie_id, status")
      .eq("id", recId)
      .eq("target_user_id", user.id)
      .maybeSingle();

    if (!rec) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    if ((rec as { status: string }).status !== "pending") {
      return NextResponse.json({ error: "Recommendation already handled" }, { status: 409 });
    }

    const movieId = (rec as { movie_id: number }).movie_id;

    if (action === "add") {
      // Add to watchlist at bottom
      const { data: maxRow } = await serviceClient
        .from("goblin_watchlist_entries")
        .select("sort_order")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1;

      await serviceClient
        .from("goblin_watchlist_entries")
        .insert({
          user_id: user.id,
          movie_id: movieId,
          sort_order: nextOrder,
        } as never)
        .select("id")
        .maybeSingle();
    }

    // Update recommendation status
    await serviceClient
      .from("goblin_watchlist_recommendations")
      .update({ status: action === "add" ? "added" : "dismissed" } as never)
      .eq("id", recId)
      .eq("target_user_id", user.id);

    return NextResponse.json({ success: true, action });
  }
);
