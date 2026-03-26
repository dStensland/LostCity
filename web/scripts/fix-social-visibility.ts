/**
 * fix-social-visibility.ts
 *
 * Fixes the social proof visibility problem: 82% of seeded RSVPs have
 * visibility='friends', but get_social_proof_counts only counts visibility='public'.
 * Anonymous users see zero social proof everywhere.
 *
 * What this script does:
 * 1. Fetches all event_rsvps with visibility='friends'
 * 2. For events with 3+ total RSVPs, randomly flips ~40% of their friends-visibility
 *    RSVPs to 'public' (ensuring at least 1 public RSVP per such event)
 * 3. Flips all active hangs to visibility='public' so hot venue counts are visible
 * 4. Verifies the result: events with 3+ public RSVPs (target: 30+, was: 2)
 *
 * Run from the web/ directory: npx tsx scripts/fix-social-visibility.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Load env
// ---------------------------------------------------------------------------

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

const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceKey = env["SUPABASE_SERVICE_KEY"];

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("fix-social-visibility: patching RSVP and hang visibility");
  console.log(`Target: ${supabaseUrl}\n`);

  // ------------------------------------------------------------------
  // Step 1: Fetch all friends-visibility RSVPs
  // ------------------------------------------------------------------
  process.stdout.write("Fetching friends-visibility RSVPs...");

  const { data: friendsRsvps, error: fetchErr } = await supabase
    .from("event_rsvps")
    .select("id, event_id, user_id, visibility")
    .eq("visibility", "friends");

  if (fetchErr) {
    console.error("\nFailed to fetch RSVPs:", fetchErr.message);
    process.exit(1);
  }

  console.log(` done (${friendsRsvps?.length ?? 0} friends-visibility RSVPs found)`);
  const allFriendsRsvps = friendsRsvps ?? [];

  // ------------------------------------------------------------------
  // Step 2: Fetch public RSVPs to know which events already have some
  // ------------------------------------------------------------------
  process.stdout.write("Fetching public-visibility RSVPs...");

  const { data: publicRsvps, error: pubErr } = await supabase
    .from("event_rsvps")
    .select("id, event_id")
    .eq("visibility", "public");

  if (pubErr) {
    console.error("\nFailed to fetch public RSVPs:", pubErr.message);
    process.exit(1);
  }

  console.log(` done (${publicRsvps?.length ?? 0} public RSVPs found)`);

  // Build a map: event_id -> count of public RSVPs already present
  const publicCountByEvent = new Map<number, number>();
  for (const r of publicRsvps ?? []) {
    publicCountByEvent.set(r.event_id, (publicCountByEvent.get(r.event_id) ?? 0) + 1);
  }

  // ------------------------------------------------------------------
  // Step 3: Build a map of event_id -> [friends-rsvp-ids]
  // ------------------------------------------------------------------
  const friendsIdsByEvent = new Map<number, string[]>();
  for (const r of allFriendsRsvps) {
    const existing = friendsIdsByEvent.get(r.event_id) ?? [];
    existing.push(r.id);
    friendsIdsByEvent.set(r.event_id, existing);
  }

  // ------------------------------------------------------------------
  // Step 4: Determine total RSVPs per event (friends + public)
  // and select which IDs to flip.
  //
  // Strategy: flip enough friends RSVPs so that every event ends up with
  // at least 3 public RSVPs (if it has enough total RSVPs to support that).
  // Events with fewer than 3 total RSVPs get at least 1 public RSVP.
  // ------------------------------------------------------------------
  const idsToFlip: string[] = [];

  for (const [eventId, friendsIds] of friendsIdsByEvent) {
    const publicCount = publicCountByEvent.get(eventId) ?? 0;
    const totalCount = publicCount + friendsIds.length;

    // Skip events with no RSVPs at all
    if (totalCount === 0) continue;

    // Target: 3 public RSVPs on events with 3+ total, 1 on events with 1-2
    const publicTarget = totalCount >= 3 ? 3 : 1;
    const needed = Math.max(0, publicTarget - publicCount);

    if (needed === 0) continue;

    // Take exactly what we need from the friends pool (in random order)
    const shuffled = [...friendsIds].sort(() => Math.random() - 0.5);
    const toFlip = shuffled.slice(0, Math.min(needed, friendsIds.length));
    idsToFlip.push(...toFlip);
  }

  const eventsTargeted = [...friendsIdsByEvent.keys()].filter((id) => {
    const pub = publicCountByEvent.get(id) ?? 0;
    const tot = pub + (friendsIdsByEvent.get(id)?.length ?? 0);
    return tot >= 3;
  }).length;

  console.log(`\nRSVP flip plan:`);
  console.log(`  Events with 3+ total RSVPs: ${eventsTargeted}`);
  console.log(`  friends-visibility RSVPs to flip to public: ${idsToFlip.length}`);

  if (idsToFlip.length === 0) {
    console.log("  Nothing to flip — visibility may already be correct.");
  } else {
    // ------------------------------------------------------------------
    // Step 5: Update in batches of 100
    // ------------------------------------------------------------------
    process.stdout.write(`\nUpdating ${idsToFlip.length} RSVPs to public...`);

    const BATCH_SIZE = 100;
    let flipped = 0;
    let failCount = 0;

    for (let i = 0; i < idsToFlip.length; i += BATCH_SIZE) {
      const batch = idsToFlip.slice(i, i + BATCH_SIZE);
      const { error: updateErr } = await supabase
        .from("event_rsvps")
        .update({ visibility: "public" } as never)
        .in("id", batch);

      if (updateErr) {
        console.warn(`\n  [warn] batch ${i}-${i + batch.length}: ${updateErr.message}`);
        failCount += batch.length;
      } else {
        flipped += batch.length;
      }
      await sleep(50);
    }

    console.log(` done (${flipped} flipped, ${failCount} failed)`);
  }

  // ------------------------------------------------------------------
  // Step 6: Flip active hangs to public
  // ------------------------------------------------------------------
  process.stdout.write("\nFetching active hangs...");

  const { data: activeHangs, error: hangsErr } = await supabase
    .from("hangs")
    .select("id, user_id, visibility, status")
    .eq("status", "active");

  if (hangsErr) {
    console.warn(" failed:", hangsErr.message);
  } else {
    console.log(` done (${activeHangs?.length ?? 0} active hangs found)`);

    const nonPublicHangs = (activeHangs ?? []).filter((h) => h.visibility !== "public");
    if (nonPublicHangs.length === 0) {
      console.log("  All active hangs already public.");
    } else {
      process.stdout.write(`  Flipping ${nonPublicHangs.length} active hangs to public...`);
      const hangIds = nonPublicHangs.map((h) => h.id);
      const { error: hangUpdateErr } = await supabase
        .from("hangs")
        .update({ visibility: "public" } as never)
        .in("id", hangIds);

      if (hangUpdateErr) {
        console.warn(" failed:", hangUpdateErr.message);
      } else {
        console.log(" done");
      }
    }
  }

  // ------------------------------------------------------------------
  // Step 7: Verify — how many events now have 3+ public RSVPs?
  // ------------------------------------------------------------------
  console.log("\n--- Verification ---");

  const { data: verifyData, error: verifyErr } = await supabase
    .from("event_rsvps")
    .select("event_id, visibility, status");

  if (verifyErr) {
    console.error("Verification query failed:", verifyErr.message);
    process.exit(1);
  }

  const publicByEvent = new Map<number, number>();
  const friendsByEvent = new Map<number, number>();
  const privateByEvent = new Map<number, number>();
  let totalPublic = 0;
  let totalFriends = 0;
  let totalPrivate = 0;

  for (const r of verifyData ?? []) {
    if (r.visibility === "public") {
      publicByEvent.set(r.event_id, (publicByEvent.get(r.event_id) ?? 0) + 1);
      totalPublic++;
    } else if (r.visibility === "friends") {
      friendsByEvent.set(r.event_id, (friendsByEvent.get(r.event_id) ?? 0) + 1);
      totalFriends++;
    } else {
      privateByEvent.set(r.event_id, (privateByEvent.get(r.event_id) ?? 0) + 1);
      totalPrivate++;
    }
  }

  const totalRsvps = totalPublic + totalFriends + totalPrivate;
  const eventsWithAnyPublic = [...publicByEvent.keys()].length;
  const eventsWith3PlusPublic = [...publicByEvent.entries()].filter(([, count]) => count >= 3).length;
  const eventsWith1PlusPublic = [...publicByEvent.entries()].filter(([, count]) => count >= 1).length;

  const publicPct = totalRsvps > 0 ? ((totalPublic / totalRsvps) * 100).toFixed(1) : "0";
  const friendsPct = totalRsvps > 0 ? ((totalFriends / totalRsvps) * 100).toFixed(1) : "0";

  console.log(`Total RSVPs:             ${totalRsvps}`);
  console.log(`  public:                ${totalPublic} (${publicPct}%)`);
  console.log(`  friends:               ${totalFriends} (${friendsPct}%)`);
  console.log(`  private:               ${totalPrivate}`);
  console.log(`Events with any public RSVPs:    ${eventsWithAnyPublic}`);
  console.log(`Events with 1+ public RSVPs:     ${eventsWith1PlusPublic}`);
  console.log(`Events with 3+ public RSVPs:     ${eventsWith3PlusPublic}  (target: 30+)`);

  if (eventsWith3PlusPublic >= 30) {
    console.log("\nPASS: 30+ events have visible social proof for anonymous users.");
  } else {
    console.warn(`\nWARN: Only ${eventsWith3PlusPublic} events have 3+ public RSVPs. Target is 30.`);
    console.warn("      Consider running seed-social-proof.ts with --clean first, then re-running this script.");
  }

  // Verify active hangs visibility
  const { data: activeHangCheck } = await supabase
    .from("hangs")
    .select("visibility")
    .eq("status", "active");

  const publicActiveHangs = (activeHangCheck ?? []).filter((h) => h.visibility === "public").length;
  const totalActiveHangs = (activeHangCheck ?? []).length;
  console.log(`\nActive hangs:            ${totalActiveHangs} total, ${publicActiveHangs} public`);

  if (publicActiveHangs === totalActiveHangs && totalActiveHangs > 0) {
    console.log("PASS: All active hangs are visible to anonymous users.");
  } else if (totalActiveHangs === 0) {
    console.warn("WARN: No active hangs found. Run seed-social-proof.ts to create them.");
  } else {
    console.warn(`WARN: ${totalActiveHangs - publicActiveHangs} active hangs still have non-public visibility.`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
