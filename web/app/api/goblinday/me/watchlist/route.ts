import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

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
    .order("added_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch watchlist entries" }, { status: 500 });
  }

  // Fetch tags for all entries in one query
  const entryIds = (entries || []).map((e: any) => e.id);
  let entryTags: Record<number, { id: number; name: string; color: string | null }[]> = {};

  if (entryIds.length > 0) {
    const { data: tagRows } = await serviceClient
      .from("goblin_watchlist_entry_tags")
      .select("entry_id, tag:goblin_watchlist_tags!tag_id (id, name, color)")
      .in("entry_id", entryIds);

    for (const row of tagRows || []) {
      const r = row as any;
      if (!entryTags[r.entry_id]) entryTags[r.entry_id] = [];
      if (r.tag) entryTags[r.entry_id].push(r.tag);
    }
  }

  const result = (entries || []).map((e: any) => ({
    ...e,
    tags: entryTags[e.id] || [],
  }));

  return NextResponse.json({ entries: result });
});

/** Ensure a movie exists in goblin_movies by TMDB ID, fetching from TMDB if needed */
async function ensureMovie(
  serviceClient: any,
  tmdbId: number
): Promise<{ id: number } | null> {
  // Check if already exists
  const { data: existing } = await serviceClient
    .from("goblin_movies")
    .select("id")
    .eq("tmdb_id", tmdbId)
    .maybeSingle();

  if (existing) return existing as { id: number };

  // Fetch from TMDB
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!tmdbKey) return null;

  const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${tmdbKey}&append_to_response=credits`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const m = await res.json();
    const director = m.credits?.crew?.find((c: any) => c.job === "Director")?.name || null;
    const releaseYear = m.release_date ? parseInt(m.release_date.split("-")[0]) : null;

    const { data: inserted, error } = await serviceClient
      .from("goblin_movies")
      .insert({
        tmdb_id: tmdbId,
        title: m.title,
        release_date: m.release_date || null,
        poster_path: m.poster_path || null,
        backdrop_path: m.backdrop_path || null,
        year: releaseYear,
        synopsis: m.overview || null,
        genres: m.genres?.map((g: any) => g.name) || null,
        runtime_minutes: m.runtime || null,
        director,
        tmdb_vote_average: m.vote_average || null,
        tmdb_vote_count: m.vote_count || null,
        tmdb_popularity: m.popularity || null,
      } as never)
      .select("id")
      .single();

    if (error || !inserted) return null;
    return inserted as { id: number };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const body = await request.json();
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
    const movie = await ensureMovie(serviceClient, tmdb_id);
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
    .maybeSingle();

  const nextSortOrder = ((maxRow as any)?.sort_order ?? 0) + 1;

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
    .single();

  if (error || !entry) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Movie already in watchlist" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create watchlist entry" }, { status: 500 });
  }

  // Attach tags if provided
  if (tag_ids && tag_ids.length > 0) {
    const tagRows = tag_ids.map((tagId: number) => ({
      entry_id: (entry as any).id,
      tag_id: tagId,
    }));
    await serviceClient
      .from("goblin_watchlist_entry_tags")
      .insert(tagRows as never);
  }

  return NextResponse.json({ entry }, { status: 201 });
});
