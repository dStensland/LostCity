import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const DELETE = withAuthAndParams<{ id: string; movieId: string }>(
  async (_request, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    const movieId = parseInt(params.movieId);
    if (isNaN(listId) || isNaN(movieId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // Verify list ownership
    const { data: list } = await serviceClient
      .from("goblin_lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const { error } = await serviceClient
      .from("goblin_list_movies")
      .delete()
      .eq("list_id", listId)
      .eq("movie_id", movieId);

    if (error) {
      return NextResponse.json({ error: "Failed to remove movie" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  }
);
