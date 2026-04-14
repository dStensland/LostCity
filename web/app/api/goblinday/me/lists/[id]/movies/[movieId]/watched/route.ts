import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string; movieId: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
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

    const body = await request.json();
    const { watched_date, note, watched_with, log_tag_ids } = body;

    if (!watched_date) {
      return NextResponse.json({ error: "watched_date required" }, { status: 400 });
    }

    // Create log entry
    const { data: logEntry, error: logError } = await serviceClient
      .from("goblin_log_entries")
      .insert({
        user_id: user.id,
        movie_id: movieId,
        watched_date,
        note: note?.trim() || null,
        watched_with: watched_with?.trim() || null,
      } as never)
      .select("id")
      .single();

    if (logError || !logEntry) {
      return NextResponse.json({ error: "Failed to create log entry" }, { status: 500 });
    }

    // Attach log tags if provided
    if (log_tag_ids && log_tag_ids.length > 0) {
      const tagRows = log_tag_ids.map((tagId: number) => ({
        entry_id: (logEntry as { id: number }).id,
        tag_id: tagId,
      }));
      await serviceClient
        .from("goblin_log_entry_tags")
        .insert(tagRows as never);
    }

    // Remove movie from group
    await serviceClient
      .from("goblin_list_movies")
      .delete()
      .eq("list_id", listId)
      .eq("movie_id", movieId);

    return NextResponse.json(
      { log_entry_id: (logEntry as { id: number }).id },
      { status: 201 }
    );
  }
);
