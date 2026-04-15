import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { ensureMovie } from "@/lib/goblin-movie-utils";

export const dynamic = "force-dynamic";

interface LogMovieRow {
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

interface LogEntryRow {
  id: number;
  watched_date: string;
  note: string | null;
  watched_with: string | null;
  sort_order: number | null;
  tier_name: string | null;
  tier_color: string | null;
  created_at: string;
  updated_at: string;
  movie: LogMovieRow;
}

interface LogTagRow {
  id: number;
  name: string;
  color: string | null;
}

interface LogTagJoinRow {
  entry_id: number;
  tag: LogTagRow | null;
}

interface LogPostBody {
  tmdb_id?: number;
  watched_date?: string;
  note?: string | null;
  watched_with?: string | null;
  tag_ids?: number[];
}

interface InsertedLogEntryRow {
  id: number;
  watched_date: string;
  note: string | null;
  watched_with: string | null;
  created_at: string;
}

export const GET = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const year = request.nextUrl.searchParams.get("year");
  const tag = request.nextUrl.searchParams.get("tag");

  let query = serviceClient
    .from("goblin_log_entries")
    .select(`
      id, watched_date, note, watched_with, sort_order, tier_name, tier_color, created_at, updated_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
        runtime_minutes, director, year, rt_critics_score, rt_audience_score,
        tmdb_vote_average, tmdb_vote_count, mpaa_rating, imdb_id, synopsis, trailer_url
      )
    `)
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("watched_date", { ascending: false });

  if (year) {
    query = query
      .gte("watched_date", `${year}-01-01`)
      .lte("watched_date", `${year}-12-31`);
  }

  const { data: entries, error } = await query.returns<LogEntryRow[]>();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch log entries" }, { status: 500 });
  }

  // Fetch tags for all entries in one query
  const entryIds = (entries || []).map((e) => e.id);
  const entryTags: Record<number, LogTagRow[]> = {};

  if (entryIds.length > 0) {
    const { data: tagRows } = await serviceClient
      .from("goblin_log_entry_tags")
      .select("entry_id, tag:goblin_tags!tag_id (id, name, color)")
      .in("entry_id", entryIds)
      .returns<LogTagJoinRow[]>();

    for (const row of tagRows || []) {
      if (!entryTags[row.entry_id]) entryTags[row.entry_id] = [];
      if (row.tag) entryTags[row.entry_id].push(row.tag);
    }
  }

  const result = (entries || []).map((e) => ({
    ...e,
    tags: entryTags[e.id] || [],
  }));

  // If filtering by tag, filter client-side (simpler than a subquery)
  if (tag) {
    const filtered = result.filter((e) =>
      e.tags.some((t) => t.name === tag.toLowerCase())
    );
    return NextResponse.json({ entries: filtered });
  }

  return NextResponse.json({ entries: result });
});

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const raw: unknown = await request.json();
  const body: LogPostBody =
    typeof raw === "object" && raw !== null ? (raw as LogPostBody) : {};
  const { tmdb_id, watched_date, note, watched_with, tag_ids } = body;

  if (!tmdb_id || !watched_date) {
    return NextResponse.json(
      { error: "tmdb_id and watched_date required" },
      { status: 400 }
    );
  }

  // Ensure movie exists in our DB
  const movie = await ensureMovie(serviceClient, tmdb_id);
  if (!movie) {
    return NextResponse.json({ error: "Failed to find or create movie" }, { status: 500 });
  }

  // Create log entry
  const { data: entry, error } = await serviceClient
    .from("goblin_log_entries")
    .insert({
      user_id: user.id,
      movie_id: movie.id,
      watched_date,
      note: note?.trim() || null,
      watched_with: watched_with?.trim() || null,
    } as never)
    .select("id, watched_date, note, watched_with, created_at")
    .single<InsertedLogEntryRow>();

  if (error || !entry) {
    return NextResponse.json({ error: "Failed to create log entry" }, { status: 500 });
  }

  // Attach tags if provided
  if (tag_ids && tag_ids.length > 0) {
    const tagRows = tag_ids.map((tagId) => ({
      entry_id: entry.id,
      tag_id: tagId,
    }));
    await serviceClient
      .from("goblin_log_entry_tags")
      .insert(tagRows as never);
  }

  return NextResponse.json({ entry }, { status: 201 });
});
