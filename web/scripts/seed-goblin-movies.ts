import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// --- Env loading (same pattern as other seed scripts) ---
function loadEnv(envPath: string): Record<string, string> {
  const contents = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return env;
}

const envPath = path.resolve(__dirname, "../.env.local");
const env = loadEnv(envPath);

const supabase = createClient(
  env["NEXT_PUBLIC_SUPABASE_URL"],
  env["SUPABASE_SERVICE_KEY"]
);

const TMDB_KEY = env["TMDB_API_KEY"];
if (!TMDB_KEY) {
  console.error("Missing TMDB_API_KEY in .env.local");
  process.exit(1);
}

const TMDB_BASE = "https://api.themoviedb.org/3";
const US_REGION = "US";

interface TmdbMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
}

interface TmdbProvider {
  provider_name: string;
}

interface TmdbWatchProviders {
  results?: {
    US?: {
      flatrate?: TmdbProvider[];
      rent?: TmdbProvider[];
      buy?: TmdbProvider[];
    };
  };
}

// Fetch all pages of horror movies for a given year
async function fetchHorrorMovies(year: number): Promise<TmdbMovie[]> {
  const movies: TmdbMovie[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&with_genres=27&primary_release_year=${year}&region=${US_REGION}&sort_by=primary_release_date.asc&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    totalPages = Math.min(data.total_pages, 20); // Cap at 20 pages
    movies.push(...data.results);
    page++;
    // Be nice to TMDB
    await new Promise((r) => setTimeout(r, 250));
  }

  return movies;
}

// Fetch streaming providers for a movie
async function fetchProviders(tmdbId: number): Promise<string[]> {
  const url = `${TMDB_BASE}/movie/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  const data: TmdbWatchProviders = await res.json();
  const us = data.results?.US;
  if (!us) return [];

  const providers: string[] = [];
  if (us.flatrate) {
    providers.push(...us.flatrate.map((p) => p.provider_name));
  }
  return providers;
}

// Check if movie is currently in theaters (released within last 90 days, no streaming)
function isInTheaters(releaseDate: string, streamingProviders: string[]): boolean {
  if (streamingProviders.length > 0) return false;
  const release = new Date(releaseDate);
  const now = new Date();
  const daysSinceRelease = (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceRelease >= 0 && daysSinceRelease <= 90;
}

async function seed() {
  console.log("Seeding Goblin Day movies...\n");

  for (const year of [2025, 2026]) {
    console.log(`--- ${year} ---`);
    const movies = await fetchHorrorMovies(year);
    console.log(`Found ${movies.length} horror movies from TMDB\n`);

    let inserted = 0;
    let skipped = 0;

    for (const movie of movies) {
      // Skip movies with no title or very short titles (likely data noise)
      if (!movie.title || movie.title.length < 2) continue;

      // Fetch streaming info
      const streamingProviders = await fetchProviders(movie.id);
      const streamingInfo: string[] = [...streamingProviders];

      if (movie.release_date && isInTheaters(movie.release_date, streamingProviders)) {
        streamingInfo.unshift("theaters");
      }

      const row = {
        tmdb_id: movie.id,
        title: movie.title,
        release_date: movie.release_date || null,
        poster_path: movie.poster_path,
        streaming_info: streamingInfo.length > 0 ? streamingInfo : [],
        year,
      };

      // Check if exists (partial unique index doesn't support upsert)
      const { data: existing } = await supabase
        .from("goblin_movies")
        .select("id")
        .eq("tmdb_id", movie.id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from("goblin_movies")
        .insert(row as never);

      if (error) {
        console.error(`  Error inserting "${movie.title}":`, error.message);
      } else {
        inserted++;
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`  Inserted: ${inserted}, Skipped (duplicates): ${skipped}\n`);
  }

  console.log("Done!");
}

seed().catch(console.error);
