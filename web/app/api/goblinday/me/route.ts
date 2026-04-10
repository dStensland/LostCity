import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request, { user, serviceClient }) => {
  const { data: userMovies, error: umError } = await serviceClient
    .from("goblin_user_movies")
    .select("movie_id, bookmarked, watched")
    .eq("user_id", user.id);

  if (umError) {
    return NextResponse.json({ error: "Failed to fetch user movies" }, { status: 500 });
  }

  const bookmarks = (userMovies || [])
    .filter((m: { bookmarked: boolean }) => m.bookmarked)
    .map((m: { movie_id: number }) => m.movie_id);

  const watched = (userMovies || [])
    .filter((m: { watched: boolean }) => m.watched)
    .map((m: { movie_id: number }) => m.movie_id);

  const { data: lists, error: listsError } = await serviceClient
    .from("goblin_lists")
    .select("id, name, goblin_list_movies(movie_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (listsError) {
    return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
  }

  // Fetch watchlist movie IDs
  const { data: watchlistRows } = await serviceClient
    .from("goblin_watchlist_entries")
    .select("movie_id")
    .eq("user_id", user.id);

  const watchlistMovieIds = (watchlistRows || []).map(
    (r: { movie_id: number }) => r.movie_id
  );

  return NextResponse.json({
    bookmarks,
    watched,
    watchlistMovieIds,
    lists: (lists || []).map(
      (l: { id: number; name: string; goblin_list_movies: { movie_id: number }[] }) => ({
        id: l.id,
        name: l.name,
        movie_ids: l.goblin_list_movies.map((lm) => lm.movie_id),
      })
    ),
  });
});
