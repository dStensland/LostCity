import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize } from "@/lib/api-utils";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const bodySizeResult = checkBodySize(request);
  if (bodySizeResult) return bodySizeResult;

  const { slug } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Input validation
  const { tmdb_id, note } = body;
  let { recommender_name } = body;

  if (!tmdb_id || typeof tmdb_id !== "number" || !Number.isInteger(tmdb_id) || tmdb_id <= 0) {
    return NextResponse.json({ error: "tmdb_id must be a positive integer" }, { status: 400 });
  }

  if (recommender_name !== undefined && recommender_name !== null) {
    recommender_name = String(recommender_name).trim();
    if (recommender_name.length < 1 || recommender_name.length > 50) {
      return NextResponse.json({ error: "recommender_name must be 1-50 characters" }, { status: 400 });
    }
  }

  if (note !== undefined && note !== null) {
    if (typeof note !== "string" || note.length > 500) {
      return NextResponse.json({ error: "note must be a string of max 500 characters" }, { status: 400 });
    }
  }

  const serviceClient = createServiceClient();

  // Resolve target user from profiles.username = slug
  const { data: targetProfile } = await serviceClient
    .from("profiles")
    .select("id, display_name")
    .eq("username", slug)
    .maybeSingle();

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const targetUserId = (targetProfile as { id: string; display_name: string | null }).id;

  // Optional auth: try to get the current user
  let recommenderUserId: string | null = null;
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (user) {
      recommenderUserId = user.id;
      // Override recommender_name with profile display_name if authenticated
      const { data: recommenderProfile } = await serviceClient
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const profile = recommenderProfile as { display_name: string | null } | null;
      recommender_name = profile?.display_name || recommender_name || null;
    }
  } catch {
    // Auth errors are fine — treat as anonymous
  }

  // Require recommender_name for anonymous recommendations
  if (!recommenderUserId && (!recommender_name || recommender_name.length < 1)) {
    return NextResponse.json({ error: "recommender_name is required for anonymous recommendations" }, { status: 400 });
  }

  // Ensure movie exists in goblin_movies
  const movie = await ensureMovie(serviceClient, tmdb_id);
  if (!movie) {
    return NextResponse.json({ error: "Failed to find or create movie" }, { status: 500 });
  }

  // Duplicate check
  if (recommenderUserId) {
    // Authenticated: check by (target_user_id, movie_id, recommender_user_id)
    const { data: existing } = await serviceClient
      .from("goblin_watchlist_recommendations")
      .select("id")
      .eq("target_user_id", targetUserId)
      .eq("movie_id", movie.id)
      .eq("recommender_user_id", recommenderUserId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "You have already recommended this movie" }, { status: 409 });
    }
  } else {
    // Anonymous: check by (target_user_id, movie_id, recommender_name) where recommender_user_id IS NULL
    const { data: existing } = await serviceClient
      .from("goblin_watchlist_recommendations")
      .select("id")
      .eq("target_user_id", targetUserId)
      .eq("movie_id", movie.id)
      .eq("recommender_name", recommender_name)
      .is("recommender_user_id", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "A recommendation from this name already exists for this movie" }, { status: 409 });
    }
  }

  // Insert recommendation
  const { data: recommendation, error: insertError } = await serviceClient
    .from("goblin_watchlist_recommendations")
    .insert({
      target_user_id: targetUserId,
      movie_id: movie.id,
      recommender_user_id: recommenderUserId,
      recommender_name: recommender_name || "Anonymous",
      note: note?.trim() || null,
    } as never)
    .select("id, movie_id, recommender_name, recommender_user_id, note, created_at")
    .single();

  if (insertError || !recommendation) {
    if (insertError?.code === "23505") {
      return NextResponse.json({ error: "Duplicate recommendation" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create recommendation" }, { status: 500 });
  }

  return NextResponse.json({ recommendation }, { status: 201 });
}
