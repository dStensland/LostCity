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

    // Verify ownership and get movie_id + recommender name
    const { data: rec } = await serviceClient
      .from("goblin_watchlist_recommendations")
      .select("id, movie_id, status, recommender_name")
      .eq("id", recId)
      .eq("target_user_id", user.id)
      .maybeSingle();

    if (!rec) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    const typedRec = rec as { movie_id: number; status: string; recommender_name: string };

    if (typedRec.status !== "pending") {
      return NextResponse.json({ error: "Recommendation already handled" }, { status: 409 });
    }

    if (action === "add") {
      // Find or create the recommendations group
      let { data: recsGroup } = await serviceClient
        .from("goblin_lists")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_recommendations", true)
        .maybeSingle();

      if (!recsGroup) {
        // Auto-assign sort_order
        const { data: maxRow } = await serviceClient
          .from("goblin_lists")
          .select("sort_order")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const nextSortOrder =
          ((maxRow as { sort_order?: number | null } | null)?.sort_order ?? 0) + 1;

        const { data: created } = await serviceClient
          .from("goblin_lists")
          .insert({
            user_id: user.id,
            name: "Recommendations",
            is_recommendations: true,
            sort_order: nextSortOrder,
          } as never)
          .select("id")
          .single();

        recsGroup = created;
      }

      if (recsGroup) {
        const groupId = (recsGroup as { id: number }).id;

        // Auto-assign sort_order within group
        const { data: maxMovie } = await serviceClient
          .from("goblin_list_movies")
          .select("sort_order")
          .eq("list_id", groupId)
          .order("sort_order", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const nextMovieOrder =
          ((maxMovie as { sort_order?: number | null } | null)?.sort_order ?? 0) + 1;

        await serviceClient
          .from("goblin_list_movies")
          .insert({
            list_id: groupId,
            movie_id: typedRec.movie_id,
            sort_order: nextMovieOrder,
            note: `Recommended by ${typedRec.recommender_name}`,
          } as never);
      }
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
