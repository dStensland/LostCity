import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

/**
 * Elevation Readiness Audit Script
 *
 * Audits how many events qualify for Hero and Featured tiers over the next 14 days,
 * checks image coverage, and optionally backfills `importance` on deserving events.
 *
 * Tier definitions:
 *   Hero:     importance='flagship' OR is_tentpole=true OR festival_id IS NOT NULL
 *   Featured: importance='major' OR featured_blurb IS NOT NULL OR venue has editorial_mentions
 *   Standard: everything else
 *
 * Run with:   npx tsx scripts/audit-elevation-readiness.ts
 * Backfill:   npx tsx scripts/audit-elevation-readiness.ts --backfill
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
// Date helpers
// ============================================================================

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function twoWeeksOut(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

function pct(count: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

// ============================================================================
// Audit
// ============================================================================

async function audit() {
  const start = today();
  const end = twoWeeksOut();

  // ── Fetch all active events in the next 14 days ───────────────────────────
  // We need: id, importance, is_tentpole, festival_id, featured_blurb,
  //          image_url, venue_id, and the venue's image_url
  // Supabase JS doesn't support raw subqueries so we fetch events + venues
  // separately to avoid N+1 and then join in memory.

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select(
      "id, importance, is_tentpole, festival_id, featured_blurb, image_url, venue_id"
    )
    .gte("start_date", start)
    .lte("start_date", end)
    .eq("is_active", true);

  if (eventsError) {
    console.error("Error fetching events:", eventsError.message);
    process.exit(1);
  }

  const allEvents = events ?? [];
  const totalActive = allEvents.length;

  // ── Fetch venues that have at least one upcoming event ────────────────────
  const venueIds = [...new Set(allEvents.map((e) => e.venue_id).filter(Boolean))] as number[];

  // Venue image map
  const venueImageMap = new Map<number, string | null>();
  // Venue editorial mention map (venue_id → count)
  const venueEditorialMap = new Map<number, number>();

  if (venueIds.length > 0) {
    // Fetch venue images in batches of 500 to avoid query length limits
    const batchSize = 500;
    for (let i = 0; i < venueIds.length; i += batchSize) {
      const batch = venueIds.slice(i, i + batchSize);
      const { data: venueRows, error: venuesError } = await supabase
        .from("venues")
        .select("id, image_url")
        .in("id", batch);

      if (venuesError) {
        console.error("Error fetching venues:", venuesError.message);
        process.exit(1);
      }

      for (const v of venueRows ?? []) {
        venueImageMap.set(v.id, v.image_url ?? null);
      }
    }

    // Fetch editorial mentions for these venues
    const { data: mentions, error: mentionsError } = await supabase
      .from("editorial_mentions")
      .select("venue_id")
      .in("venue_id", venueIds)
      .eq("is_active", true);

    if (mentionsError) {
      console.error("Error fetching editorial mentions:", mentionsError.message);
      process.exit(1);
    }

    for (const m of mentions ?? []) {
      if (m.venue_id != null) {
        venueEditorialMap.set(m.venue_id, (venueEditorialMap.get(m.venue_id) ?? 0) + 1);
      }
    }
  }

  // ── Compute tier sets ─────────────────────────────────────────────────────

  const heroEvents = allEvents.filter(
    (e) =>
      e.importance === "flagship" ||
      e.is_tentpole === true ||
      e.festival_id != null
  );

  const featuredEvents = allEvents.filter(
    (e) =>
      !heroEvents.some((h) => h.id === e.id) && // exclude hero-tier
      (e.importance === "major" ||
        e.featured_blurb != null ||
        (e.venue_id != null && (venueEditorialMap.get(e.venue_id) ?? 0) > 0))
  );

  const standardEvents = allEvents.filter(
    (e) =>
      !heroEvents.some((h) => h.id === e.id) &&
      !featuredEvents.some((f) => f.id === e.id)
  );

  // ── Hero tier breakdown ───────────────────────────────────────────────────

  const flagshipCount = allEvents.filter((e) => e.importance === "flagship").length;
  const tentpoleCount = allEvents.filter((e) => e.is_tentpole === true).length;
  const festivalCount = allEvents.filter((e) => e.festival_id != null).length;
  const heroTotal = heroEvents.length;

  const heroWithEventImage = heroEvents.filter((e) => e.image_url).length;
  const heroWithVenueImage = heroEvents.filter(
    (e) => !e.image_url && e.venue_id != null && venueImageMap.get(e.venue_id)
  ).length;
  const heroWithAnyImage = heroWithEventImage + heroWithVenueImage;

  // ── Featured tier breakdown ───────────────────────────────────────────────

  const majorCount = allEvents.filter((e) => e.importance === "major").length;
  const withFeaturedBlurb = allEvents.filter((e) => e.featured_blurb != null).length;
  const venuesWithEditorial = venueEditorialMap.size;
  const eventsAtEditorialVenues = allEvents.filter(
    (e) => e.venue_id != null && (venueEditorialMap.get(e.venue_id) ?? 0) > 0
  ).length;
  const featuredTotal = featuredEvents.length;

  // ── Image coverage across all events ─────────────────────────────────────

  const withEventImage = allEvents.filter((e) => e.image_url).length;
  const withVenueImageFallback = allEvents.filter(
    (e) => !e.image_url && e.venue_id != null && venueImageMap.get(e.venue_id)
  ).length;
  const noImage = totalActive - withEventImage - withVenueImageFallback;

  // ── Print report ──────────────────────────────────────────────────────────

  console.log(`\nELEVATION READINESS AUDIT — ${start} to ${end}`);
  console.log("=".repeat(60));

  console.log(`\nHERO TIER READINESS:`);
  console.log(`  Events with importance='flagship': ${flagshipCount}`);
  console.log(`  Events with is_tentpole=true:      ${tentpoleCount}`);
  console.log(`  Events with festival_id set:       ${festivalCount}`);
  console.log(`  Hero-eligible total (union):       ${heroTotal}`);
  console.log(`  Of those, with image_url:          ${heroWithEventImage} (${pct(heroWithEventImage, heroTotal)})`);
  console.log(`  Of those, with venue.image_url:    ${heroWithVenueImage} (${pct(heroWithVenueImage, heroTotal)})`);
  console.log(`  Hero with any image:               ${heroWithAnyImage} (${pct(heroWithAnyImage, heroTotal)})`);

  console.log(`\nFEATURED TIER READINESS:`);
  console.log(`  Events with importance='major':    ${majorCount}`);
  console.log(`  Events with featured_blurb:        ${withFeaturedBlurb}`);
  console.log(`  Venues with editorial_mentions:    ${venuesWithEditorial}`);
  console.log(`  Events at editorial-mentioned venues: ${eventsAtEditorialVenues}`);
  console.log(`  Featured-eligible total:           ${featuredTotal}`);

  console.log(`\nIMAGE COVERAGE (next 2 weeks):`);
  console.log(`  Total active events:               ${totalActive}`);
  console.log(`  With image_url:                    ${withEventImage} (${pct(withEventImage, totalActive)})`);
  console.log(`  With venue image_url (fallback):   ${withVenueImageFallback} (${pct(withVenueImageFallback, totalActive)})`);
  console.log(`  No image at all:                   ${noImage} (${pct(noImage, totalActive)})`);

  console.log(`\nSTANDARD TIER:`);
  console.log(`  Events with no hero/featured signals: ${standardEvents.length}`);

  console.log();

  return { heroWithAnyImage, heroTotal, allEvents, venueEditorialMap, venueImageMap };
}

// ============================================================================
// Backfill
// ============================================================================

async function backfill() {
  const { heroWithAnyImage, allEvents, venueEditorialMap, venueImageMap } = await audit();

  console.log("BACKFILL MODE");
  console.log("=".repeat(60));

  if (heroWithAnyImage >= 10) {
    console.log(`\nHero tier already has ${heroWithAnyImage} events with images — no flagship backfill needed.`);
  }

  // ── Flagship candidates ───────────────────────────────────────────────────
  // Priority:
  //   1. is_tentpole=true but importance is still 'standard'
  //   2. festival_id set but importance is 'standard'
  // These are the clearest signals — the event was already tagged, just
  // the importance column wasn't backfilled yet.

  const flagshipCandidates = allEvents.filter(
    (e) =>
      e.importance === "standard" &&
      (e.is_tentpole === true || e.festival_id != null)
  );

  let flagshipSet = 0;

  if (flagshipCandidates.length > 0) {
    console.log(
      `\nFound ${flagshipCandidates.length} events with is_tentpole or festival_id but importance='standard' — promoting to 'flagship'`
    );

    const ids = flagshipCandidates.map((e) => e.id);
    const { error } = await supabase
      .from("events")
      .update({ importance: "flagship" } as never)
      .in("id", ids)
      .eq("importance", "standard"); // idempotency guard

    if (error) {
      console.error("  Error promoting to flagship:", error.message);
    } else {
      flagshipSet = ids.length;
      console.log(`  Set to 'flagship': ${flagshipSet} events`);
      flagshipCandidates.slice(0, 10).forEach((e) => {
        const signal = e.is_tentpole ? "is_tentpole" : `festival_id=${e.festival_id}`;
        console.log(`    - id=${e.id} [${signal}] image=${e.image_url ? "yes" : "no"}`);
      });
      if (flagshipCandidates.length > 10) {
        console.log(`    ... and ${flagshipCandidates.length - 10} more`);
      }
    }
  } else {
    console.log("\nNo is_tentpole/festival_id events need flagship promotion.");
  }

  // ── Major candidates ──────────────────────────────────────────────────────
  // Priority:
  //   1. Events at venues with editorial mentions (importance='standard', no existing signal)
  //   2. Events with featured_blurb but importance='standard'
  //   3. Events with image_url at well-known venues (image + editorial signal = notable)
  //
  // Cap at 50 to avoid over-inflating the tier. Prefer events that have images.

  const alreadyElevated = new Set([
    ...allEvents.filter((e) => e.importance !== "standard").map((e) => e.id),
    ...flagshipCandidates.map((e) => e.id), // just promoted
  ]);

  type EventRow = {
    id: number;
    importance: string;
    is_tentpole: boolean;
    festival_id: string | null;
    featured_blurb: string | null;
    image_url: string | null;
    venue_id: number | null;
  };

  function score(e: EventRow): number {
    let s = 0;
    // Has featured_blurb is the strongest signal — explicitly written for this
    if (e.featured_blurb != null) s += 30;
    // Editorial venue is a strong proxy for quality
    if (e.venue_id != null && (venueEditorialMap.get(e.venue_id) ?? 0) > 0) s += 20;
    // Having an image makes it viable for display
    if (e.image_url) s += 10;
    // Venue has an image too (fallback)
    if (
      !e.image_url &&
      e.venue_id != null &&
      venueImageMap.get(e.venue_id)
    ) s += 5;
    return s;
  }

  const majorCandidates = allEvents
    .filter((e) => !alreadyElevated.has(e.id) && e.importance === "standard")
    .filter((e) => {
      // Must have at least one quality signal to qualify
      return (
        e.featured_blurb != null ||
        (e.venue_id != null && (venueEditorialMap.get(e.venue_id) ?? 0) > 0) ||
        e.image_url != null
      );
    })
    .sort((a, b) => score(b) - score(a))
    .slice(0, 50);

  let majorSet = 0;

  if (majorCandidates.length > 0) {
    console.log(
      `\nFound ${majorCandidates.length} events qualifying for 'major' importance`
    );

    const ids = majorCandidates.map((e) => e.id);
    const { error } = await supabase
      .from("events")
      .update({ importance: "major" } as never)
      .in("id", ids)
      .eq("importance", "standard"); // idempotency guard

    if (error) {
      console.error("  Error promoting to major:", error.message);
    } else {
      majorSet = ids.length;
      console.log(`  Set to 'major': ${majorSet} events`);
      majorCandidates.slice(0, 15).forEach((e) => {
        const signals: string[] = [];
        if (e.featured_blurb) signals.push("featured_blurb");
        if (e.venue_id && (venueEditorialMap.get(e.venue_id) ?? 0) > 0)
          signals.push(`editorial(${venueEditorialMap.get(e.venue_id)})`);
        if (e.image_url) signals.push("image");
        console.log(
          `    - id=${e.id} score=${score(e)} [${signals.join(", ")}]`
        );
      });
      if (majorCandidates.length > 15) {
        console.log(`    ... and ${majorCandidates.length - 15} more`);
      }
    }
  } else {
    console.log("\nNo events qualify for major importance backfill.");
  }

  console.log(`\nBACKFILL RESULTS:`);
  console.log(`  Set to 'flagship': ${flagshipSet} events`);
  console.log(`  Set to 'major':    ${majorSet} events`);
  console.log();
}

// ============================================================================
// Entry point
// ============================================================================

const isBackfill = process.argv.includes("--backfill");

if (isBackfill) {
  backfill().catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
} else {
  audit().catch((err) => {
    console.error("Audit failed:", err);
    process.exit(1);
  });
}
