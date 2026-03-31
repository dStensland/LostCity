/**
 * enrich-log-movies.mjs
 *
 * 1. Enriches goblin_movies missing imdb_id / trailer_url (bulk-imported rows).
 * 2. Deletes the bad log entry for "Stairway to Heaven: A Very Literal Music Video"
 *    (wrong TMDB match for the movie "Video Heaven").
 * 3. Removes the "Andor" log entry (TV show, not a movie).
 *
 * Run from /Users/coach/Projects/LostCity/web after exporting env vars:
 *   export $(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_KEY|SUPABASE_SERVICE_ROLE_KEY|TMDB_API_KEY)=' .env.local | xargs)
 *   node scripts/enrich-log-movies.mjs
 */

import { createClient } from "@supabase/supabase-js";

// --- Env ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}
if (!TMDB_KEY) {
  console.error("Missing TMDB_API_KEY");
  process.exit(1);
}

const sc = createClient(SUPABASE_URL, SUPABASE_KEY);
const TMDB_BASE = "https://api.themoviedb.org/3";

// --- Step 1: Enrich missing imdb_id / trailer_url ---

console.log("=== Step 1: Enriching movies missing imdb_id / trailer_url ===\n");

const { data: movies, error: fetchErr } = await sc
  .from("goblin_movies")
  .select("id, tmdb_id, title")
  .is("imdb_id", null)
  .not("tmdb_id", "is", null)
  .order("id");

if (fetchErr) {
  console.error("Failed to fetch movies:", fetchErr.message);
  process.exit(1);
}

console.log(`Found ${movies.length} movies missing imdb_id with a tmdb_id.\n`);

let enriched = 0;
let noImdb = 0;
let errors = 0;

for (const movie of movies) {
  process.stdout.write(`  ${movie.title} (tmdb=${movie.tmdb_id})... `);

  try {
    const url = `${TMDB_BASE}/movie/${movie.tmdb_id}?api_key=${TMDB_KEY}&append_to_response=external_ids,videos`;
    const res = await fetch(url);

    if (!res.ok) {
      console.log(`HTTP ${res.status} — skipping`);
      errors++;
      continue;
    }

    const data = await res.json();

    // imdb_id from external_ids
    const imdb_id = data.external_ids?.imdb_id || null;

    // trailer_url: first YouTube trailer
    const trailer = data.videos?.results?.find(
      (v) => v.site === "YouTube" && v.type === "Trailer"
    );
    const trailer_url = trailer
      ? `https://www.youtube.com/watch?v=${trailer.key}`
      : null;

    if (!imdb_id && !trailer_url) {
      console.log("no imdb_id or trailer found");
      noImdb++;
      continue;
    }

    const updatePayload = {};
    if (imdb_id) updatePayload.imdb_id = imdb_id;
    if (trailer_url) updatePayload.trailer_url = trailer_url;

    const { error: updateErr } = await sc
      .from("goblin_movies")
      .update(updatePayload)
      .eq("id", movie.id);

    if (updateErr) {
      console.log(`UPDATE ERROR: ${updateErr.message}`);
      errors++;
    } else {
      const parts = [];
      if (imdb_id) parts.push(`imdb=${imdb_id}`);
      if (trailer_url) parts.push("trailer=yes");
      console.log(parts.join(", "));
      enriched++;
    }
  } catch (err) {
    console.log(`EXCEPTION: ${err.message}`);
    errors++;
  }

  // Be polite to TMDB
  await new Promise((r) => setTimeout(r, 250));
}

console.log(
  `\nEnrichment done: ${enriched} updated, ${noImdb} had no data, ${errors} errors.\n`
);

// --- Step 2: Delete bad log entry for "Stairway to Heaven: A Very Literal Music Video" ---

console.log('=== Step 2: Removing bad log entry for "Stairway to Heaven..." ===\n');

// Find the movie by title
const { data: badMovie, error: badMovieErr } = await sc
  .from("goblin_movies")
  .select("id, title, tmdb_id")
  .ilike("title", "%stairway to heaven%")
  .maybeSingle();

if (badMovieErr) {
  console.error("Error searching for Stairway to Heaven movie:", badMovieErr.message);
} else if (!badMovie) {
  console.log('No movie found matching "Stairway to Heaven" — already cleaned up or never existed.\n');
} else {
  console.log(
    `Found movie: "${badMovie.title}" (id=${badMovie.id}, tmdb_id=${badMovie.tmdb_id})`
  );

  // Delete all log entries for this movie
  const { data: deletedEntries, error: deleteEntryErr } = await sc
    .from("goblin_log_entries")
    .delete()
    .eq("movie_id", badMovie.id)
    .select("id");

  if (deleteEntryErr) {
    console.error("Error deleting log entries:", deleteEntryErr.message);
  } else {
    console.log(
      `Deleted ${deletedEntries?.length ?? 0} log entry/entries for "${badMovie.title}".`
    );
  }

  // Also delete the movie row itself (it's a wrong match, not a real movie we want)
  const { error: deleteMovieErr } = await sc
    .from("goblin_movies")
    .delete()
    .eq("id", badMovie.id);

  if (deleteMovieErr) {
    console.error(
      `Error deleting goblin_movies row for "${badMovie.title}": ${deleteMovieErr.message}`
    );
  } else {
    console.log(`Deleted goblin_movies row for "${badMovie.title}".`);
  }
  console.log();
}

// --- Step 3: Remove "Andor" log entry (TV show) ---

console.log('=== Step 3: Removing "Andor" log entry (TV show, not a movie) ===\n');

const { data: andorMovies, error: andorErr } = await sc
  .from("goblin_movies")
  .select("id, title, tmdb_id")
  .ilike("title", "andor");

if (andorErr) {
  console.error("Error searching for Andor:", andorErr.message);
} else if (!andorMovies || andorMovies.length === 0) {
  console.log('No movie found matching "Andor" — already removed or never inserted.\n');
} else {
  for (const andorMovie of andorMovies) {
    console.log(
      `Found movie: "${andorMovie.title}" (id=${andorMovie.id}, tmdb_id=${andorMovie.tmdb_id})`
    );

    // Delete log entries for this movie
    const { data: deletedAndorEntries, error: deleteAndorEntryErr } = await sc
      .from("goblin_log_entries")
      .delete()
      .eq("movie_id", andorMovie.id)
      .select("id");

    if (deleteAndorEntryErr) {
      console.error(
        "Error deleting Andor log entries:",
        deleteAndorEntryErr.message
      );
    } else {
      console.log(
        `Deleted ${deletedAndorEntries?.length ?? 0} log entry/entries for "${andorMovie.title}".`
      );
    }

    // Delete the movie row (it's a TV show that snuck into goblin_movies)
    const { error: deleteAndorMovieErr } = await sc
      .from("goblin_movies")
      .delete()
      .eq("id", andorMovie.id);

    if (deleteAndorMovieErr) {
      console.error(
        `Error deleting goblin_movies row for "${andorMovie.title}": ${deleteAndorMovieErr.message}`
      );
    } else {
      console.log(`Deleted goblin_movies row for "${andorMovie.title}".`);
    }
    console.log();
  }
}

console.log("=== All done ===");
