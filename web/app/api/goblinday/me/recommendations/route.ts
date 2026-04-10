import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request: NextRequest, { user, serviceClient }) => {
  const { data: recs, error } = await serviceClient
    .from("goblin_watchlist_recommendations")
    .select(`
      id, recommender_name, recommender_user_id, note, status, created_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, release_date, genres,
        runtime_minutes, director, year
      )
    `)
    .eq("target_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }

  return NextResponse.json({ recommendations: recs || [] });
});
