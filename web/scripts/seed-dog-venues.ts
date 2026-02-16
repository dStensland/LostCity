import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

/**
 * Dog Portal Data Seed Script
 *
 * Seeds the database with dog-relevant venue data for the ROMP portal.
 * Strategy: hybrid approach per PRD.
 *   1. Tag existing venues (breweries, parks, restaurants) with dog vibes
 *   2. Insert new venues for dog parks, pet services, shelters
 *   3. Tag existing outdoor/family events as dog-friendly
 *
 * Run with: npx tsx scripts/seed-dog-venues.ts
 * Dry run:  npx tsx scripts/seed-dog-venues.ts --dry-run
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Merge vibes without duplicates */
function mergeVibes(existing: string[] | null, newVibes: string[]): string[] {
  return [...new Set([...(existing || []), ...newVibes])];
}

let updatedCount = 0;
let insertedCount = 0;
let taggedEventsCount = 0;

/* ------------------------------------------------------------------ */
/*  Step 1: Tag existing venues by name or type                        */
/* ------------------------------------------------------------------ */

type VibeRule = {
  match: { nameContains?: string; nameExact?: string; slug?: string };
  addVibes: string[];
};

const EXISTING_VENUE_RULES: VibeRule[] = [
  // Known dog-friendly breweries
  { match: { nameContains: "Monday Night" }, addVibes: ["dog-friendly", "outdoor-only", "water-bowls"] },
  { match: { nameContains: "SweetWater Brew" }, addVibes: ["dog-friendly", "outdoor-only", "water-bowls"] },
  { match: { nameContains: "Orpheus" }, addVibes: ["dog-friendly", "outdoor-only"] },
  { match: { nameContains: "New Realm" }, addVibes: ["dog-friendly", "outdoor-only"] },
  { match: { nameContains: "Wild Heaven" }, addVibes: ["dog-friendly", "outdoor-only"] },
  { match: { nameContains: "Three Taverns" }, addVibes: ["dog-friendly", "outdoor-only"] },
  { match: { nameContains: "Reformation" }, addVibes: ["dog-friendly", "outdoor-only"] },
  { match: { nameContains: "Eventide" }, addVibes: ["dog-friendly", "outdoor-only"] },
  { match: { nameContains: "Slow Pour" }, addVibes: ["dog-friendly", "outdoor-only"] },
  { match: { nameContains: "Gate City" }, addVibes: ["dog-friendly", "outdoor-only"] },
  { match: { nameContains: "Scofflaw" }, addVibes: ["dog-friendly", "outdoor-only", "water-bowls"] },
  { match: { nameContains: "Pontoon" }, addVibes: ["dog-friendly", "outdoor-only"] },
  { match: { nameContains: "Tucker Brewing" }, addVibes: ["dog-friendly", "outdoor-only"] },

  // Known pup-cup spots
  { match: { nameContains: "Starbucks" }, addVibes: ["dog-friendly", "pup-cup"] },
  { match: { nameContains: "Shake Shack" }, addVibes: ["dog-friendly", "pup-cup", "dog-menu"] },

  // Known dog-friendly restaurants/cafes
  { match: { nameContains: "Park Tavern" }, addVibes: ["dog-friendly", "outdoor-only", "water-bowls"] },
  { match: { nameContains: "Ladybird" }, addVibes: ["dog-friendly", "outdoor-only", "water-bowls"] },

  // Parks that should be tagged
  { match: { nameContains: "Piedmont Park" }, addVibes: ["dog-friendly", "off-leash", "fenced", "water-bowls", "shade", "parking"] },
  { match: { nameContains: "Candler Park" }, addVibes: ["dog-friendly", "shade", "grass"] },
  { match: { nameContains: "Grant Park" }, addVibes: ["dog-friendly", "shade", "grass"] },
  { match: { nameContains: "Freedom Park" }, addVibes: ["dog-friendly", "off-leash", "grass", "shade"] },
  { match: { nameContains: "Chastain Park" }, addVibes: ["dog-friendly", "shade", "parking", "grass"] },
  { match: { nameContains: "Morningside" }, addVibes: ["dog-friendly", "shade", "grass"] },

  // BeltLine
  { match: { nameContains: "BeltLine" }, addVibes: ["dog-friendly", "paved", "shade", "leash-required"] },
];

async function tagExistingVenues() {
  console.log("\n--- Step 1: Tagging existing venues ---");

  for (const rule of EXISTING_VENUE_RULES) {
    let query = supabase
      .from("venues")
      .select("id, name, vibes")
      .eq("active", true);

    if (rule.match.nameContains) {
      query = query.ilike("name", `%${rule.match.nameContains}%`);
    } else if (rule.match.slug) {
      query = query.eq("slug", rule.match.slug);
    }

    const { data: venues, error } = await query;
    if (error) {
      console.error(`  Error querying for "${rule.match.nameContains || rule.match.slug}":`, error.message);
      continue;
    }

    if (!venues || venues.length === 0) continue;

    for (const v of venues) {
      const venue = v as { id: number; name: string; vibes: string[] | null };
      const merged = mergeVibes(venue.vibes, rule.addVibes);

      // Skip if no change
      if (venue.vibes && merged.length === venue.vibes.length) continue;

      console.log(`  ${venue.name}: +${rule.addVibes.join(", ")}`);

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from("venues")
          .update({ vibes: merged } as never)
          .eq("id", venue.id);

        if (updateError) {
          console.error(`    Error updating ${venue.name}:`, updateError.message);
        } else {
          updatedCount++;
        }
      } else {
        updatedCount++;
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Step 2: Bulk-tag parks as dog-friendly                             */
/* ------------------------------------------------------------------ */

async function tagParksAsDogFriendly() {
  console.log("\n--- Step 2: Tagging all parks as dog-friendly ---");

  const { data: parks, error } = await supabase
    .from("venues")
    .select("id, name, vibes")
    .eq("venue_type", "park")
    .eq("active", true);

  if (error || !parks) {
    console.error("  Error fetching parks:", error?.message);
    return;
  }

  let count = 0;
  for (const p of parks) {
    const park = p as { id: number; name: string; vibes: string[] | null };
    if (park.vibes?.includes("dog-friendly")) continue;

    const merged = mergeVibes(park.vibes, ["dog-friendly"]);

    if (!DRY_RUN) {
      await supabase
        .from("venues")
        .update({ vibes: merged } as never)
        .eq("id", park.id);
    }
    count++;
    updatedCount++;
  }

  console.log(`  Tagged ${count} parks as dog-friendly`);
}

/* ------------------------------------------------------------------ */
/*  Step 3: Insert new dog-specific venues                             */
/* ------------------------------------------------------------------ */

type NewVenue = {
  name: string;
  address: string;
  neighborhood: string;
  venue_type: string;
  vibes: string[];
  short_description: string;
  website?: string;
  city?: string;
  state?: string;
};

const NEW_VENUES: NewVenue[] = [
  // Dog Parks
  {
    name: "Piedmont Park Dog Park",
    address: "1071 Piedmont Ave NE",
    neighborhood: "Midtown",
    venue_type: "dog_park",
    vibes: ["dog-friendly", "off-leash", "fenced", "water-bowls", "shade", "small-dog-area", "large-dog-area", "parking", "grass"],
    short_description: "Atlanta's most popular off-leash dog park with separate areas for large and small dogs.",
    website: "https://piedmontpark.org",
  },
  {
    name: "Fetch Dog Park & Bar",
    address: "3300 Holcomb Bridge Rd",
    neighborhood: "Buckhead",
    venue_type: "dog_park",
    vibes: ["dog-friendly", "off-leash", "fenced", "water-bowls", "shade", "small-dog-area", "large-dog-area", "treats-available", "parking", "grass"],
    short_description: "Dog park + bar combo with indoor and outdoor off-leash areas. Memberships available.",
    website: "https://fetchparkbar.com",
  },
  {
    name: "Brook Run Dog Park",
    address: "4770 N Peachtree Rd",
    neighborhood: "Dunwoody",
    venue_type: "dog_park",
    vibes: ["dog-friendly", "off-leash", "fenced", "water-bowls", "shade", "large-dog-area", "agility-equipment", "parking", "grass"],
    short_description: "Large off-leash area with agility equipment inside Brook Run Park.",
  },
  {
    name: "Newtown Dream Dog Park",
    address: "3150 Old Olympic Pkwy",
    neighborhood: "Decatur",
    venue_type: "dog_park",
    vibes: ["dog-friendly", "off-leash", "fenced", "water-bowls", "shade", "small-dog-area", "parking", "grass"],
    short_description: "Community dog park with separate small and large dog areas.",
  },
  {
    name: "Mason Mill Dog Park",
    address: "1340 McConnell Dr",
    neighborhood: "Decatur",
    venue_type: "dog_park",
    vibes: ["dog-friendly", "off-leash", "fenced", "water-bowls", "shade", "parking", "grass", "dirt-trail"],
    short_description: "Beloved off-leash area with trails and a creek for dogs to splash in.",
  },
  {
    name: "Freedom Park Off-Leash Area",
    address: "Freedom Pkwy NE & N Highland Ave",
    neighborhood: "Candler Park",
    venue_type: "dog_park",
    vibes: ["dog-friendly", "off-leash", "unfenced", "shade", "grass"],
    short_description: "Informal off-leash area popular with local dog owners along Freedom Parkway.",
  },
  {
    name: "Wagging Tail Dog Park",
    address: "395 Mount Vernon Hwy NE",
    neighborhood: "Sandy Springs",
    venue_type: "dog_park",
    vibes: ["dog-friendly", "off-leash", "fenced", "water-bowls", "shade", "small-dog-area", "large-dog-area", "parking", "grass"],
    short_description: "Sandy Springs off-leash dog park with separate areas and water stations.",
  },

  // Trails
  {
    name: "Chattahoochee River Trail - Cochran Shoals",
    address: "1978 Columns Dr SE",
    neighborhood: "Vinings",
    venue_type: "trail",
    vibes: ["dog-friendly", "leash-required", "paved", "water-access", "shade", "parking"],
    short_description: "Popular 3-mile paved loop along the Chattahoochee. Dogs love the river access.",
    website: "https://www.nps.gov/chat",
  },
  {
    name: "Sweetwater Creek State Park",
    address: "1750 Mt Vernon Rd",
    neighborhood: "Lithia Springs",
    venue_type: "trail",
    vibes: ["dog-friendly", "leash-required", "dirt-trail", "water-access", "shade", "parking"],
    short_description: "Scenic trails through forest and along Sweetwater Creek. Dogs welcome on leash.",
    website: "https://gastateparks.org/sweetwatercreek",
  },
  {
    name: "Arabia Mountain Trail",
    address: "3787 Klondike Rd",
    neighborhood: "Lithonia",
    venue_type: "trail",
    vibes: ["dog-friendly", "leash-required", "paved", "shade", "parking"],
    short_description: "Unique granite outcrop landscape with paved multi-use PATH trail.",
  },
  {
    name: "Morningside Nature Preserve",
    address: "889 Wildwood Rd NE",
    neighborhood: "Virginia-Highland",
    venue_type: "trail",
    vibes: ["dog-friendly", "leash-required", "dirt-trail", "water-access", "shade"],
    short_description: "Hidden gem with creek trails and mature forest canopy. Popular with dog walkers.",
  },
  {
    name: "Cascade Springs Nature Preserve",
    address: "2852 Cascade Rd SW",
    neighborhood: "Southwest Atlanta",
    venue_type: "trail",
    vibes: ["dog-friendly", "leash-required", "dirt-trail", "water-access", "shade"],
    short_description: "Natural springs and waterfall trails in a 135-acre preserve.",
  },

  // Pet Services - Vets
  {
    name: "BluePearl Pet Hospital - Sandy Springs",
    address: "455 Abernathy Rd NE",
    neighborhood: "Sandy Springs",
    venue_type: "vet",
    vibes: ["emergency-vet"],
    short_description: "24/7 emergency and specialty veterinary care.",
    website: "https://bluepearlvet.com",
  },
  {
    name: "BluePearl Pet Hospital - Avondale",
    address: "1080 N Clarendon Ave",
    neighborhood: "Avondale Estates",
    venue_type: "vet",
    vibes: ["emergency-vet"],
    short_description: "Emergency vet care and specialty services.",
    website: "https://bluepearlvet.com",
  },
  {
    name: "Georgia Veterinary Specialists",
    address: "455 Abernathy Rd NE",
    neighborhood: "Sandy Springs",
    venue_type: "vet",
    vibes: ["emergency-vet"],
    short_description: "Specialty and emergency veterinary hospital.",
  },
  {
    name: "LifeLine Community Animal Hospital",
    address: "3180 Presidential Dr",
    neighborhood: "DeKalb County",
    venue_type: "vet",
    vibes: ["low-cost-vet", "vaccination"],
    short_description: "Affordable veterinary care and vaccination clinics.",
    website: "https://lifelineanimal.org",
  },
  {
    name: "PAWS Atlanta Clinic",
    address: "5287 Covington Hwy",
    neighborhood: "Decatur",
    venue_type: "vet",
    vibes: ["low-cost-vet", "vaccination", "adoption"],
    short_description: "Low-cost spay/neuter and wellness services.",
    website: "https://pawsatlanta.org",
  },

  // Groomers
  {
    name: "Hollywood Feed - Decatur",
    address: "2685 N Decatur Rd",
    neighborhood: "Decatur",
    venue_type: "groomer",
    vibes: ["grooming", "treats-available"],
    short_description: "Premium pet food and grooming services.",
    website: "https://hollywoodfeed.com",
  },
  {
    name: "Woof Gang Bakery & Grooming - Decatur",
    address: "314 W Ponce de Leon Ave",
    neighborhood: "Decatur",
    venue_type: "groomer",
    vibes: ["grooming", "treats-available", "pup-cup"],
    short_description: "Dog bakery, grooming, and gourmet treats.",
    website: "https://woofgangbakery.com",
  },
  {
    name: "Woof Gang Bakery & Grooming - Brookhaven",
    address: "4011 Peachtree Rd NE",
    neighborhood: "Brookhaven",
    venue_type: "groomer",
    vibes: ["grooming", "treats-available", "pup-cup"],
    short_description: "Dog bakery, grooming, and gourmet treats.",
    website: "https://woofgangbakery.com",
  },
  {
    name: "Doggie DoLittle",
    address: "591 Boulevard SE",
    neighborhood: "Grant Park",
    venue_type: "groomer",
    vibes: ["grooming"],
    short_description: "Local dog grooming in the heart of Grant Park.",
  },

  // Pet Stores
  {
    name: "The Natural Pet Market - Decatur",
    address: "2950 N Druid Hills Rd",
    neighborhood: "Decatur",
    venue_type: "pet_store",
    vibes: ["treats-available"],
    short_description: "Natural and holistic pet food, treats, and supplies.",
    website: "https://thenaturalpetmarket.com",
  },
  {
    name: "Bone Appetite",
    address: "469 Flat Shoals Ave SE",
    neighborhood: "East Atlanta",
    venue_type: "pet_store",
    vibes: ["treats-available", "pup-cup"],
    short_description: "Local pet boutique with fresh-baked treats and gourmet food.",
  },
  {
    name: "Dog City Bakery & Boutique",
    address: "887 Edgewood Ave NE",
    neighborhood: "Inman Park",
    venue_type: "pet_store",
    vibes: ["treats-available", "pup-cup", "dog-menu"],
    short_description: "Artisan dog bakery with custom cakes and all-natural treats.",
  },

  // Pet Daycare
  {
    name: "PupTown Lounge",
    address: "810 Juniper St NE",
    neighborhood: "Midtown",
    venue_type: "pet_daycare",
    vibes: ["daycare", "boarding", "grooming"],
    short_description: "Dog daycare, boarding, and grooming in Midtown.",
    website: "https://www.puppytownlounge.com",
  },
  {
    name: "Play Dog Play - Sandy Springs",
    address: "6490 Roswell Rd",
    neighborhood: "Sandy Springs",
    venue_type: "pet_daycare",
    vibes: ["daycare", "boarding"],
    short_description: "Cage-free dog daycare and overnight boarding.",
  },

  // Shelters & Rescues
  {
    name: "Atlanta Humane Society",
    address: "981 Howell Mill Rd NW",
    neighborhood: "Westside",
    venue_type: "animal_shelter",
    vibes: ["adoption", "low-cost-vet", "vaccination"],
    short_description: "Atlanta's leading animal welfare organization since 1873.",
    website: "https://atlantahumane.org",
  },
  {
    name: "Furkids Animal Rescue",
    address: "5235 Union Hill Rd",
    neighborhood: "Cumming",
    venue_type: "animal_shelter",
    vibes: ["adoption"],
    short_description: "Georgia's largest no-kill rescue and sheltering organization.",
    website: "https://furkids.org",
  },
  {
    name: "Angels Among Us Pet Rescue",
    address: "3200 Briarcliff Rd NE",
    neighborhood: "North Druid Hills",
    venue_type: "animal_shelter",
    vibes: ["adoption"],
    short_description: "Foster-based rescue dedicated to saving dogs and cats.",
    website: "https://angelsamongus.org",
  },
  {
    name: "Best Friends Atlanta",
    address: "4474 Lindbergh Dr NE",
    neighborhood: "Brookhaven",
    venue_type: "animal_shelter",
    vibes: ["adoption"],
    short_description: "Part of the national no-kill movement. Adoption events weekly.",
    website: "https://bestfriends.org/atlanta",
  },

  // Training Facilities
  {
    name: "Zoom Room - Midtown",
    address: "1009 Hemphill Ave NW",
    neighborhood: "Midtown",
    venue_type: "pet_daycare",
    vibes: ["training", "agility-equipment"],
    short_description: "Indoor gym for dogs with obedience, agility, and puppy classes.",
    website: "https://zoomroom.com",
  },
  {
    name: "Zoom Room - Decatur",
    address: "410 W Ponce de Leon Ave",
    neighborhood: "Decatur",
    venue_type: "pet_daycare",
    vibes: ["training", "agility-equipment"],
    short_description: "Indoor gym for dogs with obedience, agility, and puppy classes.",
    website: "https://zoomroom.com",
  },
  {
    name: "Who's Walking Who",
    address: "1186 N Highland Ave NE",
    neighborhood: "Virginia-Highland",
    venue_type: "pet_store",
    vibes: ["training", "treats-available"],
    short_description: "Dog training, premium pet food, and boutique accessories.",
  },
];

async function insertNewVenues() {
  console.log("\n--- Step 3: Inserting new dog venues ---");

  for (const venue of NEW_VENUES) {
    // Check if venue already exists by name (fuzzy)
    const { data: existing } = await supabase
      .from("venues")
      .select("id, name")
      .ilike("name", `%${venue.name.split(" - ")[0].split(" – ")[0].trim()}%`)
      .eq("active", true)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  SKIP (exists): ${venue.name} → matched "${(existing[0] as { name: string }).name}"`);

      // Still merge vibes
      const ex = existing[0] as { id: number; name: string; vibes?: string[] | null };
      const { data: full } = await supabase
        .from("venues")
        .select("vibes")
        .eq("id", ex.id)
        .single();

      if (full) {
        const merged = mergeVibes((full as { vibes: string[] | null }).vibes, venue.vibes);
        if (!DRY_RUN) {
          await supabase
            .from("venues")
            .update({ vibes: merged } as never)
            .eq("id", ex.id);
        }
        updatedCount++;
        console.log(`    Updated vibes: +${venue.vibes.join(", ")}`);
      }
      continue;
    }

    console.log(`  INSERT: ${venue.name} (${venue.venue_type})`);

    if (!DRY_RUN) {
      const { error } = await supabase.from("venues").insert({
        name: venue.name,
        slug: slugify(venue.name),
        address: venue.address,
        neighborhood: venue.neighborhood,
        city: venue.city || "Atlanta",
        state: venue.state || "GA",
        venue_type: venue.venue_type,
        vibes: venue.vibes,
        short_description: venue.short_description,
        website: venue.website || null,
        active: true,
      } as never);

      if (error) {
        console.error(`    Error inserting ${venue.name}:`, error.message);
      } else {
        insertedCount++;
      }
    } else {
      insertedCount++;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Step 4: Tag existing outdoor/family events                         */
/* ------------------------------------------------------------------ */

async function tagDogFriendlyEvents() {
  console.log("\n--- Step 4: Tagging dog-friendly events ---");

  const today = new Date().toISOString().split("T")[0];

  // Tag events at known dog-friendly venues
  const { data: dogVenues } = await supabase
    .from("venues")
    .select("id")
    .eq("active", true)
    .contains("vibes", ["dog-friendly"]);

  if (!dogVenues || dogVenues.length === 0) {
    console.log("  No dog-friendly venues found to match events against");
    return;
  }

  const venueIds = (dogVenues as { id: number }[]).map((v) => v.id);

  // Find upcoming events at those venues that don't already have dog tags
  const { data: events } = await supabase
    .from("events")
    .select("id, title, tags, venue_id")
    .in("venue_id", venueIds)
    .gte("start_date", today)
    .is("canonical_event_id", null);

  if (!events || events.length === 0) {
    console.log("  No events at dog-friendly venues to tag");
    return;
  }

  let count = 0;
  for (const e of events) {
    const event = e as { id: number; title: string; tags: string[] | null };
    if (event.tags?.includes("dog-friendly")) continue;

    const merged = mergeVibes(event.tags, ["dog-friendly"]);

    if (!DRY_RUN) {
      await supabase
        .from("events")
        .update({ tags: merged } as never)
        .eq("id", event.id);
    }
    count++;
    taggedEventsCount++;
  }

  console.log(`  Tagged ${count} events at dog-friendly venues`);

  // Also tag events with pet-related keywords in their titles
  // Use targeted queries to avoid false positives (hot dog, snarky puppy, dogwood, etc.)
  const { data: petEvents } = await supabase
    .from("events")
    .select("id, title, tags")
    .gte("start_date", today)
    .is("canonical_event_id", null)
    .or(
      "title.ilike.%dog adoption%,title.ilike.%dog park%,title.ilike.%puppy yoga%,title.ilike.%puppy love%,title.ilike.%yappy hour%,title.ilike.%bark in the%,title.ilike.%pet adoption%,title.ilike.%sweetbark%,title.ilike.%dog show%,title.ilike.%dog walk%,title.ilike.%kennel club%"
    );

  if (petEvents && petEvents.length > 0) {
    let petCount = 0;
    for (const e of petEvents) {
      const event = e as { id: number; title: string; tags: string[] | null };
      if (event.tags?.includes("dog-friendly")) continue;

      const titleLower = event.title.toLowerCase();
      const newTags = ["dog-friendly"];

      if (titleLower.includes("adopt") || titleLower.includes("rescue")) {
        newTags.push("adoption-event");
      }
      if (titleLower.includes("train") || titleLower.includes("obedience") || titleLower.includes("agility")) {
        newTags.push("dog-training");
      }
      if (titleLower.includes("yappy") || titleLower.includes("bark") || titleLower.includes("woof")) {
        newTags.push("dog-social");
      }

      const merged = mergeVibes(event.tags, newTags);

      if (!DRY_RUN) {
        await supabase
          .from("events")
          .update({ tags: merged } as never)
          .eq("id", event.id);
      }
      petCount++;
      taggedEventsCount++;
      console.log(`  Event: "${event.title}" +${newTags.join(", ")}`);
    }
    console.log(`  Tagged ${petCount} pet-related events by title`);
  }
}

/* ------------------------------------------------------------------ */
/*  Step 5: Tag breweries with outdoor seating as dog-friendly         */
/* ------------------------------------------------------------------ */

async function tagBreweriesAsDogFriendly() {
  console.log("\n--- Step 5: Tagging breweries/bars with outdoor seating ---");

  const { data: breweries } = await supabase
    .from("venues")
    .select("id, name, vibes")
    .eq("active", true)
    .in("venue_type", ["brewery", "bar", "taproom"])
    .contains("vibes", ["outdoor-seating"]);

  if (!breweries || breweries.length === 0) {
    console.log("  No breweries with outdoor-seating found to tag");
    return;
  }

  let count = 0;
  for (const b of breweries) {
    const brewery = b as { id: number; name: string; vibes: string[] | null };
    if (brewery.vibes?.includes("dog-friendly")) continue;

    const merged = mergeVibes(brewery.vibes, ["dog-friendly"]);

    if (!DRY_RUN) {
      await supabase
        .from("venues")
        .update({ vibes: merged } as never)
        .eq("id", brewery.id);
    }
    count++;
    updatedCount++;
    console.log(`  ${brewery.name}: +dog-friendly`);
  }

  console.log(`  Tagged ${count} breweries as dog-friendly`);
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\n🐕 Dog Portal Data Seed${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  await tagExistingVenues();
  await tagParksAsDogFriendly();
  await tagBreweriesAsDogFriendly();
  await insertNewVenues();
  await tagDogFriendlyEvents();

  console.log("\n--- Summary ---");
  console.log(`  Venues updated: ${updatedCount}`);
  console.log(`  Venues inserted: ${insertedCount}`);
  console.log(`  Events tagged: ${taggedEventsCount}`);
  console.log(`  Total changes: ${updatedCount + insertedCount + taggedEventsCount}`);

  if (DRY_RUN) {
    console.log("\n  (Dry run — no changes written to database)");
  }

  console.log("\n✅ Done\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
