import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const serviceClient = createServiceClient();
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");

  let query = serviceClient
    .from("goblin_movies")
    .select("*")
    .order("release_date", { ascending: true });

  if (year) {
    query = query.eq("year", parseInt(year));
  }

  const { data: movies, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch movies" }, { status: 500 });
  }

  // If authenticated, join user's movie state
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userMovieMap: Record<number, { bookmarked: boolean; watched: boolean }> = {};

  if (user) {
    const { data: userMovies } = await serviceClient
      .from("goblin_user_movies")
      .select("movie_id, bookmarked, watched")
      .eq("user_id", user.id);

    if (userMovies) {
      userMovieMap = Object.fromEntries(
        userMovies.map((um: { movie_id: number; bookmarked: boolean; watched: boolean }) => [
          um.movie_id,
          { bookmarked: um.bookmarked, watched: um.watched },
        ])
      );
    }
  }

  const result = (movies || []).map((m: Record<string, unknown>) => ({
    ...m,
    bookmarked: userMovieMap[m.id as number]?.bookmarked || false,
    watched: userMovieMap[m.id as number]?.watched || false,
  }));

  return NextResponse.json(result);
}
