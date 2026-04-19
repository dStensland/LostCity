/**
 * fix-social-visibility.ts
 *
 * Fixes social proof visibility: ensures seeded plans have visibility='public'
 * so that get_social_proof_counts can see them for anonymous users.
 *
 * In the plans model, visibility is stored on `plans.visibility` (not on
 * plan_invitees). This script flips plans with visibility='friends' to
 * 'public' for events that have 3+ attendees — so social proof is visible
 * to anonymous users.
 *
 * Also flips active hangs to visibility='public'.
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
  console.log("fix-social-visibility: patching plan and hang visibility");
  console.log(`Target: ${supabaseUrl}\n`);

  // ------------------------------------------------------------------
  // Step 1: Find event-anchor plans with visibility='friends'
  // Group by anchor_event_id to find events with 3+ attendees
  // ------------------------------------------------------------------
  process.stdout.write("Fetching friends-visibility event plans...");

  const { data: friendsPlans, error: fetchErr } = await supabase
    .from("plans")
    .select("id, anchor_event_id, visibility")
    .eq("anchor_type", "event")
    .eq("visibility", "friends");

  if (fetchErr) {
    console.error("\nFailed to fetch plans:", fetchErr.message);
    process.exit(1);
  }

  console.log(` done (${friendsPlans?.length ?? 0} friends-visibility plans found)`);
  const allFriendsPlans = friendsPlans ?? [];

  // ------------------------------------------------------------------
  // Step 2: Count total plans per event (public + friends)
  // ------------------------------------------------------------------
  process.stdout.write("Fetching public-visibility plans...");

  const { data: publicPlans, error: pubErr } = await supabase
    .from("plans")
    .select("id, anchor_event_id")
    .eq("anchor_type", "event")
    .eq("visibility", "public");

  if (pubErr) {
    console.error("\nFailed to fetch public plans:", pubErr.message);
    process.exit(1);
  }

  console.log(` done (${publicPlans?.length ?? 0} public plans found)`);

  // Build map: event_id -> public count
  const publicCountByEvent = new Map<number, number>();
  for (const p of publicPlans ?? []) {
    const eid = p.anchor_event_id as number;
    publicCountByEvent.set(eid, (publicCountByEvent.get(eid) ?? 0) + 1);
  }

  // Build map: event_id -> friends plan IDs
  const friendsIdsByEvent = new Map<number, string[]>();
  for (const p of allFriendsPlans) {
    const eid = p.anchor_event_id as number;
    const existing = friendsIdsByEvent.get(eid) ?? [];
    existing.push(p.id as string);
    friendsIdsByEvent.set(eid, existing);
  }

  // ------------------------------------------------------------------
  // Step 3: Determine which plan IDs to flip to public
  // Strategy: events with 3+ total plans get at least 3 public;
  //           events with 1-2 total get at least 1 public.
  // ------------------------------------------------------------------
  const idsToFlip: string[] = [];

  for (const [eventId, friendsIds] of friendsIdsByEvent) {
    const publicCount = publicCountByEvent.get(eventId) ?? 0;
    const totalCount = publicCount + friendsIds.length;
    if (totalCount === 0) continue;

    const publicTarget = totalCount >= 3 ? 3 : 1;
    const needed = Math.max(0, publicTarget - publicCount);
    if (needed === 0) continue;

    const shuffled = [...friendsIds].sort(() => Math.random() - 0.5);
    idsToFlip.push(...shuffled.slice(0, Math.min(needed, friendsIds.length)));
  }

  const eventsTargeted = [...friendsIdsByEvent.keys()].filter((id) => {
    const pub = publicCountByEvent.get(id) ?? 0;
    const tot = pub + (friendsIdsByEvent.get(id)?.length ?? 0);
    return tot >= 3;
  }).length;

  console.log(`\nPlan flip plan:`);
  console.log(`  Events with 3+ total plans: ${eventsTargeted}`);
  console.log(`  friends-visibility plans to flip to public: ${idsToFlip.length}`);

  if (idsToFlip.length === 0) {
    console.log("  Nothing to flip — visibility may already be correct.");
  } else {
    process.stdout.write(`\nUpdating ${idsToFlip.length} plans to public...`);

    const BATCH_SIZE = 100;
    let flipped = 0;
    let failCount = 0;

    for (let i = 0; i < idsToFlip.length; i += BATCH_SIZE) {
      const batch = idsToFlip.slice(i, i + BATCH_SIZE);
      const { error: updateErr } = await supabase
        .from("plans")
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
  // Step 4: Flip active hangs to public
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
  // Step 5: Verify
  // ------------------------------------------------------------------
  console.log("\n--- Verification ---");

  const { data: verifyData, error: verifyErr } = await supabase
    .from("plans")
    .select("anchor_event_id, visibility")
    .eq("anchor_type", "event");

  if (verifyErr) {
    console.error("Verification query failed:", verifyErr.message);
    process.exit(1);
  }

  const publicByEvent = new Map<number, number>();
  const friendsByEvent = new Map<number, number>();
  let totalPublic = 0;
  let totalFriends = 0;

  for (const p of verifyData ?? []) {
    const eid = p.anchor_event_id as number;
    if (p.visibility === "public") {
      publicByEvent.set(eid, (publicByEvent.get(eid) ?? 0) + 1);
      totalPublic++;
    } else if (p.visibility === "friends") {
      friendsByEvent.set(eid, (friendsByEvent.get(eid) ?? 0) + 1);
      totalFriends++;
    }
  }

  const totalPlans = totalPublic + totalFriends;
  const eventsWith3PlusPublic = [...publicByEvent.entries()].filter(([, count]) => count >= 3).length;
  const eventsWith1PlusPublic = [...publicByEvent.entries()].filter(([, count]) => count >= 1).length;

  const publicPct = totalPlans > 0 ? ((totalPublic / totalPlans) * 100).toFixed(1) : "0";
  const friendsPct = totalPlans > 0 ? ((totalFriends / totalPlans) * 100).toFixed(1) : "0";

  console.log(`Total plans (event-anchor): ${totalPlans}`);
  console.log(`  public:              ${totalPublic} (${publicPct}%)`);
  console.log(`  friends:             ${totalFriends} (${friendsPct}%)`);
  console.log(`Events with 1+ public plans: ${eventsWith1PlusPublic}`);
  console.log(`Events with 3+ public plans: ${eventsWith3PlusPublic}  (target: 30+)`);

  if (eventsWith3PlusPublic >= 30) {
    console.log("\nPASS: 30+ events have visible social proof for anonymous users.");
  } else {
    console.warn(`\nWARN: Only ${eventsWith3PlusPublic} events have 3+ public plans. Target is 30.`);
    console.warn("      Consider running seed-social-proof.ts with --clean first, then re-running this script.");
  }

  // Verify active hangs visibility
  const { data: activeHangCheck } = await supabase
    .from("hangs")
    .select("visibility")
    .eq("status", "active");

  const publicActiveHangs = (activeHangCheck ?? []).filter((h) => h.visibility === "public").length;
  const totalActiveHangs = (activeHangCheck ?? []).length;
  console.log(`\nActive hangs: ${totalActiveHangs} total, ${publicActiveHangs} public`);

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
