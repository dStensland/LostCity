import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

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
const TMDB_BASE = "https://api.themoviedb.org/3";
const RT_BASE = "https://www.rottentomatoes.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Movies from the Reddit lists that aren't in the DB yet
const MISSING_MOVIES: { title: string; year: number }[] = [
  // 2025 releases
  { title: "Grafted", year: 2025 },
  { title: "The Gorge", year: 2025 },
  { title: "Rounding", year: 2025 },
  { title: "Dead Talents Society", year: 2025 },
  { title: "Drop", year: 2025 },
  { title: "Final Destination Bloodlines", year: 2025 },
  { title: "Hurry Up Tomorrow", year: 2025 },
  { title: "Bark", year: 2025 },
  { title: "Bleeding", year: 2025 },
  { title: "Best Wishes to All", year: 2025 },
  { title: "Alma and the Wolf", year: 2025 },
  { title: "M3GAN 2.0", year: 2025 },
  { title: "The Twin", year: 2025 },
  { title: "Woken", year: 2025 },
  { title: "The A-Frame", year: 2025 },
  { title: "The Toxic Avenger", year: 2025 },
  { title: "In Our Blood", year: 2025 },
  { title: "Horror in the High Desert 4", year: 2025 },
  { title: "The Wailing", year: 2025 },
  { title: "Dust Bunny", year: 2025 },
  { title: "Bugonia", year: 2025 },
  { title: "Predator Badlands", year: 2025 },
  { title: "Reflection in a Dead Diamond", year: 2025 },
  { title: "The Mortuary Assistant", year: 2025 },
  { title: "Psycho Killer", year: 2025 },
  { title: "Redux Redux", year: 2025 },
  { title: "The Red Book Ritual", year: 2025 },
  { title: "Forbidden Fruits", year: 2025 },
  { title: "They Will Kill You", year: 2025 },
  { title: "Touch Me", year: 2025 },
  { title: "The Mummy", year: 2025 },
  { title: "Hokum", year: 2025 },
  { title: "Obsession", year: 2025 },
  { title: "Corporate Retreat", year: 2025 },
  { title: "Passenger", year: 2025 },
  { title: "The Backrooms", year: 2025 },
  { title: "Evil Dead Burn", year: 2025 },
  { title: "Teenage Sex and Death at Camp Miasma", year: 2025 },
  { title: "Flowervale Street", year: 2025 },
  { title: "Insidious 6", year: 2025 },
  { title: "Resident Evil", year: 2025 },
  { title: "Return of the Living Dead", year: 2025 },
  { title: "Werwulf", year: 2025 },
  // 2025 TBA
  { title: "Affection", year: 2025 },
  { title: "Altar", year: 2025 },
  { title: "American Psycho", year: 2025 },
  { title: "Bjorn of the Dead", year: 2025 },
  { title: "Brides", year: 2025 },
  { title: "Buddy", year: 2025 },
  { title: "Claire", year: 2025 },
  { title: "Crossed", year: 2025 },
  { title: "Deathgasm II Goremageddon", year: 2025 },
  { title: "Desert Road", year: 2025 },
  { title: "Dragon", year: 2025 },
  { title: "Epilogue", year: 2025 },
  { title: "Eyes in the Trees", year: 2025 },
  { title: "The Face of Horror", year: 2025 },
  { title: "Geisha War", year: 2025 },
  { title: "Heresy", year: 2025 },
  { title: "Her Private Hell", year: 2025 },
  { title: "Hope", year: 2025 },
  { title: "The House of the Dead", year: 2025 },
  { title: "Hunting Matthew Nichols", year: 2025 },
  { title: "Ice Cream Man", year: 2025 },
  { title: "I Live Here Now", year: 2025 },
  { title: "In a Violent Nature 2", year: 2025 },
  { title: "Inground", year: 2025 },
  { title: "Ithaqua", year: 2025 },
  { title: "I See the Demon", year: 2025 },
  { title: "Kill Screen", year: 2025 },
  { title: "King Snake", year: 2025 },
  { title: "Kraken", year: 2025 },
  { title: "The Land of Nod", year: 2025 },
  { title: "Love Is the Monster", year: 2025 },
  { title: "The Masque of the Red Death", year: 2025 },
  { title: "May the Devil Take You 3", year: 2025 },
  { title: "Mystery of the Mothman", year: 2025 },
  { title: "Night Silence", year: 2025 },
  { title: "October", year: 2025 },
  { title: "Onslaught", year: 2025 },
  { title: "Orphans", year: 2025 },
  { title: "Over Your Dead Body", year: 2025 },
  { title: "Pendulum", year: 2025 },
  { title: "Portal to Hell", year: 2025 },
  { title: "Portrait of God", year: 2025 },
  { title: "Rapture", year: 2025 },
  { title: "River", year: 2025 },
  { title: "The Rule of Three", year: 2025 },
  { title: "Saccharine", year: 2025 },
  { title: "The Shepherd", year: 2025 },
  { title: "Soulm8te", year: 2025 },
  { title: "The Swallow", year: 2025 },
  { title: "Tinsman Road", year: 2025 },
  { title: "Victorian Psycho", year: 2025 },
  { title: "Visitation", year: 2025 },
  { title: "What Happens at Night", year: 2025 },
  { title: "Winthrop", year: 2025 },
  { title: "The Wolf Will Tear Your Immaculate Hands", year: 2025 },
  { title: "The Last Temptation of Becky", year: 2025 },
  { title: "The Wretched Devours", year: 2025 },
  { title: "The Young People", year: 2025 },
  { title: "Scary Movie 6", year: 2025 },
  { title: "Clayface", year: 2025 },
  { title: "Ebenezer A Christmas Carol", year: 2025 },
  { title: "Violent Night 2", year: 2025 },
  { title: "The Gallerist", year: 2025 },
  { title: "Mother Mary", year: 2025 },
];

interface TmdbSearchResult {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
}

async function searchTMDB(title: string, year: number): Promise<TmdbSearchResult | null> {
  // Try with year first
  const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&year=${year}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.results?.length > 0) return data.results[0];

  // Try without year
  const url2 = `${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}`;
  const res2 = await fetch(url2);
  const data2 = await res2.json();
  if (data2.results?.length > 0) {
    // Pick the one closest to our year
    type TmdbSearchResultLite = { release_date?: string | null };
    const sorted = (data2.results as TmdbSearchResultLite[]).sort((a, b) => {
      const aYear = a.release_date ? parseInt(a.release_date.slice(0, 4)) : 9999;
      const bYear = b.release_date ? parseInt(b.release_date.slice(0, 4)) : 9999;
      return Math.abs(aYear - year) - Math.abs(bYear - year);
    });
    return sorted[0];
  }

  return null;
}

function titleToRTSlugs(title: string, year: number): string[] {
  const slug = title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/ +/g, "_").trim();
  return [`${slug}_${year}`, slug];
}

async function scrapeRTScores(title: string, year: number): Promise<{ critics: number | null; audience: number | null }> {
  const slugs = titleToRTSlugs(title, year);
  for (const slug of slugs) {
    try {
      const res = await fetch(`${RT_BASE}/m/${slug}`, { headers: { "User-Agent": UA } });
      if (res.status !== 200) continue;
      const html = await res.text();
      let critics: number | null = null;
      let audience: number | null = null;
      const cm = html.match(/"criticsScore":\{[^}]*"score":"(\d+)"/);
      if (cm) critics = parseInt(cm[1]);
      const am = html.match(/"audienceScore":\{[^}]*"score":"(\d+)"/);
      if (am) audience = parseInt(am[1]);
      if (critics !== null || audience !== null) return { critics, audience };
    } catch { continue; }
  }
  return { critics: null, audience: null };
}

async function main() {
  console.log(`Adding ${MISSING_MOVIES.length} movies from Reddit lists...\n`);

  let added = 0;
  let tmdbFound = 0;
  let skipped = 0;
  let scored = 0;

  for (const movie of MISSING_MOVIES) {
    // Check if already exists (by title similarity)
    const { data: existing } = await supabase
      .from("goblin_movies")
      .select("id")
      .ilike("title", `%${movie.title.replace(/[^a-zA-Z0-9 ]/g, "%")}%`)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Search TMDB
    const tmdb = await searchTMDB(movie.title, movie.year);
    await new Promise((r) => setTimeout(r, 250));

    // Also check by tmdb_id if found
    if (tmdb) {
      const { data: existsByTmdb } = await supabase
        .from("goblin_movies")
        .select("id")
        .eq("tmdb_id", tmdb.id)
        .maybeSingle();
      if (existsByTmdb) {
        skipped++;
        continue;
      }
      tmdbFound++;
    }

    // Scrape RT scores
    const scores = await scrapeRTScores(movie.title, movie.year);
    if (scores.critics !== null || scores.audience !== null) scored++;
    await new Promise((r) => setTimeout(r, 500));

    const row = {
      tmdb_id: tmdb?.id ?? null,
      title: tmdb?.title ?? movie.title,
      release_date: tmdb?.release_date || null,
      poster_path: tmdb?.poster_path ?? null,
      rt_critics_score: scores.critics,
      rt_audience_score: scores.audience,
      streaming_info: [],
      year: movie.year,
    };

    const { error } = await supabase.from("goblin_movies").insert(row as never);
    if (error) {
      console.error(`  ✗ ${movie.title}: ${error.message}`);
    } else {
      added++;
      const scoreStr = scores.critics !== null ? ` (RT: ${scores.critics}%)` : "";
      console.log(`  ✓ ${row.title}${scoreStr}`);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone! Added: ${added}, TMDB matches: ${tmdbFound}, Skipped (dupes): ${skipped}, With RT scores: ${scored}`);
}

main().catch(console.error);
