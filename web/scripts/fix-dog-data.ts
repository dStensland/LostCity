import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

/**
 * Dog Portal Sprint 1: Emergency Data Fixes
 *
 * Fixes 5 critical data issues identified by the product audit:
 *   1. Pet service venues missing `dog-friendly` vibe (excluded from some queries)
 *   2. Adoption events mistagged (LifeLine has 17 events, only 1 tagged)
 *   3. Training events not tagged (0 in portal)
 *   4. Stone Mountain over-representation (59% of all dog events)
 *   5. Nashville venue contamination in Atlanta portal
 *
 * Run with: npx tsx scripts/fix-dog-data.ts
 * Dry run:  npx tsx scripts/fix-dog-data.ts --dry-run
 */

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const DRY_RUN = process.argv.includes("--dry-run");

function mergeVibes(existing: string[] | null, newVibes: string[]): string[] {
  return [...new Set([...(existing || []), ...newVibes])];
}

function removeVibes(existing: string[] | null, toRemove: string[]): string[] {
  if (!existing) return [];
  return existing.filter((v) => !toRemove.includes(v));
}

const today = new Date().toISOString().split("T")[0];

const stats = {
  petServicesTagged: 0,
  adoptionEventsTagged: 0,
  trainingEventsTagged: 0,
  stoneMtnUntagged: 0,
  nashvilleFiltered: 0,
};

/* ------------------------------------------------------------------ */
/*  Fix 1: Add dog-friendly vibe to pet service venues                 */
/* ------------------------------------------------------------------ */

async function fixPetServicesVibes() {
  console.log("\n--- Fix 1: Pet service venues → add dog-friendly vibe ---");

  const SERVICE_TYPES = ["vet", "groomer", "pet_store", "pet_daycare", "animal_shelter"];

  const { data: services } = await supabase
    .from("venues")
    .select("id, name, venue_type, vibes")
    .eq("active", true)
    .in("venue_type", SERVICE_TYPES);

  if (!services || services.length === 0) {
    console.log("  No pet service venues found");
    return;
  }

  console.log(`  Found ${services.length} pet service venues`);

  for (const s of services) {
    const venue = s as { id: number; name: string; venue_type: string; vibes: string[] | null };
    if (venue.vibes?.includes("dog-friendly")) {
      console.log(`  SKIP: ${venue.name} (already has dog-friendly)`);
      continue;
    }

    const merged = mergeVibes(venue.vibes, ["dog-friendly"]);

    if (!DRY_RUN) {
      await supabase
        .from("venues")
        .update({ vibes: merged } as never)
        .eq("id", venue.id);
    }

    stats.petServicesTagged++;
    console.log(`  +dog-friendly: ${venue.name} (${venue.venue_type})`);
  }

  console.log(`  Tagged ${stats.petServicesTagged} pet service venues`);
}

/* ------------------------------------------------------------------ */
/*  Fix 2: Tag adoption events from shelters + keyword matching        */
/* ------------------------------------------------------------------ */

async function fixAdoptionEvents() {
  console.log("\n--- Fix 2: Tag adoption events ---");

  // Find all events with "adoption" in the title that lack adoption-event tag
  const { data: adoptionByTitle } = await supabase
    .from("events")
    .select("id, title, tags, source_id")
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .or(
      "title.ilike.%adoption%,title.ilike.%adopt a%,title.ilike.%rescue%puppy%,title.ilike.%pet adoption%,title.ilike.%dog adoption%,title.ilike.%cat adoption%,title.ilike.%kitten adoption%,title.ilike.%puppy adoption%,title.ilike.%adoption event%,title.ilike.%petsmart%adoption%,title.ilike.%petco%adoption%"
    );

  if (adoptionByTitle && adoptionByTitle.length > 0) {
    console.log(`  Found ${adoptionByTitle.length} events with adoption keywords in title`);

    for (const e of adoptionByTitle) {
      const event = e as { id: number; title: string; tags: string[] | null };
      if (event.tags?.includes("adoption-event")) continue;

      const newTags = ["dog-friendly", "adoption-event"];
      const merged = mergeVibes(event.tags, newTags);

      if (!DRY_RUN) {
        await supabase
          .from("events")
          .update({ tags: merged } as never)
          .eq("id", event.id);
      }

      stats.adoptionEventsTagged++;
      console.log(`  +adoption-event: "${event.title}"`);
    }
  }

  // Also find events from shelter/rescue sources
  const { data: shelterSources } = await supabase
    .from("sources")
    .select("id, name")
    .or(
      "name.ilike.%lifeline%,name.ilike.%humane%,name.ilike.%paws%,name.ilike.%furkids%,name.ilike.%angels among%,name.ilike.%best friends%,name.ilike.%rescue%"
    );

  if (shelterSources && shelterSources.length > 0) {
    const sourceIds = (shelterSources as { id: number; name: string }[]).map((s) => s.id);
    const sourceNames = (shelterSources as { id: number; name: string }[]).map((s) => s.name);
    console.log(`  Found shelter sources: ${sourceNames.join(", ")}`);

    const { data: shelterEvents } = await supabase
      .from("events")
      .select("id, title, tags")
      .gte("start_date", today)
      .is("canonical_event_id", null)
      .in("source_id", sourceIds);

    if (shelterEvents && shelterEvents.length > 0) {
      console.log(`  Found ${shelterEvents.length} events from shelter sources`);

      for (const e of shelterEvents) {
        const event = e as { id: number; title: string; tags: string[] | null };
        const titleLower = event.title.toLowerCase();

        // Determine specific tags based on title
        const newTags = ["dog-friendly"];

        if (
          titleLower.includes("adopt") ||
          titleLower.includes("rescue") ||
          titleLower.includes("foster") ||
          titleLower.includes("petsmart") ||
          titleLower.includes("petco")
        ) {
          newTags.push("adoption-event");
        }

        if (titleLower.includes("vaccin") || titleLower.includes("vaccine") || titleLower.includes("rabies")) {
          newTags.push("vaccination");
        }

        if (titleLower.includes("spay") || titleLower.includes("neuter")) {
          newTags.push("low-cost-vet");
        }

        // Only update if there are new tags to add
        const currentTags = event.tags || [];
        const merged = mergeVibes(currentTags, newTags);
        if (merged.length === currentTags.length) continue;

        if (!DRY_RUN) {
          await supabase
            .from("events")
            .update({ tags: merged } as never)
            .eq("id", event.id);
        }

        if (newTags.includes("adoption-event")) {
          stats.adoptionEventsTagged++;
          console.log(`  +adoption-event: "${event.title}"`);
        }
      }
    }
  }

  console.log(`  Total adoption events tagged: ${stats.adoptionEventsTagged}`);
}

/* ------------------------------------------------------------------ */
/*  Fix 3: Tag training events                                         */
/* ------------------------------------------------------------------ */

async function fixTrainingEvents() {
  console.log("\n--- Fix 3: Tag dog-specific events (training, puppy yoga, etc.) ---");

  // Search for specifically dog-related training/activity keywords
  // Note: generic "training" matches human events (soccer, volunteer), so we must be specific
  const { data: dogActivityEvents } = await supabase
    .from("events")
    .select("id, title, tags, is_class")
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .or(
      "title.ilike.%dog training%,title.ilike.%puppy class%,title.ilike.%puppy training%,title.ilike.%puppy yoga%,title.ilike.%puppy love%,title.ilike.%obedience class%,title.ilike.%agility class%,title.ilike.%canine training%,title.ilike.%dog obedience%,title.ilike.%puppy socialization%,title.ilike.%dog yoga%,title.ilike.%yappy hour%,title.ilike.%bark in the%,title.ilike.%bark at the%,title.ilike.%paws in the%,title.ilike.%paws at the%,title.ilike.%woof%"
    );

  if (dogActivityEvents && dogActivityEvents.length > 0) {
    console.log(`  Found ${dogActivityEvents.length} events with dog activity keywords`);

    // Filter out false positives
    const FALSE_POSITIVES = /snarky puppy|puppy prov|puppet|hot dog|corn dog|dogwood/i;

    for (const e of dogActivityEvents) {
      const event = e as { id: number; title: string; tags: string[] | null; is_class: boolean | null };

      if (FALSE_POSITIVES.test(event.title)) {
        console.log(`  SKIP (false positive): "${event.title}"`);
        continue;
      }

      const titleLower = event.title.toLowerCase();
      const newTags = ["dog-friendly"];

      if (titleLower.includes("train") || titleLower.includes("obedience") || titleLower.includes("agility")) {
        newTags.push("dog-training");
      }
      if (titleLower.includes("puppy")) newTags.push("puppy-class");
      if (titleLower.includes("agility")) newTags.push("agility");
      if (titleLower.includes("yappy") || titleLower.includes("bark") || titleLower.includes("woof")) {
        newTags.push("dog-social");
      }
      if (titleLower.includes("yoga")) newTags.push("dog-social");
      if (titleLower.includes("adopt") || titleLower.includes("rescue")) newTags.push("adoption-event");

      const merged = mergeVibes(event.tags, newTags);
      const isClass = event.is_class || titleLower.includes("class") || titleLower.includes("training");

      if (!DRY_RUN) {
        await supabase
          .from("events")
          .update({ tags: merged, is_class: isClass } as never)
          .eq("id", event.id);
      }

      stats.trainingEventsTagged++;
      console.log(`  +${newTags.filter(t => t !== "dog-friendly").join(", ")}: "${event.title}"`);
    }
  } else {
    console.log("  No dog activity events found by title keyword");
  }

  // NOTE: No dog training classes exist in the database. This is a crawler gap.
  // The training deep page will remain empty until we add crawlers for:
  //   - Zoom Room class schedules
  //   - PetSmart/Petco class calendars
  //   - Local trainer event pages
  console.log("  NOTE: No dedicated dog training classes found in DB — crawler gap");
  console.log(`  Total dog activity events tagged: ${stats.trainingEventsTagged}`);
}

/* ------------------------------------------------------------------ */
/*  Fix 4: Remove dog-friendly from generic Stone Mountain events      */
/* ------------------------------------------------------------------ */

async function fixStoneMountainOverTagging() {
  console.log("\n--- Fix 4: Stone Mountain over-tagging ---");

  // Find ALL Stone Mountain sources
  const { data: smSources } = await supabase
    .from("sources")
    .select("id, name")
    .ilike("name", "%stone mountain%");

  if (!smSources || smSources.length === 0) {
    console.log("  Stone Mountain source not found");
    return;
  }

  const sourceIds = (smSources as { id: number; name: string }[]).map((s) => s.id);
  const sourceNames = (smSources as { id: number; name: string }[]).map((s) => `${s.name} (id=${s.id})`);
  console.log(`  Found sources: ${sourceNames.join(", ")}`);

  // Get all Stone Mountain events tagged dog-friendly
  const { data: smEvents } = await supabase
    .from("events")
    .select("id, title, tags")
    .in("source_id", sourceIds)
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .contains("tags", ["dog-friendly"]);

  if (!smEvents || smEvents.length === 0) {
    console.log("  No dog-friendly events from Stone Mountain");
    return;
  }

  console.log(`  Found ${smEvents.length} Stone Mountain events with dog-friendly tag`);

  // Keep dog-friendly ONLY if the event title mentions dogs/pets
  const DOG_KEYWORDS = /\b(dog|puppy|pup|canine|pet[ -]friendly|bark|woof|leash|off.leash|adoption|rescue|shelter|k9|k-9)\b/i;

  let kept = 0;
  let removed = 0;

  for (const e of smEvents) {
    const event = e as { id: number; title: string; tags: string[] | null };

    if (DOG_KEYWORDS.test(event.title)) {
      kept++;
      console.log(`  KEEP: "${event.title}"`);
      continue;
    }

    // Remove dog-friendly tag
    const cleaned = removeVibes(event.tags, ["dog-friendly"]);

    if (!DRY_RUN) {
      await supabase
        .from("events")
        .update({ tags: cleaned } as never)
        .eq("id", event.id);
    }

    removed++;
    stats.stoneMtnUntagged++;
  }

  console.log(`  Kept ${kept}, removed dog-friendly from ${removed} events`);
}

/* ------------------------------------------------------------------ */
/*  Fix 5: Remove Nashville data from dog portal scope                 */
/* ------------------------------------------------------------------ */

async function fixNashvilleContamination() {
  console.log("\n--- Fix 5: Nashville data contamination ---");

  // Find venues with Nashville neighborhoods
  const NASHVILLE_NEIGHBORHOODS = [
    "Downtown Nashville",
    "East Nashville",
    "West Nashville",
    "Germantown",
    "Music Row",
    "The Gulch",
    "12 South",
    "Berry Hill",
    "Sylvan Park",
    "Marathon Village",
  ];

  const { data: nashVenues } = await supabase
    .from("venues")
    .select("id, name, neighborhood, city, vibes")
    .eq("active", true)
    .contains("vibes", ["dog-friendly"])
    .or(
      NASHVILLE_NEIGHBORHOODS.map((n) => `neighborhood.eq.${n}`).join(",")
    );

  if (!nashVenues || nashVenues.length === 0) {
    // Also try city-based filter
    const { data: nashByCity } = await supabase
      .from("venues")
      .select("id, name, neighborhood, city, vibes")
      .eq("active", true)
      .contains("vibes", ["dog-friendly"])
      .eq("city", "Nashville");

    if (nashByCity && nashByCity.length > 0) {
      console.log(`  Found ${nashByCity.length} Nashville venues by city field`);

      for (const v of nashByCity) {
        const venue = v as { id: number; name: string; neighborhood: string | null; city: string | null; vibes: string[] | null };

        // Remove dog-friendly tag from Nashville venues (so they don't appear in ATL dog portal)
        const cleaned = removeVibes(venue.vibes, ["dog-friendly"]);

        if (!DRY_RUN) {
          await supabase
            .from("venues")
            .update({ vibes: cleaned } as never)
            .eq("id", venue.id);
        }

        stats.nashvilleFiltered++;
        console.log(`  -dog-friendly: ${venue.name} (${venue.neighborhood || venue.city})`);
      }
    } else {
      console.log("  No Nashville venues found");
    }
    return;
  }

  console.log(`  Found ${nashVenues.length} Nashville venues by neighborhood`);

  for (const v of nashVenues) {
    const venue = v as { id: number; name: string; neighborhood: string | null; vibes: string[] | null };

    const cleaned = removeVibes(venue.vibes, ["dog-friendly"]);

    if (!DRY_RUN) {
      await supabase
        .from("venues")
        .update({ vibes: cleaned } as never)
        .eq("id", venue.id);
    }

    stats.nashvilleFiltered++;
    console.log(`  -dog-friendly: ${venue.name} (${venue.neighborhood})`);
  }

  console.log(`  Removed dog-friendly from ${stats.nashvilleFiltered} Nashville venues`);
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\n🔧 Dog Portal Sprint 1: Emergency Data Fixes${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  await fixPetServicesVibes();
  await fixAdoptionEvents();
  await fixTrainingEvents();
  await fixStoneMountainOverTagging();
  await fixNashvilleContamination();

  console.log("\n--- Summary ---");
  console.log(`  Pet services tagged:      ${stats.petServicesTagged}`);
  console.log(`  Adoption events tagged:   ${stats.adoptionEventsTagged}`);
  console.log(`  Training events tagged:   ${stats.trainingEventsTagged}`);
  console.log(`  Stone Mtn events cleaned: ${stats.stoneMtnUntagged}`);
  console.log(`  Nashville venues cleaned: ${stats.nashvilleFiltered}`);
  console.log(`  Total changes:            ${Object.values(stats).reduce((a, b) => a + b, 0)}`);

  if (DRY_RUN) {
    console.log("\n  (Dry run — no changes written to database)");
  }

  console.log("\n✅ Done\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
