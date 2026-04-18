import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface GroupRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

interface GroupMovieRow {
  id: number;
  sort_order: number | null;
  note: string | null;
  added_at: string;
  movie: GroupMovieDetailRow | null;
}

interface GroupMovieDetailRow {
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

interface RecommendationRow {
  id: number;
  recommender_name: string;
  note: string | null;
  created_at: string;
  movie: RecommendationMovieRow | null;
}

interface RecommendationMovieRow {
  id: number;
  tmdb_id: number | null;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  year: number | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; groupSlug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug, groupSlug } = await params;
  const serviceClient = createServiceClient();

  // Resolve user by username
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", slug)
    .maybeSingle<ProfileRow>();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Resolve group list by slug + user (non-recommendations list only)
  const { data: group } = await serviceClient
    .from("goblin_lists")
    .select("id, slug, name, description")
    .eq("user_id", profile.id)
    .eq("slug", groupSlug)
    .eq("is_recommendations", false)
    .maybeSingle<GroupRow>();

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  // Fetch movies in the group
  const { data: movieRows, error: moviesError } = await serviceClient
    .from("goblin_list_movies")
    .select(`
      id, sort_order, note, added_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
        runtime_minutes, director, year, rt_critics_score, rt_audience_score,
        tmdb_vote_average, tmdb_vote_count, mpaa_rating, imdb_id, synopsis, trailer_url
      )
    `)
    .eq("list_id", group.id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: true })
    .returns<GroupMovieRow[]>();

  if (moviesError) {
    return NextResponse.json({ error: "Failed to fetch group movies" }, { status: 500 });
  }

  // Fetch pending recommendations scoped to this group
  const { data: recRows, error: recsError } = await serviceClient
    .from("goblin_watchlist_recommendations")
    .select(`
      id, recommender_name, note, created_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, release_date, year
      )
    `)
    .eq("target_user_id", profile.id)
    .eq("list_id", group.id)
    .eq("status", "pending")
    .returns<RecommendationRow[]>();

  if (recsError) {
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }

  const movies = (movieRows || [])
    .filter((r) => r.movie !== null)
    .map((r) => ({
      movie_id: (r.movie as GroupMovieDetailRow).id,
      sort_order: r.sort_order,
      note: r.note,
      added_at: r.added_at,
      movie: r.movie as GroupMovieDetailRow,
    }));

  const recommendations = (recRows || [])
    .filter((r) => r.movie !== null)
    .map((r) => ({
      id: r.id,
      recommender_name: r.recommender_name,
      note: r.note,
      created_at: r.created_at,
      movie: r.movie as RecommendationMovieRow,
    }));

  return NextResponse.json({
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    },
    group: {
      slug: group.slug,
      name: group.name,
      description: group.description,
    },
    movies,
    recommendations,
  });
}
