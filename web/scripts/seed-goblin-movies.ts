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
const RT_BASE = "https://www.rottentomatoes.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
    };
  };
}

interface RTScores {
  critics: number | null;
  audience: number | null;
}

// --- TMDB helpers ---

async function fetchHorrorMovies(year: number): Promise<TmdbMovie[]> {
  const movies: TmdbMovie[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&with_genres=27&primary_release_year=${year}&region=${US_REGION}&vote_count.gte=10&sort_by=primary_release_date.asc&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    totalPages = data.total_pages;
    movies.push(...data.results);
    page++;
    await new Promise((r) => setTimeout(r, 250));
  }

  return movies;
}

async function fetchProviders(tmdbId: number): Promise<string[]> {
  const url = `${TMDB_BASE}/movie/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  const data: TmdbWatchProviders = await res.json();
  const us = data.results?.US;
  if (!us) return [];
  return us.flatrate?.map((p) => p.provider_name) ?? [];
}

function isInTheaters(
  releaseDate: string,
  streamingProviders: string[]
): boolean {
  if (streamingProviders.length > 0) return false;
  const release = new Date(releaseDate);
  const now = new Date();
  const days = (now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 90;
}

// --- Rotten Tomatoes scraper ---

function titleToRTSlugs(title: string, year: number): string[] {
  // RT slug: lowercase, strip non-alphanumeric (except spaces), underscores for spaces
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/ +/g, "_")
    .trim();
  // Try with year first, then without
  return [`${slug}_${year}`, slug];
}

async function scrapeRTScores(
  title: string,
  year: number
): Promise<RTScores> {
  const slugs = titleToRTSlugs(title, year);

  for (const slug of slugs) {
    try {
      const res = await fetch(`${RT_BASE}/m/${slug}`, {
        headers: { "User-Agent": UA },
      });

      if (res.status !== 200) continue;

      const html = await res.text();

      // Scores are in a JSON blob: "audienceScore":{"score":"96"...},"criticsScore":{"score":"97"...}
      let critics: number | null = null;
      let audience: number | null = null;

      const criticsMatch = html.match(
        /"criticsScore":\{[^}]*"score":"(\d+)"/
      );
      if (criticsMatch) {
        critics = parseInt(criticsMatch[1]);
      }

      const audienceMatch = html.match(
        /"audienceScore":\{[^}]*"score":"(\d+)"/
      );
      if (audienceMatch) {
        audience = parseInt(audienceMatch[1]);
      }

      // If we got at least one score, this was the right page
      if (critics !== null || audience !== null) {
        return { critics, audience };
      }
    } catch {
      // Network error, try next slug
      continue;
    }
  }

  return { critics: null, audience: null };
}

// --- Main seed ---

async function seed() {
  const UPDATE_ONLY = process.argv.includes("--update-scores");
  console.log(
    UPDATE_ONLY
      ? "Updating RT scores for existing movies...\n"
      : "Seeding Goblin Day movies...\n"
  );

  if (UPDATE_ONLY) {
    // Just update scores for movies that don't have them
    const { data: movies } = await supabase
      .from("goblin_movies")
      .select("id, title, year, rt_critics_score, rt_audience_score")
      .order("id");

    if (!movies) {
      console.error("Failed to fetch movies");
      return;
    }

    let updated = 0;
    let noScore = 0;
    for (const movie of movies) {
      // Skip if already has both scores
      if (
        movie.rt_critics_score !== null &&
        movie.rt_audience_score !== null
      ) {
        continue;
      }

      const scores = await scrapeRTScores(movie.title, movie.year);
      await new Promise((r) => setTimeout(r, 500)); // Be polite to RT

      if (scores.critics !== null || scores.audience !== null) {
        await supabase
          .from("goblin_movies")
          .update({
            rt_critics_score: scores.critics,
            rt_audience_score: scores.audience,
          } as never)
          .eq("id", movie.id);
        updated++;
        console.log(
          `  ✓ ${movie.title}: critics=${scores.critics ?? "N/A"}, audience=${scores.audience ?? "N/A"}`
        );
      } else {
        noScore++;
      }
    }
    console.log(`\nUpdated: ${updated}, No RT scores found: ${noScore}`);
    return;
  }

  // Full seed: fetch from TMDB + scrape RT
  for (const year of [2025, 2026]) {
    console.log(`--- ${year} ---`);
    const movies = await fetchHorrorMovies(year);
    console.log(`Found ${movies.length} horror movies from TMDB\n`);

    let inserted = 0;
    let skipped = 0;
    let scored = 0;

    for (const movie of movies) {
      if (!movie.title || movie.title.length < 2) continue;

      // Check if exists
      const { data: existing } = await supabase
        .from("goblin_movies")
        .select("id")
        .eq("tmdb_id", movie.id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Fetch streaming info
      const streamingProviders = await fetchProviders(movie.id);
      const streamingInfo: string[] = [...streamingProviders];
      if (
        movie.release_date &&
        isInTheaters(movie.release_date, streamingProviders)
      ) {
        streamingInfo.unshift("theaters");
      }

      // Scrape RT scores
      const scores = await scrapeRTScores(movie.title, year);
      if (scores.critics !== null || scores.audience !== null) scored++;
      await new Promise((r) => setTimeout(r, 500)); // Rate limit RT

      const row = {
        tmdb_id: movie.id,
        title: movie.title,
        release_date: movie.release_date || null,
        poster_path: movie.poster_path,
        rt_critics_score: scores.critics,
        rt_audience_score: scores.audience,
        streaming_info: streamingInfo.length > 0 ? streamingInfo : [],
        year,
      };

      const { error } = await supabase
        .from("goblin_movies")
        .insert(row as never);

      if (error) {
        console.error(`  Error inserting "${movie.title}":`, error.message);
      } else {
        inserted++;
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(
      `  Inserted: ${inserted}, Skipped: ${skipped}, With RT scores: ${scored}\n`
    );
  }

  console.log("Done!");
}

seed().catch(console.error);
