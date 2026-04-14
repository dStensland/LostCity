import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { ensureMovie } from "@/lib/goblin-movie-utils";

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

    const body = await request.json();
    const { tmdb_id, note } = body;

    if (!tmdb_id) {
      return NextResponse.json({ error: "tmdb_id required" }, { status: 400 });
    }

    const movie = await ensureMovie(serviceClient, tmdb_id);
    if (!movie) {
      return NextResponse.json(
        { error: "Failed to find or create movie" },
        { status: 500 }
      );
    }

    // Auto-assign sort_order within the group
    const { data: maxRow } = await serviceClient
      .from("goblin_list_movies")
      .select("sort_order")
      .eq("list_id", listId)
      .order("sort_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? 0) + 1;

    const { error } = await serviceClient
      .from("goblin_list_movies")
      .insert({
        list_id: listId,
        movie_id: movie.id,
        sort_order: nextSortOrder,
        note: note?.trim() || null,
      } as never);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Movie already in this group" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to add movie" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, movie_id: movie.id }, { status: 201 });
  }
);
