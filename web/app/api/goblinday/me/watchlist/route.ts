import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { ensureMovie } from "@/lib/goblin-movie-utils";

export const dynamic = "force-dynamic";

interface WatchlistMovieRow {
  id: number;
  tmdb_id: number | null;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  genres: string[] | null;
  runtime_minutes: number | null;
  director: string | null;
  year: number | null;
  rt_critics_score: number | null;
  rt_audience_score: number | null;
  tmdb_vote_average: number | null;
  tmdb_vote_count: number | null;
  mpaa_rating: string | null;
  imdb_id: string | null;
  synopsis: string | null;
  trailer_url: string | null;
}

interface WatchlistEntryRow {
  id: number;
  note: string | null;
  sort_order: number | null;
  added_at: string;
  movie: WatchlistMovieRow;
}

interface WatchlistTagRow {
  id: number;
  name: string;
  color: string | null;
}

interface WatchlistTagJoinRow {
  entry_id: number;
  tag: WatchlistTagRow | null;
}

interface SortOrderRow {
  sort_order: number | null;
}

interface InsertedWatchlistEntryRow {
  id: number;
  note: string | null;
  sort_order: number | null;
  added_at: string;
}

interface WatchlistPostBody {
  tmdb_id?: number;
  movie_id?: number;
  note?: string | null;
  tag_ids?: number[];
}

export const GET = withAuth(async (_request: NextRequest, { user, serviceClient }) => {
  const { data: entries, error } = await serviceClient
    .from("goblin_watchlist_entries")
    .select(`
      id, note, sort_order, added_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
        runtime_minutes, director, year, rt_critics_score, rt_audience_score,
        tmdb_vote_average, tmdb_vote_count, mpaa_rating, imdb_id, synopsis, trailer_url
      )
    `)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: false })
    .returns<WatchlistEntryRow[]>();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch watchlist entries" }, { status: 500 });
  }

  // Fetch tags for all entries in one query
  const entryIds = (entries || []).map((e) => e.id);
  const entryTags: Record<number, WatchlistTagRow[]> = {};

  if (entryIds.length > 0) {
    const { data: tagRows } = await serviceClient
      .from("goblin_watchlist_entry_tags")
      .select("entry_id, tag:goblin_watchlist_tags!tag_id (id, name, color)")
      .in("entry_id", entryIds)
      .returns<WatchlistTagJoinRow[]>();

    for (const row of tagRows || []) {
      if (!entryTags[row.entry_id]) entryTags[row.entry_id] = [];
      if (row.tag) entryTags[row.entry_id].push(row.tag);
    }
  }

  const result = (entries || []).map((e) => ({
    ...e,
    tags: entryTags[e.id] || [],
  }));

  return NextResponse.json({ entries: result });
});

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const raw: unknown = await request.json();
  const body: WatchlistPostBody =
    typeof raw === "object" && raw !== null ? (raw as WatchlistPostBody) : {};
  const { tmdb_id, movie_id, note, tag_ids } = body;

  if (!tmdb_id && !movie_id) {
    return NextResponse.json(
      { error: "tmdb_id or movie_id required" },
      { status: 400 }
    );
  }

  let resolvedMovieId: number;

  if (movie_id) {
    // Quick-add path: movie_id is already the internal DB ID
    resolvedMovieId = movie_id;
  } else {
    // TMDB search add path: ensure movie exists in our DB
    const movie = await ensureMovie(serviceClient, tmdb_id!);
    if (!movie) {
      return NextResponse.json({ error: "Failed to find or create movie" }, { status: 500 });
    }
    resolvedMovieId = movie.id;
  }

  // Auto-assign sort_order = max existing + 1
  const { data: maxRow } = await serviceClient
    .from("goblin_watchlist_entries")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<SortOrderRow>();

  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  // Create watchlist entry
  const { data: entry, error } = await serviceClient
    .from("goblin_watchlist_entries")
    .insert({
      user_id: user.id,
      movie_id: resolvedMovieId,
      note: note?.trim() || null,
      sort_order: nextSortOrder,
    } as never)
    .select("id, note, sort_order, added_at")
    .single<InsertedWatchlistEntryRow>();

  if (error || !entry) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Movie already in watchlist" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create watchlist entry" }, { status: 500 });
  }

  // Attach tags if provided
  if (tag_ids && tag_ids.length > 0) {
    const tagRows = tag_ids.map((tagId) => ({
      entry_id: entry.id,
      tag_id: tagId,
    }));
    await serviceClient
      .from("goblin_watchlist_entry_tags")
      .insert(tagRows as never);
  }

  return NextResponse.json({ entry }, { status: 201 });
});
