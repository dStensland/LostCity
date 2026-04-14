import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { ensureMovie } from "@/lib/goblin-movie-utils";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request: NextRequest, { user, serviceClient }) => {
  const { data: lists, error } = await serviceClient
    .from("goblin_lists")
    .select("id, name, description, sort_order, is_recommendations, created_at")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
  }

  // Fetch movies for all lists in one query
  const listIds = (lists || []).map((l: any) => l.id);
  let listMovies: Record<number, any[]> = {};

  if (listIds.length > 0) {
    const { data: movieRows } = await serviceClient
      .from("goblin_list_movies")
      .select(`
        list_id, movie_id, sort_order, note, added_at,
        movie:goblin_movies!movie_id (
          id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
          runtime_minutes, director, year, rt_critics_score, rt_audience_score,
          tmdb_vote_average, tmdb_vote_count, mpaa_rating, imdb_id, synopsis, trailer_url
        )
      `)
      .in("list_id", listIds)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("added_at", { ascending: true });

    for (const row of movieRows || []) {
      const r = row as any;
      if (!listMovies[r.list_id]) listMovies[r.list_id] = [];
      listMovies[r.list_id].push({
        movie_id: r.movie_id,
        sort_order: r.sort_order,
        note: r.note,
        added_at: r.added_at,
        movie: r.movie,
      });
    }
  }

  const groups = (lists || []).map((l: any) => ({
    ...l,
    movies: listMovies[l.id] || [],
  }));

  return NextResponse.json({ groups });
});

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const body = await request.json();
  const { name, description, movie_tmdb_ids } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  // Auto-assign sort_order
  const { data: maxRow } = await serviceClient
    .from("goblin_lists")
    .select("sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = ((maxRow as any)?.sort_order ?? 0) + 1;

  const { data: list, error: listError } = await serviceClient
    .from("goblin_lists")
    .insert({
      user_id: user.id,
      name,
      description: description?.trim() || null,
      sort_order: nextSortOrder,
    } as never)
    .select("id, name, description, sort_order, is_recommendations, created_at")
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }

  const listId = (list as { id: number }).id;

  // Seed movies from TMDB IDs if provided (cap at 100)
  if (Array.isArray(movie_tmdb_ids) && movie_tmdb_ids.length > 0) {
    if (movie_tmdb_ids.length > 100) {
      return NextResponse.json({ error: "Maximum 100 seed movies" }, { status: 400 });
    }
    const movieRows: { list_id: number; movie_id: number; sort_order: number }[] = [];

    for (let i = 0; i < movie_tmdb_ids.length; i++) {
      const movie = await ensureMovie(serviceClient, movie_tmdb_ids[i]);
      if (movie) {
        movieRows.push({
          list_id: listId,
          movie_id: movie.id,
          sort_order: i + 1,
        });
      }
    }

    if (movieRows.length > 0) {
      await serviceClient.from("goblin_list_movies").insert(movieRows as never);
    }
  }

  return NextResponse.json({ group: list }, { status: 201 });
});
