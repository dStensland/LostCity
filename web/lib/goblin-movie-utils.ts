import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const TMDB_BASE = "https://api.themoviedb.org/3";

// Only the TMDB movie-detail fields this function actually reads. Do not
// add fields from memory — confirm each is accessed in the code below.
type TmdbMovieCredit = { job: string; name: string };
type TmdbGenre = { name: string };
type TmdbMovieDetail = {
  title: string;
  release_date: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string | null;
  genres?: TmdbGenre[];
  runtime: number | null;
  vote_average: number | null;
  vote_count: number | null;
  popularity: number | null;
  credits?: { crew?: TmdbMovieCredit[] };
};

function isTmdbMovieDetail(v: unknown): v is TmdbMovieDetail {
  return typeof v === "object" && v !== null && "title" in v;
}

/** Ensure a movie exists in goblin_movies by TMDB ID, fetching from TMDB if needed */
export async function ensureMovie(
  serviceClient: SupabaseClient<Database>,
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

    const raw: unknown = await res.json();
    if (!isTmdbMovieDetail(raw)) return null;
    const m = raw;
    const director =
      m.credits?.crew?.find((c) => c.job === "Director")?.name || null;
    const releaseYear = m.release_date
      ? parseInt(m.release_date.split("-")[0])
      : null;

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
        genres: m.genres?.map((g) => g.name) || null,
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
