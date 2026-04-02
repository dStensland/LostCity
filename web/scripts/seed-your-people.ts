import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

/**
 * Your People Seed Script
 *
 * Populates the Your People page with realistic test data by:
 * 1. Running the elevation seed if not already present (12 seed users + RSVPs)
 * 2. Creating mutual follows between your real account and seed users (friendships)
 * 3. Adding saved_items from seed users on upcoming events (friend radar signal)
 *
 * Run:   npx tsx scripts/seed-your-people.ts
 * Clean: npx tsx scripts/seed-your-people.ts --clean
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY in .env.local
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

// Elevation seed user IDs (from seed-elevation-data.ts)
const SEED_IDS = [
  "00000000-5eed-e1e0-0000-000000000001", // Sarah Chen — music, nightlife
  "00000000-5eed-e1e0-0000-000000000002", // Mike Johnson — outdoor, food
  "00000000-5eed-e1e0-0000-000000000003", // Lisa Park — art, food
  "00000000-5eed-e1e0-0000-000000000004", // James Williams — jazz, dive bars
  "00000000-5eed-e1e0-0000-000000000005", // Ana Torres — theater, dance
  "00000000-5eed-e1e0-0000-000000000006", // David Kim — film, books
  "00000000-5eed-e1e0-0000-000000000007", // Emma Wright — volunteering
  "00000000-5eed-e1e0-0000-000000000008", // Chris Taylor — outdoor, adventure
  "00000000-5eed-e1e0-0000-000000000009", // Maya Patel — yoga, wellness
  "00000000-5eed-e1e0-0000-000000000010", // Tyler Brooks — sports, trivia
  "00000000-5eed-e1e0-0000-000000000011", // Zoe Martinez — markets, festivals
];

// ── Find the real user ──────────────────────────────────────────────────────

async function findRealUser(): Promise<string | null> {
  // Try finding @coach first, then fall back to any real (non-seed) user
  const { data: coach } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", "coach")
    .maybeSingle();

  if (coach) {
    console.log(`Found real user: @${coach.username} (${coach.id})`);
    return coach.id;
  }

  // Fallback: find any profile that isn't a seed user
  const { data: anyUser } = await supabase
    .from("profiles")
    .select("id, username")
    .not("id", "in", `(${SEED_IDS.join(",")})`)
    .not("username", "like", "%-seed")
    .limit(1)
    .maybeSingle();

  if (anyUser) {
    console.log(`Found real user: @${anyUser.username} (${anyUser.id})`);
    return anyUser.id;
  }

  console.error("No real user found. Sign up first, then run this script.");
  return null;
}

// ── Check elevation seed exists ─────────────────────────────────────────────

async function checkElevationSeed(): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", SEED_IDS[0])
    .maybeSingle();

  return !!data;
}

// ── Create friendships (via friendships table + follows for compat) ──────────

async function createFriendships(realUserId: string) {
  console.log("\n── Creating friendships with seed users ──");

  let created = 0;
  let skipped = 0;

  for (const seedId of SEED_IDS) {
    // Check if friendship already exists in the friendships table
    const smallerId = realUserId < seedId ? realUserId : seedId;
    const largerId = realUserId < seedId ? seedId : realUserId;

    const { data: existing } = await supabase
      .from("friendships")
      .select("id")
      .eq("user_a_id", smallerId)
      .eq("user_b_id", largerId)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Create friendship via RPC (handles canonical ordering)
    const { error: friendshipErr } = await supabase.rpc(
      "create_friendship" as never,
      { user_a: realUserId, user_b: seedId } as never
    );

    // Also create bidirectional follows for backward compat with activity feed
    const { error: e1 } = await supabase.from("follows").upsert({
      follower_id: realUserId,
      followed_user_id: seedId,
    } as never, { onConflict: "follower_id,followed_user_id" });

    const { error: e2 } = await supabase.from("follows").upsert({
      follower_id: seedId,
      followed_user_id: realUserId,
    } as never, { onConflict: "follower_id,followed_user_id" });

    if (friendshipErr) {
      console.error(`  Error creating friendship with ${seedId}:`, friendshipErr.message);
    } else {
      created++;
    }
    if (e1 || e2) {
      // Follow errors are non-critical (may already exist)
    }
  }

  console.log(`  Created ${created} new friendships, skipped ${skipped} existing`);
}

// ── Create saved_items from seed users on upcoming events ───────────────────

async function createSavedItems() {
  console.log("\n── Creating saved items from seed users ──");

  const today = new Date().toISOString().split("T")[0];
  const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

  // Get upcoming events with images (for the radar carousel to look good)
  const { data: events } = await supabase
    .from("events")
    .select("id, title, start_date, image_url")
    .gte("start_date", today)
    .lte("start_date", twoWeeks)
    .eq("is_active", true)
    .not("image_url", "is", null)
    .order("start_date", { ascending: true })
    .limit(30);

  if (!events || events.length === 0) {
    console.log("  No upcoming events with images found. Skipping saved items.");
    return;
  }

  console.log(`  Found ${events.length} upcoming events with images`);

  // Each seed user saves 2-4 events (random selection, staggered)
  let created = 0;
  for (let i = 0; i < SEED_IDS.length; i++) {
    const seedId = SEED_IDS[i];
    const saveCount = 2 + Math.floor(Math.random() * 3); // 2-4
    const startIdx = (i * 3) % events.length; // Stagger so users don't all save same events

    for (let j = 0; j < saveCount && j < events.length; j++) {
      const event = events[(startIdx + j) % events.length];

      const { error } = await supabase
        .from("saved_items")
        .upsert(
          { user_id: seedId, event_id: event.id } as never,
          { onConflict: "user_id,event_id" }
        );

      if (!error) created++;
    }
  }

  console.log(`  Created ${created} saved items across seed users`);
}

// ── Add a few pending friend requests (for the request section) ─────────────

async function createPendingRequests(realUserId: string) {
  console.log("\n── Creating pending friend requests ──");

  // Create 2 pending requests from seed users who aren't yet friends
  // Use the last 2 seed users as the requesters
  const requesters = SEED_IDS.slice(-2);
  let created = 0;

  for (const seedId of requesters) {
    // Check if request already exists
    const { data: existing } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("inviter_id", seedId)
      .eq("invitee_id", realUserId)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from("friend_requests").insert({
      inviter_id: seedId,
      invitee_id: realUserId,
      status: "pending",
    } as never);

    if (!error) created++;
    else console.error(`  Error creating request from ${seedId}:`, error.message);
  }

  console.log(`  Created ${created} pending friend requests`);
}

// ── Clean ───────────────────────────────────────────────────────────────────

async function clean(realUserId: string) {
  console.log("Cleaning Your People seed data...\n");

  // Remove follows between real user and seed users
  await supabase
    .from("follows")
    .delete()
    .eq("follower_id", realUserId)
    .in("followed_user_id", SEED_IDS);

  await supabase
    .from("follows")
    .delete()
    .in("follower_id", SEED_IDS)
    .eq("followed_user_id", realUserId);

  console.log("  Deleted mutual follows");

  // Remove friendships between real user and seed users
  await supabase
    .from("friendships")
    .delete()
    .or(`user_a_id.eq.${realUserId},user_b_id.eq.${realUserId}`);

  console.log("  Deleted friendships");

  // Remove saved items from seed users
  await supabase
    .from("saved_items")
    .delete()
    .in("user_id", SEED_IDS);

  console.log("  Deleted saved items");

  // Remove pending friend requests
  await supabase
    .from("friend_requests")
    .delete()
    .in("inviter_id", SEED_IDS)
    .eq("invitee_id", realUserId);

  console.log("  Deleted friend requests");

  console.log("\nClean complete. Run without --clean to re-seed.");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const isClean = process.argv.includes("--clean");

  console.log("╔══════════════════════════════════════════╗");
  console.log("║     Your People — Seed Data Script       ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const realUserId = await findRealUser();
  if (!realUserId) return;

  if (isClean) {
    await clean(realUserId);
    return;
  }

  // Check if elevation seed has been run
  const hasElevation = await checkElevationSeed();
  if (!hasElevation) {
    console.log("\n⚠️  Elevation seed users not found.");
    console.log("   Run first:  npx tsx scripts/seed-elevation-data.ts");
    console.log("   Then re-run: npx tsx scripts/seed-your-people.ts\n");
    process.exit(1);
  }

  console.log("✓ Elevation seed users found\n");

  // 1. Create friendships (mutual follows)
  await createFriendships(realUserId);

  // 2. Create saved items on upcoming events
  await createSavedItems();

  // 3. Create a couple pending friend requests
  await createPendingRequests(realUserId);

  console.log("\n✓ Your People seed complete!");
  console.log("  Visit: http://localhost:3000/your-people\n");
}

main().catch(console.error);
