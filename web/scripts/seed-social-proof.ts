/**
 * seed-social-proof.ts
 *
 * Populates LostCity with realistic social activity data using existing test users.
 * Run from the web/ directory: npx tsx scripts/seed-social-proof.ts [--clean]
 *
 * --clean: wipe event_rsvps, hangs, saved_items before re-seeding
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Step 0: Load env + create Supabase client
// ---------------------------------------------------------------------------

function loadEnv(envPath: string): Record<string, string> {
  const contents = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    env[key] = val;
  }
  return env;
}

const envPath = path.resolve(__dirname, "../.env.local");
const env = loadEnv(envPath);

const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceKey = env["SUPABASE_SERVICE_KEY"];

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const CLEAN = process.argv.includes("--clean");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function batchInsert<T extends object>(
  table: string,
  rows: T[],
  onConflict?: string,
  batchSize = 80,
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    let query = supabase.from(table).insert(batch as never);
    if (onConflict) {
      query = supabase.from(table).upsert(batch as never, { onConflict, ignoreDuplicates: true });
    }
    const { error } = await query;
    if (error) {
      console.warn(`  [warn] batch insert into ${table} (rows ${i}-${i + batch.length}): ${error.message}`);
    } else {
      inserted += batch.length;
    }
    await sleep(50);
  }
  return inserted;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 3_600_000);
}

function hoursFromNow(n: number): Date {
  return new Date(Date.now() + n * 3_600_000);
}

function randomPastTimestamp(maxDaysAgo = 30): Date {
  const daysBack = randomBetween(0, maxDaysAgo);
  const hoursBack = randomBetween(0, 23);
  return new Date(Date.now() - daysBack * 86_400_000 - hoursBack * 3_600_000);
}

// ---------------------------------------------------------------------------
// User persona data
// ---------------------------------------------------------------------------

const USERNAMES = [
  "coach", "johntheo", "danispears97", "kaitiecho", "sarahstover915",
  "coach6437", "connordillon05", "gpburdell", "sleve", "bobsondug",
  "miketruk", "toddb", "karld", "onsons", "willied",
  "dwigt", "reymcs", "raulc", "kevnog", "anatolism",
];

interface UserPersona {
  username: string;
  bio: string;
  privacy_mode: "low_key" | "social" | "open_book";
  categories: string[];
  rsvp_target: number; // how many RSVPs to give this user
}

const PERSONAS: Record<string, UserPersona> = {
  coach: {
    username: "coach",
    bio: "Atlanta local. Music, food, and whatever's happening tonight.",
    privacy_mode: "open_book",
    categories: ["music", "food_drink", "nightlife", "art", "comedy"],
    rsvp_target: 35,
  },
  johntheo: {
    username: "johntheo",
    bio: "Live music junkie. If there's a show, I'm there.",
    privacy_mode: "open_book",
    categories: ["music", "nightlife", "comedy", "art"],
    rsvp_target: 45,
  },
  danispears97: {
    username: "danispears97",
    bio: "Art openings, gallery hops, and the occasional festival meltdown.",
    privacy_mode: "open_book",
    categories: ["art", "music", "food_drink", "film"],
    rsvp_target: 42,
  },
  kaitiecho: {
    username: "kaitiecho",
    bio: "Event photographer and perpetual RSVP-er.",
    privacy_mode: "social",
    categories: ["art", "music", "food_drink", "community"],
    rsvp_target: 28,
  },
  sarahstover915: {
    username: "sarahstover915",
    bio: "Midtown neighbor. Brunch, yoga, and whatever's free.",
    privacy_mode: "open_book",
    categories: ["food_drink", "fitness", "art", "community"],
    rsvp_target: 22,
  },
  coach6437: {
    username: "coach6437",
    bio: "Bourbon and live music. Not necessarily in that order.",
    privacy_mode: "social",
    categories: ["music", "food_drink", "nightlife", "sports"],
    rsvp_target: 25,
  },
  connordillon05: {
    username: "connordillon05",
    bio: "EAV regular. Comedy shows, dive bars, trivia nights.",
    privacy_mode: "open_book",
    categories: ["comedy", "nightlife", "music", "food_drink"],
    rsvp_target: 30,
  },
  gpburdell: {
    username: "gpburdell",
    bio: "Tech grad. Catching Braves games and the occasional bar crawl.",
    privacy_mode: "open_book",
    categories: ["sports", "nightlife", "food_drink", "comedy"],
    rsvp_target: 40,
  },
  sleve: {
    username: "sleve",
    bio: "Nightlife is my second job. Music seven nights a week.",
    privacy_mode: "open_book",
    categories: ["music", "nightlife", "comedy", "art"],
    rsvp_target: 48,
  },
  bobsondug: {
    username: "bobsondug",
    bio: "Outdoors, sports, and cold beer after both.",
    privacy_mode: "social",
    categories: ["sports", "outdoors", "food_drink", "fitness"],
    rsvp_target: 25,
  },
  miketruk: {
    username: "miketruk",
    bio: "Film buff and food hall explorer.",
    privacy_mode: "open_book",
    categories: ["film", "food_drink", "art", "music"],
    rsvp_target: 22,
  },
  toddb: {
    username: "toddb",
    bio: "Trivia host turned trivia obsessive.",
    privacy_mode: "social",
    categories: ["comedy", "nightlife", "food_drink"],
    rsvp_target: 15,
  },
  karld: {
    username: "karld",
    bio: "Somewhere between a festival and a food truck.",
    privacy_mode: "open_book",
    categories: ["music", "food_drink", "community"],
    rsvp_target: 14,
  },
  onsons: {
    username: "onsons",
    bio: "Atlanta since forever. Still discovering new spots.",
    privacy_mode: "open_book",
    categories: ["food_drink", "community", "nightlife"],
    rsvp_target: 12,
  },
  willied: {
    username: "willied",
    bio: "Comedy, karaoke, and the kind of nights you regret forgetting.",
    privacy_mode: "open_book",
    categories: ["comedy", "nightlife", "music"],
    rsvp_target: 13,
  },
  dwigt: {
    username: "dwigt",
    bio: "Fitness by day, concerts by night.",
    privacy_mode: "low_key",
    categories: ["fitness", "music", "outdoors"],
    rsvp_target: 10,
  },
  reymcs: {
    username: "reymcs",
    bio: "Old Fourth Ward. Art, food, and the Beltline.",
    privacy_mode: "open_book",
    categories: ["art", "food_drink", "community", "music"],
    rsvp_target: 12,
  },
  raulc: {
    username: "raulc",
    bio: "Sports fan with a side of craft beer.",
    privacy_mode: "social",
    categories: ["sports", "food_drink", "nightlife"],
    rsvp_target: 11,
  },
  kevnog: {
    username: "kevnog",
    bio: "New to Atlanta, learning the city one event at a time.",
    privacy_mode: "open_book",
    categories: ["music", "comedy", "food_drink"],
    rsvp_target: 10,
  },
  anatolism: {
    username: "anatolism",
    bio: "International transplant. Soaking in every bit of Atlanta culture.",
    privacy_mode: "open_book",
    categories: ["art", "music", "film", "food_drink"],
    rsvp_target: 13,
  },
};

// Core friend group — everyone here is friends with coach + each other
const CORE_GROUP = ["coach", "johntheo", "danispears97", "kaitiecho", "sleve", "gpburdell", "connordillon05", "bobsondug"];

// Additional coach friends (not necessarily core group members with each other)
const COACH_FRIENDS = [...CORE_GROUP, "sarahstover915", "coach6437"];

// Hang notes pool
const HANG_NOTES = [
  "post-work drinks",
  "date night vibes",
  "catching the show",
  "brunch crew",
  "working from here",
  "happy hour",
  "just passing through",
  "game day",
  "live music tonight",
  "friday hangs",
  "pre-show drinks",
  "celebrating tonight",
  "catching up",
  "after the concert",
  null,
  null,
  null,
  null,
  null, // ~35% null
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("LostCity social proof seeder");
  console.log(`Target: ${supabaseUrl}`);
  console.log(CLEAN ? "Mode: --clean (wiping social data first)\n" : "Mode: upsert\n");

  // ------------------------------------------------------------------
  // Clean mode
  // ------------------------------------------------------------------
  if (CLEAN) {
    process.stdout.write("Cleaning social data...");
    // Delete placeholder RSVPs and all hangs/saved_items
    const { error: e1 } = await supabase.from("event_rsvps").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: e2 } = await supabase.from("hangs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    // Don't wipe saved_items — preserve the 96 existing ones
    if (e1) console.warn(" rsvps:", e1.message);
    if (e2) console.warn(" hangs:", e2.message);
    console.log(" done");
  }

  // ------------------------------------------------------------------
  // Fetch user IDs
  // ------------------------------------------------------------------
  process.stdout.write("Fetching user profiles...");
  const { data: profileRows, error: profileErr } = await supabase
    .from("profiles")
    .select("id, username")
    .in("username", USERNAMES);

  if (profileErr || !profileRows?.length) {
    console.error("\nFailed to fetch profiles:", profileErr?.message);
    process.exit(1);
  }

  const userMap: Record<string, string> = {};
  for (const p of profileRows) {
    userMap[p.username] = p.id;
  }

  const foundUsernames = Object.keys(userMap);
  console.log(` done (${foundUsernames.length} profiles found)`);

  const missingUsernames = USERNAMES.filter((u) => !userMap[u]);
  if (missingUsernames.length > 0) {
    console.warn(`  [warn] Missing profiles for: ${missingUsernames.join(", ")}`);
  }

  // Convenience: only work with users we found
  const activeUsernames = foundUsernames;

  // ------------------------------------------------------------------
  // Step 1: Profile enrichment
  // ------------------------------------------------------------------
  process.stdout.write("Enriching profiles...");
  const profileUpdates = activeUsernames.map((username) => {
    const persona = PERSONAS[username];
    if (!persona) return null;
    return {
      id: userMap[username],
      bio: persona.bio,
      privacy_mode: persona.privacy_mode,
    };
  }).filter(Boolean);

  let profileUpdateCount = 0;
  for (const update of profileUpdates) {
    if (!update) continue;
    const { error } = await supabase
      .from("profiles")
      .update({ bio: update.bio, privacy_mode: update.privacy_mode } as never)
      .eq("id", update.id);
    if (!error) profileUpdateCount++;
    await sleep(20);
  }
  console.log(` done (${profileUpdateCount} updated)`);

  // Upsert user_preferences
  process.stdout.write("Upserting user preferences...");
  const prefRows = activeUsernames.map((username) => {
    const persona = PERSONAS[username];
    if (!persona) return null;
    return {
      user_id: userMap[username],
      favorite_categories: persona.categories,
    };
  }).filter(Boolean);

  const prefInserted = await batchInsert("user_preferences", prefRows as object[], "user_id");
  console.log(` done (${prefInserted} upserted)`);

  // ------------------------------------------------------------------
  // Step 2: Friend graph — ensure coach + core group are mutual friends
  // ------------------------------------------------------------------
  process.stdout.write("Ensuring friend graph...");

  // Build the set of follow pairs we want to ensure
  const wantedFollowPairs: Array<[string, string]> = [];

  // Coach ↔ each COACH_FRIENDS member (mutual)
  for (const friend of COACH_FRIENDS) {
    if (friend === "coach" || !userMap[friend] || !userMap["coach"]) continue;
    wantedFollowPairs.push(["coach", friend]);
    wantedFollowPairs.push([friend, "coach"]);
  }

  // Core group is dense: each member follows all others (mutual)
  for (let i = 0; i < CORE_GROUP.length; i++) {
    for (let j = i + 1; j < CORE_GROUP.length; j++) {
      const a = CORE_GROUP[i];
      const b = CORE_GROUP[j];
      if (!userMap[a] || !userMap[b]) continue;
      wantedFollowPairs.push([a, b]);
      wantedFollowPairs.push([b, a]);
    }
  }

  // Check existing follows to avoid duplication (the UNIQUE constraint handles it,
  // but we avoid firing triggers for existing rows)
  const { data: existingFollows } = await supabase
    .from("follows")
    .select("follower_id, followed_user_id")
    .not("followed_user_id", "is", null);

  const existingFollowSet = new Set<string>();
  for (const f of existingFollows ?? []) {
    existingFollowSet.add(`${f.follower_id}:${f.followed_user_id}`);
  }

  const newFollows = wantedFollowPairs
    .filter(([a, b]) => {
      const aid = userMap[a];
      const bid = userMap[b];
      if (!aid || !bid) return false;
      return !existingFollowSet.has(`${aid}:${bid}`);
    })
    .map(([a, b]) => ({
      follower_id: userMap[a],
      followed_user_id: userMap[b],
    }));

  let followsAdded = 0;
  if (newFollows.length > 0) {
    followsAdded = await batchInsert("follows", newFollows, "follower_id,followed_user_id");
  }
  console.log(` done (+${followsAdded} new follows)`);

  // ------------------------------------------------------------------
  // Step 3: RSVP seeding
  // ------------------------------------------------------------------
  process.stdout.write("Fetching upcoming events for RSVPs...");

  const today = new Date();
  const in30Days = new Date(Date.now() + 30 * 86_400_000);

  const { data: upcomingEvents, error: eventsErr } = await supabase
    .from("events")
    .select("id, title, start_date, place_id")
    .eq("is_active", true)
    .gte("start_date", today.toISOString())
    .lte("start_date", in30Days.toISOString())
    .is("canonical_event_id", null)
    .order("start_date", { ascending: true })
    .limit(500);

  if (eventsErr || !upcomingEvents?.length) {
    console.warn("\n  [warn] Could not fetch upcoming events:", eventsErr?.message ?? "0 results");
  } else {
    console.log(` done (${upcomingEvents.length} events fetched)`);
  }

  const events = upcomingEvents ?? [];

  // Pick 35 "popular events" — these get friend clustering (3-6 RSVPs each)
  const popularEvents = pickN(events, Math.min(35, events.length));
  const popularEventIds = new Set(popularEvents.map((e) => e.id));

  // Build RSVP rows
  // Track (user_id, event_id) to avoid dupes within this seeding run
  const rsvpSet = new Set<string>();
  const rsvpRows: Array<{
    user_id: string;
    event_id: number;
    status: "going" | "interested";
    visibility: "friends" | "public" | "private";
  }> = [];

  function addRsvp(userId: string, eventId: number) {
    const key = `${userId}:${eventId}`;
    if (rsvpSet.has(key)) return;
    rsvpSet.add(key);
    const statusRoll = Math.random();
    const visRoll = Math.random();
    rsvpRows.push({
      user_id: userId,
      event_id: eventId,
      status: statusRoll < 0.65 ? "going" : "interested",
      visibility: visRoll < 0.80 ? "friends" : visRoll < 0.95 ? "public" : "private",
    });
  }

  // Friend clustering: for popular events, have 3-6 friends RSVP together
  const coreUserIds = CORE_GROUP.map((u) => userMap[u]).filter(Boolean);
  for (const event of popularEvents) {
    const clusterSize = randomBetween(3, 6);
    const clusterUsers = pickN(coreUserIds, Math.min(clusterSize, coreUserIds.length));
    for (const userId of clusterUsers) {
      addRsvp(userId, event.id);
    }
  }

  // Per-user RSVP targets
  for (const username of activeUsernames) {
    const persona = PERSONAS[username];
    if (!persona) continue;
    const userId = userMap[username];
    if (!userId) continue;

    const target = persona.rsvp_target;
    // Count how many this user already got from clustering
    const alreadyHas = rsvpRows.filter((r) => r.user_id === userId).length;
    const needed = Math.max(0, target - alreadyHas);

    if (needed === 0) continue;

    // Give them a mix of popular + random events
    const candidateEvents = [
      ...popularEvents.slice(0, 15), // some overlap with popular
      ...events.filter((e) => !popularEventIds.has(e.id)),
    ].sort(() => Math.random() - 0.5);

    let added = 0;
    for (const event of candidateEvents) {
      if (added >= needed) break;
      addRsvp(userId, event.id);
      added++;
    }
  }

  process.stdout.write(`Inserting ${rsvpRows.length} RSVPs...`);
  const rsvpInserted = await batchInsert("event_rsvps", rsvpRows, "user_id,event_id");
  console.log(` done (${rsvpInserted} inserted)`);

  // ------------------------------------------------------------------
  // Step 4: Hangs seeding
  // ------------------------------------------------------------------
  process.stdout.write("Fetching venues for hangs...");
  const { data: venueRows } = await supabase
    .from("places")
    .select("id, name, neighborhood")
    .eq("is_active", true)
    .not("neighborhood", "is", null)
    .limit(100);

  const venues = venueRows ?? [];
  console.log(` done (${venues.length} venues)`);

  if (venues.length === 0) {
    console.warn("  [warn] No venues found — skipping hangs");
  } else {
    // Fetch atlanta portal id
    const { data: portalRow } = await supabase
      .from("portals")
      .select("id")
      .eq("slug", "atlanta")
      .single();
    const atlantaPortalId: string | null = portalRow?.id ?? null;

    // --- Historical hangs (200 over past 30 days) ---
    process.stdout.write("Seeding 200 historical hangs...");
    const historicalHangRows: Array<{
      user_id: string;
      venue_id: number;
      portal_id: string | null;
      status: "ended";
      visibility: "friends" | "public" | "private";
      note: string | null;
      started_at: string;
      auto_expire_at: string;
      ended_at: string;
    }> = [];

    // Spread across all active users
    const allUserIds = activeUsernames.map((u) => userMap[u]).filter(Boolean);
    for (let i = 0; i < 200; i++) {
      const userId = allUserIds[i % allUserIds.length];
      const venue = pick(venues);
      const startedAt = randomPastTimestamp(30);
      const durationHours = randomBetween(1, 4);
      const endedAt = new Date(startedAt.getTime() + durationHours * 3_600_000);
      const autoExpireAt = new Date(startedAt.getTime() + 4 * 3_600_000);
      const visRoll = Math.random();

      historicalHangRows.push({
        user_id: userId,
        venue_id: venue.id,
        portal_id: atlantaPortalId,
        status: "ended",
        visibility: visRoll < 0.70 ? "friends" : visRoll < 0.95 ? "public" : "private",
        note: pick(HANG_NOTES),
        started_at: startedAt.toISOString(),
        auto_expire_at: autoExpireAt.toISOString(),
        ended_at: endedAt.toISOString(),
      });
    }

    const historicalInserted = await batchInsert("hangs", historicalHangRows);
    console.log(` done (${historicalInserted} inserted)`);

    // --- Active hangs (5 right now) ---
    // Pick 5 friends of coach who are in CORE_GROUP (excluding coach himself)
    const coachFriendUsernames = CORE_GROUP.filter((u) => u !== "coach" && userMap[u]);
    const activeFriends = pickN(coachFriendUsernames, 5);

    // Popular recognizable venue names to prefer
    const recognizableVenues = venues.filter((v) =>
      v.name && (
        v.name.toLowerCase().includes("terminal") ||
        v.name.toLowerCase().includes("variety") ||
        v.name.toLowerCase().includes("earl") ||
        v.name.toLowerCase().includes("krog") ||
        v.name.toLowerCase().includes("ponce") ||
        v.name.toLowerCase().includes("masquerade") ||
        v.name.toLowerCase().includes("music midtown") ||
        v.name.toLowerCase().includes("dad") ||
        v.name.toLowerCase().includes("melting point") ||
        v.name.toLowerCase().includes("tabernacle") ||
        v.name.toLowerCase().includes("vinyl") ||
        v.name.toLowerCase().includes("aisle 5") ||
        v.name.toLowerCase().includes("star bar") ||
        v.name.toLowerCase().includes("edgewood") ||
        v.neighborhood?.toLowerCase().includes("midtown") ||
        v.neighborhood?.toLowerCase().includes("o4w") ||
        v.neighborhood?.toLowerCase().includes("east atlanta")
      )
    );

    const activeHangVenues = recognizableVenues.length >= 5
      ? pickN(recognizableVenues, 5)
      : pickN(venues, 5);

    const activeHangNotes = [
      "post-work vibes",
      "live music!",
      "happy hour crew",
      null,
      "catching up",
    ];

    process.stdout.write("Seeding 5 active hangs...");
    const activeHangRows: Array<{
      user_id: string;
      venue_id: number;
      portal_id: string | null;
      status: "active";
      visibility: "friends" | "public";
      note: string | null;
      started_at: string;
      auto_expire_at: string;
    }> = [];

    for (let i = 0; i < activeFriends.length; i++) {
      const username = activeFriends[i];
      const userId = userMap[username];
      if (!userId) continue;

      const startedAt = hoursAgo(randomBetween(1, 2));
      const autoExpireAt = hoursFromNow(randomBetween(2, 3));

      activeHangRows.push({
        user_id: userId,
        venue_id: activeHangVenues[i % activeHangVenues.length].id,
        portal_id: atlantaPortalId,
        status: "active",
        visibility: Math.random() < 0.8 ? "friends" : "public",
        note: activeHangNotes[i] ?? null,
        started_at: startedAt.toISOString(),
        auto_expire_at: autoExpireAt.toISOString(),
      });
    }

    // Active hangs: the partial unique index (user_id WHERE status='active') can't be used
    // by upsert in PostgREST. Instead: end any existing active hang for each user, then insert.
    let activeInserted = 0;
    for (const row of activeHangRows) {
      // End any existing active hang for this user first
      await supabase
        .from("hangs")
        .update({ status: "ended", ended_at: new Date().toISOString() } as never)
        .eq("user_id", row.user_id)
        .eq("status", "active");
      await sleep(20);

      const { error } = await supabase.from("hangs").insert(row as never);
      if (error) {
        console.warn(`\n  [warn] active hang insert for ${row.user_id}: ${error.message}`);
      } else {
        activeInserted++;
      }
      await sleep(30);
    }
    console.log(` done (${activeInserted} inserted)`);

    // ------------------------------------------------------------------
    // Step 7: Update user_portal_activity
    // ------------------------------------------------------------------
    if (atlantaPortalId) {
      process.stdout.write("Upserting user_portal_activity...");
      // Count hangs per user
      const hangCountByUser: Record<string, number> = {};
      const lastActiveByUser: Record<string, string> = {};

      for (const row of historicalHangRows) {
        hangCountByUser[row.user_id] = (hangCountByUser[row.user_id] ?? 0) + 1;
        const ts = row.started_at;
        if (!lastActiveByUser[row.user_id] || ts > lastActiveByUser[row.user_id]) {
          lastActiveByUser[row.user_id] = ts;
        }
      }
      for (const row of activeHangRows) {
        hangCountByUser[row.user_id] = (hangCountByUser[row.user_id] ?? 0) + 1;
        if (!lastActiveByUser[row.user_id] || row.started_at > lastActiveByUser[row.user_id]) {
          lastActiveByUser[row.user_id] = row.started_at;
        }
      }

      const activityRows = Object.entries(hangCountByUser).map(([userId, count]) => ({
        user_id: userId,
        portal_id: atlantaPortalId,
        last_active_at: lastActiveByUser[userId],
        hang_count: count,
      }));

      const activityInserted = await batchInsert(
        "user_portal_activity",
        activityRows,
        "user_id,portal_id",
      );
      console.log(` done (${activityInserted} upserted)`);
    }
  }

  // ------------------------------------------------------------------
  // Step 5: Regular spots (top up to 5-8 per user)
  // ------------------------------------------------------------------
  process.stdout.write("Topping up regular spots...");

  // Fetch existing spots to avoid dupes
  const { data: existingSpots } = await supabase
    .from("user_regular_spots")
    .select("user_id, place_id");

  const spotSet = new Set<string>();
  for (const s of existingSpots ?? []) {
    spotSet.add(`${s.user_id}:${s.venue_id}`);
  }

  // Get count per user
  const spotCountByUser: Record<string, number> = {};
  for (const s of existingSpots ?? []) {
    spotCountByUser[s.user_id] = (spotCountByUser[s.user_id] ?? 0) + 1;
  }

  const spotsToAdd: Array<{ user_id: string; venue_id: number }> = [];
  const venuePool = (venueRows ?? []).filter((v) => v.id);

  if (venuePool.length > 0) {
    for (const username of activeUsernames) {
      const userId = userMap[username];
      if (!userId) continue;

      const currentCount = spotCountByUser[userId] ?? 0;
      const target = randomBetween(5, 8);
      const needed = Math.max(0, target - currentCount);

      if (needed === 0) continue;

      const shuffledVenues = [...venuePool].sort(() => Math.random() - 0.5);
      let added = 0;
      for (const venue of shuffledVenues) {
        if (added >= needed) break;
        const key = `${userId}:${venue.id}`;
        if (spotSet.has(key)) continue;
        spotSet.add(key);
        spotsToAdd.push({ user_id: userId, place_id: venue.id });
        added++;
      }
    }
  }

  const spotsInserted = await batchInsert("user_regular_spots", spotsToAdd, "user_id,venue_id");
  console.log(` done (+${spotsInserted} spots added)`);

  // ------------------------------------------------------------------
  // Step 6: Saved items (~150 more)
  // ------------------------------------------------------------------
  process.stdout.write("Seeding saved items...");

  // Fetch existing saved items to avoid unique conflicts
  const { data: existingSaved } = await supabase
    .from("saved_items")
    .select("user_id, event_id, place_id");

  const savedEventSet = new Set<string>();
  const savedVenueSet = new Set<string>();
  for (const s of existingSaved ?? []) {
    if (s.event_id) savedEventSet.add(`${s.user_id}:${s.event_id}`);
    if (s.venue_id) savedVenueSet.add(`${s.user_id}:${s.venue_id}`);
  }

  const savedItemsToAdd: Array<{
    user_id: string;
    event_id?: number;
    venue_id?: number;
  }> = [];

  const targetSavedTotal = 150;
  let savedAdded = 0;

  // Round-robin through users, add event saves + venue saves
  for (const username of activeUsernames) {
    if (savedAdded >= targetSavedTotal) break;
    const userId = userMap[username];
    if (!userId) continue;

    const perUserEvents = randomBetween(5, 10);
    const perUserVenues = randomBetween(2, 5);

    // Save some events
    const eventCandidates = pickN(events, perUserEvents * 2);
    let eAdded = 0;
    for (const event of eventCandidates) {
      if (eAdded >= perUserEvents || savedAdded >= targetSavedTotal) break;
      const key = `${userId}:${event.id}`;
      if (savedEventSet.has(key)) continue;
      savedEventSet.add(key);
      savedItemsToAdd.push({ user_id: userId, event_id: event.id });
      eAdded++;
      savedAdded++;
    }

    // Save some venues
    const venueCandidates = pickN(venuePool, perUserVenues * 2);
    let vAdded = 0;
    for (const venue of venueCandidates) {
      if (vAdded >= perUserVenues || savedAdded >= targetSavedTotal) break;
      const key = `${userId}:${venue.id}`;
      if (savedVenueSet.has(key)) continue;
      savedVenueSet.add(key);
      savedItemsToAdd.push({ user_id: userId, place_id: venue.id });
      vAdded++;
      savedAdded++;
    }
  }

  const savedInserted = await batchInsert("saved_items", savedItemsToAdd);
  console.log(` done (+${savedInserted} saved items)`);

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log("\nSeeding complete. Verifying counts...");

  const [rsvpCount, hangCount, spotCount, savedCount, followCount] = await Promise.all([
    supabase.from("event_rsvps").select("id", { count: "exact", head: true }),
    supabase.from("hangs").select("id", { count: "exact", head: true }),
    supabase.from("user_regular_spots").select("user_id", { count: "exact", head: true }),
    supabase.from("saved_items").select("id", { count: "exact", head: true }),
    supabase.from("follows").select("id", { count: "exact", head: true }).not("followed_user_id", "is", null),
  ]);

  console.log(`  event_rsvps:        ${rsvpCount.count ?? "?"}`);
  console.log(`  hangs:              ${hangCount.count ?? "?"}`);
  console.log(`  user_regular_spots: ${spotCount.count ?? "?"}`);
  console.log(`  saved_items:        ${savedCount.count ?? "?"}`);
  console.log(`  user follows:       ${followCount.count ?? "?"}`);

  const activeHangsCheck = await supabase
    .from("hangs")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  console.log(`  active hangs:       ${activeHangsCheck.count ?? "?"}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
