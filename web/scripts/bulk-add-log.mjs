import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_KEY = process.env.TMDB_API_KEY;
const USER_EMAIL = 'daniel.stensland@gmail.com';

const sc = createClient(SUPABASE_URL, SUPABASE_KEY);

const MOVIES = [
  "The Handmaiden",
  "Picnic at Hanging Rock",
  "Bone Tomahawk",
  "Sorcerer",
  "Best in Show",
  "Lady Vengeance",
  "The Wind That Shakes the Barley",
  "Hamnet",
  "Eddington",
  "Joint Security Area",
  "Send Help",
  "Andor",
  "A Knight of the Seven Kingdoms",
  "Sympathy for Mr. Vengeance",
  "Memories of Murder",
  "Bone Tomahawk",
  "Challengers",
  "Decision to Leave",
  "Thirst",
  "Mank",
  "Triangle of Sadness",
  "Waiting for Guffman",
  "The Cars That Ate Paris",
  "Wake Up Dead Man: A Knives Out Mystery",
  "52 Pick-Up",
  "Vampire's Kiss",
  "Mickey 17",
  "The Last Wave",
  "Caught Stealing",
  "Oldboy",
  "Stoker",
  "Kiss the Girls",
  "Mascots",
  "Waking Ned Devine",
  "Video Heaven",
  "Fly Me to the Moon",
  "Tron: Ares",
  "A Walk to Remember",
];

async function findUser() {
  const { data } = await sc.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find(u => u.email === USER_EMAIL);
  if (!user) throw new Error(`User ${USER_EMAIL} not found`);
  return user.id;
}

async function searchTMDB(title) {
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&include_adult=false&language=en-US&page=1`;
  const res = await fetch(url);
  const data = await res.json();

  // Also search TV if no movie results (for Andor, Dunc & Egg)
  if (!data.results?.length) {
    const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=en-US&page=1`;
    const tvRes = await fetch(tvUrl);
    const tvData = await tvRes.json();
    if (tvData.results?.length) {
      const tv = tvData.results[0];
      return { tmdb_id: tv.id, title: tv.name, is_tv: true };
    }
  }

  if (!data.results?.length) return null;
  return { tmdb_id: data.results[0].id, title: data.results[0].title, is_tv: false };
}

async function ensureMovie(tmdbId) {
  // Check existing
  const { data: existing } = await sc.from('goblin_movies').select('id').eq('tmdb_id', tmdbId).maybeSingle();
  if (existing) return existing.id;

  // Fetch from TMDB
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const m = await res.json();

  const director = m.credits?.crew?.find(c => c.job === 'Director')?.name || null;
  const releaseYear = m.release_date ? parseInt(m.release_date.split('-')[0]) : null;

  const { data: inserted, error } = await sc.from('goblin_movies').insert({
    tmdb_id: tmdbId,
    title: m.title,
    release_date: m.release_date || null,
    poster_path: m.poster_path || null,
    backdrop_path: m.backdrop_path || null,
    year: releaseYear,
    synopsis: m.overview || null,
    genres: m.genres?.map(g => g.name) || null,
    runtime_minutes: m.runtime || null,
    director,
    tmdb_vote_average: m.vote_average || null,
    tmdb_vote_count: m.vote_count || null,
    tmdb_popularity: m.popularity || null,
  }).select('id').single();

  if (error) { console.error('  Insert error:', error.message); return null; }
  return inserted.id;
}

async function main() {
  const userId = await findUser();
  console.log(`User: ${userId}\n`);

  // Dedupe the list
  const seen = new Set();
  const uniqueMovies = MOVIES.filter(m => {
    const key = m.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const title of uniqueMovies) {
    process.stdout.write(`${title}... `);

    const result = await searchTMDB(title);
    if (!result) {
      console.log('NOT FOUND on TMDB');
      failed++;
      continue;
    }

    if (result.is_tv) {
      console.log(`TV SHOW: "${result.title}" (skipping — movie log only)`);
      skipped++;
      continue;
    }

    const movieId = await ensureMovie(result.tmdb_id);
    if (!movieId) {
      console.log('FAILED to insert movie');
      failed++;
      continue;
    }

    // Check if already logged
    const { data: existingEntry } = await sc.from('goblin_log_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('movie_id', movieId)
      .maybeSingle();

    if (existingEntry) {
      console.log(`ALREADY LOGGED (${result.title})`);
      skipped++;
      continue;
    }

    // Create log entry with today's date, sort_order = position in list
    const { error } = await sc.from('goblin_log_entries').insert({
      user_id: userId,
      movie_id: movieId,
      watched_date: new Date().toISOString().split('T')[0],
      sort_order: added + 1,
    });

    if (error) {
      console.log(`ERROR: ${error.message}`);
      failed++;
    } else {
      console.log(`✓ "${result.title}" (#${added + 1})`);
      added++;
    }
  }

  console.log(`\nDone: ${added} added, ${skipped} skipped, ${failed} failed`);
}

main().catch(console.error);
