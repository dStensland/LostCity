import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const PATCH = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await serviceClient
      .from("goblin_lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const { name, movie_ids } = await request.json();

    if (name) {
      await serviceClient
        .from("goblin_lists")
        .update({ name } as never)
        .eq("id", listId);
    }

    if (Array.isArray(movie_ids)) {
      // Replace all movies: delete existing, insert new
      await serviceClient
        .from("goblin_list_movies")
        .delete()
        .eq("list_id", listId);

      if (movie_ids.length > 0) {
        const rows = movie_ids.map((mid: number) => ({
          list_id: listId,
          movie_id: mid,
        }));
        await serviceClient.from("goblin_list_movies").insert(rows as never);
      }
    }

    return NextResponse.json({ success: true });
  }
);

export const DELETE = withAuthAndParams<{ id: string }>(
  async (_request, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("goblin_lists")
      .delete()
      .eq("id", listId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  }
);
