import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

/**
 * Elevation Data Seed Script
 *
 * Populates the social layer with realistic test data for the design elevation.
 * Creates 12 seed users with profiles, mutual follows, RSVPs, and regular spots.
 *
 * Run with:  npx tsx scripts/seed-elevation-data.ts
 * Clean with: npx tsx scripts/seed-elevation-data.ts --clean
 *
 * Idempotent: safe to run multiple times. Uses fixed UUIDs to detect existing data.
 */

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// Seed Users — fixed UUIDs for idempotency
// UUID prefix: 00000000-5eed-e1e0-0000-
// ============================================================================

interface SeedUser {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  email: string;
  categories: string[];
  genres: Record<string, string[]>;
  neighborhoods: string[];
}

const SEED_USERS: SeedUser[] = [
  {
    id: "00000000-5eed-e1e0-0000-000000000001",
    username: "sarahchen",
    display_name: "Sarah Chen",
    bio: "Chasing live music and late nights across Atlanta.",
    email: "sarahchen-seed@test.local",
    categories: ["music", "comedy", "nightlife"],
    genres: { music: ["indie", "electronic"], nightlife: ["dj", "drag"] },
    neighborhoods: ["Midtown", "Buckhead"],
  },
  {
    id: "00000000-5eed-e1e0-0000-000000000002",
    username: "mikej",
    display_name: "Mike Johnson",
    bio: "Weekend hiker, craft beer enthusiast, and Falcons season ticket holder.",
    email: "mikej-seed@test.local",
    categories: ["outdoor", "food_drink", "sports"],
    genres: { food_drink: ["craft_beer", "bbq"], sports: ["football", "basketball"] },
    neighborhoods: ["Decatur", "East Atlanta"],
  },
  {
    id: "00000000-5eed-e1e0-0000-000000000003",
    username: "lisapark",
    display_name: "Lisa Park",
    bio: "Gallery hopper and food explorer, always hunting for the next hidden gem.",
    email: "lisapark-seed@test.local",
    categories: ["art", "food_drink"],
    genres: { art: ["painting", "photography"], food_drink: ["brunch", "wine"] },
    neighborhoods: ["Old Fourth Ward", "West Midtown"],
  },
  {
    id: "00000000-5eed-e1e0-0000-000000000004",
    username: "jamesw",
    display_name: "James Williams",
    bio: "Jazz aficionado, blues history buff, dive bar connoisseur.",
    email: "jamesw-seed@test.local",
    categories: ["music", "nightlife"],
    genres: { music: ["jazz", "blues", "soul"] },
    neighborhoods: ["Virginia-Highland", "East Atlanta"],
  },
  {
    id: "00000000-5eed-e1e0-0000-000000000005",
    username: "anar",
    display_name: "Ana Rodriguez",
    bio: "Latin dance instructor by night, festival devotee every weekend.",
    email: "anar-seed@test.local",
    categories: ["music", "nightlife", "community"],
    genres: { music: ["latin", "reggaeton"], nightlife: ["latin_night", "dancing"] },
    neighborhoods: ["Midtown", "Downtown"],
  },
  {
    id: "00000000-5eed-e1e0-0000-000000000006",
    username: "davidk",
    display_name: "David Kim",
    bio: "Tech meetups, stand-up comedy, and tabletop gaming — that's my Atlanta.",
    email: "davidk-seed@test.local",
    categories: ["tech", "comedy", "games"],
    genres: { comedy: ["stand_up", "improv"], games: ["tabletop", "trivia"] },
    neighborhoods: ["Buckhead", "Midtown"],
  },
  {
    id: "00000000-5eed-e1e0-0000-000000000007",
    username: "emmat",
    display_name: "Emma Thompson",
    bio: "Theatre subscriber, museum member, and classical music devotee.",
    email: "emmat-seed@test.local",
    categories: ["theater", "art", "music"],
    genres: { music: ["classical", "opera"], theater: ["drama", "musical"] },
    neighborhoods: ["Midtown", "Buckhead"],
  },
  {
    id: "00000000-5eed-e1e0-0000-000000000008",
    username: "chrisj",
    display_name: "Chris Jackson",
    bio: "Hip-hop head, sports bar regular, and West End local.",
    email: "chrisj-seed@test.local",
    categories: ["music", "nightlife", "sports"],
    genres: { music: ["hip-hop", "r&b"], nightlife: ["party", "dj"] },
    neighborhoods: ["Downtown", "West End"],
  },
  {
    id: "00000000-5eed-e1e0-0000-000000000009",
    username: "mayap",
    display_name: "Maya Patel",
    bio: "Morning yoga, long brunches, and afternoon farmers markets.",
    email: "mayap-seed@test.local",
    categories: ["fitness", "food_drink", "community"],
    genres: { food_drink: ["brunch", "vegetarian"], fitness: ["yoga", "wellness"] },
    neighborhoods: ["Decatur", "Morningside"],
  },
  {
    id: "00000000-5eed-e1e0-0000-000000000010",
    username: "tylerb",
    display_name: "Tyler Brooks",
    bio: "Rock and punk at EAV dive bars — loud shows, cheap beer, good times.",
    email: "tylerb-seed@test.local",
    categories: ["music", "nightlife"],
    genres: { music: ["rock", "punk", "indie"] },
    neighborhoods: ["East Atlanta", "Little Five Points"],
  },
  {
    id: "00000000-5eed-e1e0-0000-000000000011",
    username: "zoec",
    display_name: "Zoe Carter",
    bio: "Street photographer and mural hunter obsessed with Atlanta's hidden corners.",
    email: "zoec-seed@test.local",
    categories: ["art", "community"],
    genres: { art: ["photography", "street_art", "mural"] },
    neighborhoods: ["Old Fourth Ward", "Cabbagetown"],
  },
  {
    id: "00000000-5eed-e1e0-0000-000000000012",
    username: "jordanl",
    display_name: "Jordan Lee",
    bio: "Farmers market regular, food truck chaser, and weekend cook.",
    email: "jordanl-seed@test.local",
    categories: ["food_drink", "community"],
    genres: { food_drink: ["food_trucks", "farmers_market", "cooking"] },
    neighborhoods: ["Grant Park", "Kirkwood"],
  },
];

const SEED_UUID_PREFIX = "00000000-5eed-e1e0-0000-";
const SEED_IDS = SEED_USERS.map((u) => u.id);

// ============================================================================
// Friend Groups — mutual follows
// Night Owls: sarah, mike, lisa, james (indices 0-3)
// Culture Crew: ana, david, emma (indices 4-6)
// Explorers: chris, maya, tyler, zoe (indices 7-10)
// Cross-group bridges: sarah↔ana, mike↔chris, lisa↔emma, james↔tyler
// ============================================================================

function buildFollowPairs(): Array<{ follower_id: string; following_id: string }> {
  const pairs: Array<{ follower_id: string; following_id: string }> = [];

  function addMutual(a: SeedUser, b: SeedUser) {
    pairs.push({ follower_id: a.id, following_id: b.id });
    pairs.push({ follower_id: b.id, following_id: a.id });
  }

  const [sarah, mike, lisa, james, ana, david, emma, chris, maya, tyler, zoe] =
    SEED_USERS;

  // Night Owls (all mutual within group)
  addMutual(sarah, mike);
  addMutual(sarah, lisa);
  addMutual(sarah, james);
  addMutual(mike, lisa);
  addMutual(mike, james);
  addMutual(lisa, james);

  // Culture Crew (all mutual within group)
  addMutual(ana, david);
  addMutual(ana, emma);
  addMutual(david, emma);

  // Explorers (all mutual within group)
  addMutual(chris, maya);
  addMutual(chris, tyler);
  addMutual(chris, zoe);
  addMutual(maya, tyler);
  addMutual(maya, zoe);
  addMutual(tyler, zoe);

  // Cross-group bridges
  addMutual(sarah, ana);
  addMutual(mike, chris);
  addMutual(lisa, emma);
  addMutual(james, tyler);

  return pairs;
}

// ============================================================================
// Clean — remove all seed data
// ============================================================================

async function clean() {
  console.log("Cleaning elevation seed data...\n");

  // Delete in reverse dependency order
  const { error: spotsError } = await supabase
    .from("user_regular_spots")
    .delete()
    .in("user_id", SEED_IDS);
  if (spotsError) console.error("  Error cleaning regular spots:", spotsError.message);
  else console.log("  Deleted regular spots");

  const { error: rsvpError } = await supabase
    .from("event_rsvps")
    .delete()
    .in("user_id", SEED_IDS);
  if (rsvpError) console.error("  Error cleaning RSVPs:", rsvpError.message);
  else console.log("  Deleted RSVPs");

  const { error: followsError } = await supabase
    .from("follows")
    .delete()
    .in("follower_id", SEED_IDS);
  if (followsError) console.error("  Error cleaning follows:", followsError.message);
  else console.log("  Deleted follows");

  // Clean friendships table
  const { error: friendshipsError } = await supabase
    .from("friendships")
    .delete()
    .or(`user_a_id.in.(${SEED_IDS.join(",")}),user_b_id.in.(${SEED_IDS.join(",")})`);
  if (friendshipsError) console.error("  Error cleaning friendships:", friendshipsError.message);
  else console.log("  Deleted friendships");

  const { error: prefsError } = await supabase
    .from("user_preferences")
    .delete()
    .in("user_id", SEED_IDS);
  if (prefsError) console.error("  Error cleaning preferences:", prefsError.message);
  else console.log("  Deleted user preferences");

  const { error: profilesError } = await supabase
    .from("profiles")
    .delete()
    .in("id", SEED_IDS);
  if (profilesError) console.error("  Error cleaning profiles:", profilesError.message);
  else console.log("  Deleted profiles");

  // Delete auth users
  let authDeleted = 0;
  for (const user of SEED_USERS) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error && !error.message.includes("not found")) {
      console.error(`  Error deleting auth user ${user.username}:`, error.message);
    } else {
      authDeleted++;
    }
  }
  console.log(`  Deleted ${authDeleted} auth users`);

  console.log("\nClean complete.");
}

// ============================================================================
// Seed
// ============================================================================

async function seed() {
  console.log("Seeding elevation data...\n");

  // Check if seed already exists (idempotency check)
  const { data: existingProfiles } = await supabase
    .from("profiles")
    .select("id")
    .in("id", SEED_IDS);

  const existingIds = new Set((existingProfiles || []).map((p) => p.id));
  const alreadySeeded = existingIds.size > 0;
  if (alreadySeeded) {
    console.log(`Found ${existingIds.size} existing seed profiles — skipping already-created users.\n`);
  }

  // ── Step 1: Auth users ────────────────────────────────────────────────────
  let authCreated = 0;
  for (const user of SEED_USERS) {
    if (existingIds.has(user.id)) continue;

    const { error } = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: "seed-password-123",
      email_confirm: true,
    } as never);

    if (error && !error.message.includes("already exists")) {
      console.error(`  Error creating auth user ${user.username}:`, error.message);
    } else if (!error) {
      authCreated++;
    }
  }
  console.log(`Auth users created: ${authCreated} (${existingIds.size} already existed)`);

  // ── Step 2: Profiles ──────────────────────────────────────────────────────
  const profilesToInsert = SEED_USERS.filter((u) => !existingIds.has(u.id)).map(
    (user) => ({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      bio: user.bio,
      privacy_mode: "social",
      is_public: true,
      created_at: new Date().toISOString(),
      calendar_feed_secret: crypto.randomUUID(),
    })
  );

  let profilesCreated = 0;
  if (profilesToInsert.length > 0) {
    const { error } = await supabase
      .from("profiles")
      .insert(profilesToInsert as never);
    if (error) {
      console.error("  Error inserting profiles:", error.message);
    } else {
      profilesCreated = profilesToInsert.length;
    }
  }
  console.log(`Profiles created: ${profilesCreated} (${existingIds.size} already existed)`);

  // ── Step 3: User preferences ──────────────────────────────────────────────
  // Check which preferences already exist
  const { data: existingPrefs } = await supabase
    .from("user_preferences")
    .select("user_id")
    .in("user_id", SEED_IDS);
  const existingPrefIds = new Set((existingPrefs || []).map((p) => p.user_id));

  const prefsToInsert = SEED_USERS.filter((u) => !existingPrefIds.has(u.id)).map(
    (user) => ({
      user_id: user.id,
      favorite_categories: user.categories,
      favorite_neighborhoods: user.neighborhoods,
      favorite_genres: user.genres,
    })
  );

  let prefsCreated = 0;
  if (prefsToInsert.length > 0) {
    const { error } = await supabase
      .from("user_preferences")
      .insert(prefsToInsert as never);
    if (error) {
      console.error("  Error inserting preferences:", error.message);
    } else {
      prefsCreated = prefsToInsert.length;
    }
  }
  console.log(`User preferences set: ${prefsCreated} (${existingPrefIds.size} already existed)`);

  // ── Step 4: Friend connections (follows) ──────────────────────────────────
  // Check which follows already exist
  const { data: existingFollows } = await supabase
    .from("follows")
    .select("follower_id, followed_user_id")
    .in("follower_id", SEED_IDS);

  const existingFollowKeys = new Set(
    (existingFollows || []).map((f) => `${f.follower_id}:${f.followed_user_id}`)
  );

  const allPairs = buildFollowPairs();
  const followsToInsert = allPairs
    .filter((p) => !existingFollowKeys.has(`${p.follower_id}:${p.following_id}`))
    .map((p) => ({
      follower_id: p.follower_id,
      followed_user_id: p.following_id,
    }));

  let followsCreated = 0;
  if (followsToInsert.length > 0) {
    const { error } = await supabase
      .from("follows")
      .insert(followsToInsert as never);
    if (error) {
      console.error("  Error inserting follows:", error.message);
    } else {
      followsCreated = followsToInsert.length;
    }
  }
  console.log(
    `Friend connections: ${followsCreated} created (${allPairs.length - followsCreated} already existed)`
  );

  // ── Step 4b: Friendships table (required for get_friend_ids RPC) ──────────
  // The follows table is for backward compat; the friendships table is what
  // get_friend_ids actually reads from. Create friendship rows for each pair.
  const uniquePairs = new Set<string>();
  let friendshipsCreated = 0;
  for (const pair of allPairs) {
    const a = pair.follower_id;
    const b = pair.following_id;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (uniquePairs.has(key)) continue;
    uniquePairs.add(key);

    const { error: fErr } = await supabase.rpc(
      "create_friendship" as never,
      { user_a: a, user_b: b } as never
    );
    if (!fErr) friendshipsCreated++;
  }
  console.log(`Friendships created: ${friendshipsCreated} (${uniquePairs.size} unique pairs)`);

  // ── Step 5: RSVPs ─────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: upcomingEvents, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start_date, category_id, place_id, image_url")
    .gte("start_date", today)
    .lte("start_date", twoWeeksOut)
    .eq("is_active", true)
    .order("start_date", { ascending: true })
    .limit(100);

  if (eventsError) {
    console.error("  Error fetching events:", eventsError.message);
  }

  let rsvpsCreated = 0;
  const events = upcomingEvents || [];

  if (events.length > 0) {
    // Check which RSVPs already exist for seed users
    const { data: existingRsvps } = await supabase
      .from("event_rsvps")
      .select("user_id, event_id")
      .in("user_id", SEED_IDS);
    const existingRsvpKeys = new Set(
      (existingRsvps || []).map((r) => `${r.user_id}:${r.event_id}`)
    );

    // Partition events into tiers:
    // Big (first 8 with images): 6-10 RSVPs from across groups
    // Medium (next 25): 2-4 RSVPs, clustered within groups
    // Remaining: 1-2 random RSVPs
    const eventsWithImages = events.filter((e) => e.image_url);
    const bigEvents = eventsWithImages.slice(0, Math.min(8, eventsWithImages.length));
    const remainingEvents = events.filter(
      (e) => !bigEvents.some((b) => b.id === e.id)
    );
    const mediumEvents = remainingEvents.slice(0, 25);
    const tailEvents = remainingEvents.slice(25, 65);

    // Friend groups for RSVP clustering
    const nightOwls = SEED_USERS.slice(0, 4); // sarah, mike, lisa, james
    const cultureCrew = SEED_USERS.slice(4, 7); // ana, david, emma
    const explorers = SEED_USERS.slice(7, 11); // chris, maya, tyler, zoe
    const allGroups = [nightOwls, cultureCrew, explorers, SEED_USERS.slice(11)];

    const rsvpsToInsert: Array<{
      user_id: string;
      event_id: number;
      status: string;
      visibility: string;
    }> = [];

    function addRsvp(userId: string, eventId: number, status: "going" | "interested") {
      const key = `${userId}:${eventId}`;
      if (!existingRsvpKeys.has(key)) {
        rsvpsToInsert.push({
          user_id: userId,
          event_id: eventId,
          status,
          visibility: "public",
        });
        existingRsvpKeys.add(key); // prevent duplicate within this run
      }
    }

    // Big events: spread RSVPs across all groups (6-10 per event)
    for (const event of bigEvents) {
      const rsvpCount = 6 + Math.floor(Math.random() * 5); // 6-10
      const shuffledUsers = [...SEED_USERS].sort(() => Math.random() - 0.5);
      const selectedUsers = shuffledUsers.slice(0, Math.min(rsvpCount, SEED_USERS.length));
      for (let i = 0; i < selectedUsers.length; i++) {
        const status = i < Math.ceil(selectedUsers.length * 0.7) ? "going" : "interested";
        addRsvp(selectedUsers[i].id, event.id, status);
      }
    }

    // Medium events: cluster within friend groups (2-4 per event)
    let groupIndex = 0;
    for (const event of mediumEvents) {
      const group = allGroups[groupIndex % allGroups.length];
      const rsvpCount = 2 + Math.floor(Math.random() * 3); // 2-4
      const selectedUsers = group
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(rsvpCount, group.length));
      for (let i = 0; i < selectedUsers.length; i++) {
        const status = i < Math.ceil(selectedUsers.length * 0.7) ? "going" : "interested";
        addRsvp(selectedUsers[i].id, event.id, status);
      }
      groupIndex++;
    }

    // Tail events: 1-2 random RSVPs each
    for (const event of tailEvents) {
      const rsvpCount = 1 + Math.floor(Math.random() * 2); // 1-2
      const shuffledUsers = [...SEED_USERS].sort(() => Math.random() - 0.5);
      const selectedUsers = shuffledUsers.slice(0, rsvpCount);
      for (const user of selectedUsers) {
        const status = Math.random() < 0.7 ? "going" : "interested";
        addRsvp(user.id, event.id, status);
      }
    }

    // Insert in batches of 50 to avoid payload limits
    const batchSize = 50;
    for (let i = 0; i < rsvpsToInsert.length; i += batchSize) {
      const batch = rsvpsToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from("event_rsvps")
        .insert(batch as never);
      if (error) {
        console.error(`  Error inserting RSVPs batch ${i / batchSize + 1}:`, error.message);
      } else {
        rsvpsCreated += batch.length;
      }
    }
  } else {
    console.warn("  No upcoming events found — RSVPs skipped.");
  }

  console.log(`RSVPs created: ${rsvpsCreated}`);

  // ── Step 6: Regular spots ─────────────────────────────────────────────────
  const { data: venueRows, error: venuesError } = await supabase
    .from("places")
    .select("id, name, slug")
    .eq("city", "Atlanta")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(50);

  if (venuesError) {
    console.error("  Error fetching venues:", venuesError.message);
  }

  let regularSpotsCreated = 0;
  const venues = venueRows || [];

  if (venues.length >= 5) {
    // Check existing spots for seed users
    const { data: existingSpots } = await supabase
      .from("user_regular_spots")
      .select("user_id, place_id")
      .in("user_id", SEED_IDS);
    const existingSpotKeys = new Set(
      (existingSpots || []).map((s) => `${s.user_id}:${s.venue_id}`)
    );

    // Try to find named venues for group overlap; fall back to index-based picks
    function findVenueId(patterns: string[]): number | null {
      for (const pattern of patterns) {
        const found = venues.find((v) =>
          v.name.toLowerCase().includes(pattern.toLowerCase())
        );
        if (found) return found.id;
      }
      return null;
    }

    // Shared anchor venues for each group
    const nightOwlAnchor =
      findVenueId(["Laughing Skull", "Terminal West", "Variety Playhouse", "Earl"]) ??
      venues[0].id;
    const cultureCrewAnchor =
      findVenueId(["High Museum", "Woodruff Arts", "Museum of Art"]) ?? venues[1].id;
    const explorerAnchor =
      findVenueId(["Masquerade", "Tabernacle", "Center Stage", "Vinyl"]) ?? venues[2].id;

    const spotsToInsert: Array<{ user_id: string; venue_id: number }> = [];

    function addSpot(userId: string, venueId: number) {
      const key = `${userId}:${venueId}`;
      if (!existingSpotKeys.has(key)) {
        spotsToInsert.push({ user_id: userId, place_id: venueId });
        existingSpotKeys.add(key);
      }
    }

    // Assign 3-5 venues per user for 8 of 12 users (Night Owls + Culture Crew + Explorers)
    const nightOwlUsers = SEED_USERS.slice(0, 4);
    const cultureCrewUsers = SEED_USERS.slice(4, 7);
    const explorerUsers = SEED_USERS.slice(7, 11);

    // Night Owls share anchor venue + 2-3 individual picks
    for (const user of nightOwlUsers) {
      addSpot(user.id, nightOwlAnchor);
      // Individual picks from the venue list (spread across the list)
      const personalVenues = venues
        .filter((v) => v.id !== nightOwlAnchor)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2 + Math.floor(Math.random() * 2)); // 2-3 more
      for (const v of personalVenues) addSpot(user.id, v.id);
    }

    // Culture Crew share High Museum + 2-3 individual picks
    for (const user of cultureCrewUsers) {
      addSpot(user.id, cultureCrewAnchor);
      const personalVenues = venues
        .filter((v) => v.id !== cultureCrewAnchor)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2 + Math.floor(Math.random() * 2));
      for (const v of personalVenues) addSpot(user.id, v.id);
    }

    // Explorers share music venue + 2-3 individual picks
    for (const user of explorerUsers) {
      addSpot(user.id, explorerAnchor);
      const personalVenues = venues
        .filter((v) => v.id !== explorerAnchor)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2 + Math.floor(Math.random() * 2));
      for (const v of personalVenues) addSpot(user.id, v.id);
    }

    // Insert spots
    if (spotsToInsert.length > 0) {
      const { error } = await supabase
        .from("user_regular_spots")
        .insert(spotsToInsert as never);
      if (error) {
        console.error("  Error inserting regular spots:", error.message);
      } else {
        regularSpotsCreated = spotsToInsert.length;
      }
    }
  } else {
    console.warn(`  Only ${venues.length} Atlanta venues found — regular spots skipped.`);
  }

  console.log(`Regular spots created: ${regularSpotsCreated}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
SEED COMPLETE:
  Auth users created: ${authCreated}
  Profiles created: ${profilesCreated}
  User preferences set: ${prefsCreated}
  Friend connections: ${followsCreated}
  RSVPs created: ${rsvpsCreated}
  Regular spots created: ${regularSpotsCreated}
`);
}

// ============================================================================
// Entry point
// ============================================================================

const isClean = process.argv.includes("--clean");

if (isClean) {
  clean().catch((err) => {
    console.error("Clean failed:", err);
    process.exit(1);
  });
} else {
  seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
