import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const entryId = parseInt(params.id);
    if (isNaN(entryId)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    // Verify ownership and get movie_id
    const { data: watchlistEntry } = await serviceClient
      .from("goblin_watchlist_entries")
      .select("id, movie_id")
      .eq("id", entryId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!watchlistEntry) {
      return NextResponse.json({ error: "Watchlist entry not found" }, { status: 404 });
    }

    const body = await request.json();
    const { watched_date, note, watched_with, log_tag_ids } = body;

    if (!watched_date) {
      return NextResponse.json({ error: "watched_date required" }, { status: 400 });
    }

    const movieId = (watchlistEntry as { movie_id: number }).movie_id;

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

    // Delete watchlist entry (cascades to watchlist_entry_tags)
    await serviceClient
      .from("goblin_watchlist_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", user.id);

    return NextResponse.json({
      log_entry_id: (logEntry as { id: number }).id,
    }, { status: 201 });
  }
);
