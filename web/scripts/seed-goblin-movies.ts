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

// TMDB genre ID → name mapping
const TMDB_GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
  99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
  27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
  878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
};

interface TmdbMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
}

interface MovieEnrichment {
  runtime: number | null;
  overview: string | null;
  backdrop_path: string | null;
  director: string | null;
  mpaa_rating: string | null;
  trailer_url: string | null;
  imdb_id: string | null;
  keywords: string[];
  genres: string[];
  vote_average: number | null;
  vote_count: number | null;
  popularity: number | null;
  streaming: StreamingInfo;
}

interface StreamingInfo {
  stream?: string[];
  rent?: string[];
  buy?: string[];
  ads?: string[];
  free?: string[];
  theaters?: boolean;
}

interface RTScores {
  critics: number | null;
  audience: number | null;
}

// --- TMDB helpers ---

async function fetchAllMovieData(tmdbId: number): Promise<MovieEnrichment> {
  const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits,videos,release_dates,external_ids,keywords,watch/providers`;
  const res = await fetch(url);
  const data = await res.json();

  // Director — first crew member with job "Director"
  const director: string | null =
    data.credits?.crew?.find((c: any) => c.job === "Director")?.name ?? null;

  // Trailer — first YouTube trailer
  const trailer = data.videos?.results?.find(
    (v: any) => v.site === "YouTube" && v.type === "Trailer"
  );
  const trailer_url = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;

  // MPAA rating — US certification
  const usRelease = data.release_dates?.results?.find(
    (r: any) => r.iso_3166_1 === "US"
  );
  const mpaa_rating: string | null =
    usRelease?.release_dates?.[0]?.certification || null;

  // IMDB ID
  const imdb_id: string | null = data.external_ids?.imdb_id ?? null;

  // Keywords
  const keywords: string[] =
    (data.keywords?.keywords ?? []).map((k: any) => k.name);

  // Genres (from detail endpoint — full objects, not IDs)
  const genres: string[] =
    (data.genres ?? []).map((g: any) => g.name);

  // Streaming — same parsing logic as old fetchProviders
  const us = data["watch/providers"]?.results?.US;
  const streaming: StreamingInfo = {};
  if (us) {
    const names = (arr?: any[]) => arr?.map((p: any) => p.provider_name) ?? [];
    const stream = names(us.flatrate);
    const rent = names(us.rent);
    const buy = names(us.buy);
    const ads = names(us.ads);
    const free = names(us.free);
    if (stream.length > 0) streaming.stream = stream;
    if (rent.length > 0) streaming.rent = rent;
    if (buy.length > 0) streaming.buy = buy;
    if (ads.length > 0) streaming.ads = ads;
    if (free.length > 0) streaming.free = free;
  }

  return {
    runtime: data.runtime ?? null,
    overview: data.overview || null,
    backdrop_path: data.backdrop_path ?? null,
    director,
    mpaa_rating,
    trailer_url,
    imdb_id,
    keywords,
    genres,
    vote_average: data.vote_average ?? null,
    vote_count: data.vote_count ?? null,
    popularity: data.popularity ?? null,
    streaming,
  };
}

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

function isInTheaters(
  releaseDate: string,
  info: StreamingInfo
): boolean {
  // If it's already streaming, it's probably not in theaters
  if ((info.stream?.length ?? 0) > 0) return false;
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
  const UPDATE_TMDB = process.argv.includes("--update-tmdb");
  console.log(
    UPDATE_TMDB
      ? "Backfilling TMDB enrichment data for existing movies...\n"
      : UPDATE_ONLY
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

  if (UPDATE_TMDB) {
    // Backfill genres, vote data, runtime, keywords for existing movies
    const { data: movies } = await supabase
      .from("goblin_movies")
      .select("id, tmdb_id, title")
      .not("tmdb_id", "is", null)
      .order("id");

    if (!movies) {
      console.error("Failed to fetch movies");
      return;
    }

    let updated = 0;
    for (const movie of movies) {
      const enrichment = await fetchAllMovieData(movie.tmdb_id);
      await new Promise((r) => setTimeout(r, 300));

      // Theater detection
      const { data: movieRow } = await supabase
        .from("goblin_movies")
        .select("release_date")
        .eq("id", movie.id)
        .single();

      if (movieRow?.release_date && isInTheaters(movieRow.release_date, enrichment.streaming)) {
        enrichment.streaming.theaters = true;
      }

      await supabase
        .from("goblin_movies")
        .update({
          genres: enrichment.genres,
          tmdb_vote_average: enrichment.vote_average,
          tmdb_vote_count: enrichment.vote_count,
          tmdb_popularity: enrichment.popularity,
          runtime_minutes: enrichment.runtime,
          keywords: enrichment.keywords,
          streaming_info: Object.keys(enrichment.streaming).length > 0 ? enrichment.streaming : {},
          synopsis: enrichment.overview,
          director: enrichment.director,
          mpaa_rating: enrichment.mpaa_rating,
          trailer_url: enrichment.trailer_url,
          backdrop_path: enrichment.backdrop_path,
          imdb_id: enrichment.imdb_id,
        } as never)
        .eq("id", movie.id);

      updated++;
      console.log(
        `  ${movie.title}: dir=${enrichment.director ?? "?"} | ${enrichment.mpaa_rating ?? "NR"} | trailer=${enrichment.trailer_url ? "yes" : "no"} | imdb=${enrichment.imdb_id ?? "?"}`
      );
    }
    console.log(`\nUpdated: ${updated} movies`);
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

      // Fetch all enrichment data in one call
      const enrichment = await fetchAllMovieData(movie.id);
      await new Promise((r) => setTimeout(r, 300));

      // Theater detection
      if (movie.release_date && isInTheaters(movie.release_date, enrichment.streaming)) {
        enrichment.streaming.theaters = true;
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
        streaming_info: Object.keys(enrichment.streaming).length > 0 ? enrichment.streaming : {},
        genres: enrichment.genres.length > 0 ? enrichment.genres : movie.genre_ids.map((id) => TMDB_GENRES[id]).filter(Boolean),
        tmdb_vote_average: movie.vote_average,
        tmdb_vote_count: movie.vote_count,
        tmdb_popularity: movie.popularity,
        runtime_minutes: enrichment.runtime,
        keywords: enrichment.keywords,
        synopsis: enrichment.overview,
        director: enrichment.director,
        mpaa_rating: enrichment.mpaa_rating,
        trailer_url: enrichment.trailer_url,
        backdrop_path: enrichment.backdrop_path,
        imdb_id: enrichment.imdb_id,
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
