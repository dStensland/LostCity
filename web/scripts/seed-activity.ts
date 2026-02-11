import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * Seed comprehensive activity for existing persona users.
 *
 * Refreshes RSVPs, recommendations (with notes), venue follows,
 * saved items, and activity feed entries — spread across the next 30 days
 * to create a natural-looking activity feed.
 *
 * Run with: npx tsx scripts/seed-activity.ts
 *
 * Prerequisites: Run seed-personas.ts first to create the user accounts.
 */

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Load personas
const personasPath = path.join(__dirname, "seed-personas.json");
const personasData = JSON.parse(fs.readFileSync(personasPath, "utf-8"));

interface Persona {
  id: string;
  username: string;
  name: string;
  categories: string[];
  vibes: string[];
  activity_level: "power" | "regular" | "casual";
  personality: string;
  recommended_venues?: string[];
  home_neighborhood: string;
  frequents: string[];
  lists?: Array<{
    title: string;
    description: string;
    venues: string[];
  }>;
}

const founder = personasData.founder;
const personas: Persona[] = personasData.personas;

// ─── Activity counts by level ───────────────────────────────────────────────

const RSVP_COUNTS: Record<string, number> = { power: 18, regular: 10, casual: 5 };
const FOLLOW_COUNTS: Record<string, number> = { power: 12, regular: 7, casual: 4 };
const REC_COUNTS: Record<string, number> = { power: 8, regular: 4, casual: 2 };
const SAVE_COUNTS: Record<string, number> = { power: 10, regular: 5, casual: 3 };

// ─── Category mapping (persona categories → DB categories) ──────────────────

const CATEGORY_MAP: Record<string, string> = {
  music: "music", art: "art", comedy: "comedy", theater: "theater",
  film: "film", sports: "sports", food: "food_drink", food_drink: "food_drink",
  nightlife: "nightlife", community: "community", fitness: "fitness",
  wellness: "fitness", family: "family", tech: "tech", networking: "tech",
  tours: "tours", history: "tours", games: "games", trivia: "games",
  outdoor: "outdoor", dance: "dance", pets: "family", gardening: "community",
  classes: "classes", beer: "food_drink", wine: "food_drink", bbq: "food_drink",
  brunch: "food_drink", markets: "food_drink", hiphop: "music", latin: "dance",
  dj: "nightlife", yoga: "fitness", running: "fitness", drag: "nightlife",
  pride: "community", halloween: "community", charity: "community",
  activism: "community", urban: "community", talks: "tech", startup: "tech",
  photography: "art", gallery: "art", vintage: "art", alternative: "music",
  classical: "music", festivals: "community", books: "community",
  cars: "sports", soccer: "sports", travel: "community", karaoke: "nightlife",
  meditation: "fitness", volunteer: "community",
};

// ─── Recommendation note templates by personality archetype ─────────────────

const NOTE_TEMPLATES: Record<string, string[]> = {
  music: [
    "The sound here is incredible. Don't miss it.",
    "Best live music spot in the neighborhood.",
    "If you haven't seen a show here yet, you're sleeping.",
    "The vibe is always right. Go on a weeknight for the real experience.",
    "Incredible acoustics and the booking is always on point.",
  ],
  food: [
    "Everything on the menu slaps. Trust me on the specials.",
    "This is the spot. Period.",
    "Come hungry, leave happy. Best in the city for what they do.",
    "The kind of place you bring people when you want to impress them.",
    "Hidden gem status. Tell your friends (or don't).",
  ],
  nightlife: [
    "The energy here is unmatched. Best night out in ATL.",
    "If you know, you know. Late night is the move.",
    "The bartenders are the best in the city. Fact.",
    "This place has soul. No pretense, just good times.",
    "Where the real ones go. Skip the velvet rope spots.",
  ],
  art: [
    "The exhibitions here are always thought-provoking.",
    "A must-visit for anyone who takes art seriously.",
    "One of the most important creative spaces in Atlanta.",
    "Every visit is different. That's the magic.",
    "Supporting local artists in the best possible way.",
  ],
  comedy: [
    "I've ugly-laughed here more times than I can count.",
    "The lineup is always stacked. Great open mics too.",
    "Best comedy room in Atlanta, hands down.",
    "Go on a Tuesday. The weeknight shows are underrated.",
  ],
  theater: [
    "World-class productions in an intimate setting.",
    "Every season they outdo themselves.",
    "The talent on this stage is unreal.",
    "Theater the way it should be experienced.",
  ],
  sports: [
    "Game day here hits different.",
    "The atmosphere is electric. Best watch party spot.",
    "A pilgrimage for any real fan.",
  ],
  outdoor: [
    "Best way to spend a morning in Atlanta.",
    "Nature therapy, 20 minutes from downtown.",
    "Bring water and good shoes. You'll thank me later.",
  ],
  wellness: [
    "The most peaceful place in the city.",
    "My weekly reset. Can't recommend enough.",
    "Leave your stress at the door. Literally.",
  ],
  games: [
    "Great selection and the vibes are always chill.",
    "Perfect for a group hangout. Bring competitive friends.",
    "The best arcade/game bar concept in the city.",
  ],
  beer: [
    "The taproom is always pouring something interesting.",
    "Best brewery vibes in ATL. Dog-friendly too.",
    "Come for the beer, stay for the people.",
  ],
  dance: [
    "The dance floor is always alive here.",
    "Best social dance night in the city.",
    "The music selection never misses.",
  ],
  film: [
    "The programming here is chef's kiss.",
    "A real cinema for real movie lovers.",
    "Skip the multiplex. This is the move.",
  ],
  community: [
    "This is what makes Atlanta special.",
    "A community institution. Support it.",
    "The kind of place that brings people together.",
  ],
  default: [
    "Highly recommend. You won't be disappointed.",
    "One of my favorite spots in Atlanta.",
    "Go here. Thank me later.",
    "A must-visit if you're in the area.",
    "The vibes are immaculate.",
  ],
};

// ─── Helper functions ───────────────────────────────────────────────────────

function mapCategories(categories: string[]): string[] {
  return categories
    .map((c) => CATEGORY_MAP[c.toLowerCase()] || c)
    .filter((v, i, a) => a.indexOf(v) === i);
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomFutureTimestamp(daysAhead: number = 30): string {
  const now = new Date();
  const offset = Math.random() * daysAhead * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + offset).toISOString();
}

function randomPastTimestamp(daysBack: number = 7): string {
  const now = new Date();
  const offset = Math.random() * daysBack * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString();
}

function getRecommendationNote(persona: Persona, venueCategories: string[]): string {
  // Pick the most relevant category for this persona
  const relevantCats = persona.categories.filter((c) =>
    NOTE_TEMPLATES[c.toLowerCase()]
  );

  let pool: string[];
  if (relevantCats.length > 0) {
    const cat = relevantCats[Math.floor(Math.random() * relevantCats.length)];
    pool = NOTE_TEMPLATES[cat.toLowerCase()] || NOTE_TEMPLATES.default;
  } else {
    pool = NOTE_TEMPLATES.default;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Venue slug lookup with caching ─────────────────────────────────────────

const venueCache = new Map<string, { id: number; name: string } | null>();

async function getVenueBySlug(
  slugHint: string
): Promise<{ id: number; name: string } | null> {
  if (venueCache.has(slugHint)) return venueCache.get(slugHint)!;

  // Try exact match
  const { data } = await supabase
    .from("venues")
    .select("id, name")
    .eq("slug", slugHint)
    .maybeSingle();

  if (data) {
    venueCache.set(slugHint, data);
    return data;
  }

  // Try common variations
  const variations = [
    slugHint.replace(/-/g, "_"),
    slugHint.replace(/_/g, "-"),
    `the-${slugHint}`,
    slugHint.replace(/^the-/, ""),
  ];

  for (const variant of variations) {
    const { data: varData } = await supabase
      .from("venues")
      .select("id, name")
      .ilike("slug", `%${variant}%`)
      .limit(1)
      .maybeSingle();

    if (varData) {
      venueCache.set(slugHint, varData);
      return varData;
    }
  }

  // Try name search
  const searchName = slugHint.replace(/-/g, " ").replace(/_/g, " ");
  const { data: nameData } = await supabase
    .from("venues")
    .select("id, name")
    .ilike("name", `%${searchName}%`)
    .limit(1)
    .maybeSingle();

  venueCache.set(slugHint, nameData || null);
  return nameData || null;
}

// ─── Org lookup ─────────────────────────────────────────────────────────────

async function getOrgsByCategories(
  categories: string[],
  limit: number
): Promise<Array<{ id: string; name: string }>> {
  const mapped = mapCategories(categories);

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .limit(limit * 2);

  if (error || !data) return [];

  return pickRandom(data, limit);
}

// ─── Main logic ─────────────────────────────────────────────────────────────

async function lookupProfiles(): Promise<Map<string, string>> {
  const allUsernames = [founder.username, ...personas.map((p: Persona) => p.username)];

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in("username", allUsernames);

  if (error) {
    console.error("Error fetching profiles:", error.message);
    process.exit(1);
  }

  const map = new Map<string, string>();
  for (const p of profiles || []) {
    map.set(p.username, p.id);
  }
  return map;
}

async function clearActivityData(userIds: string[]) {
  console.log("Clearing existing activity data for seed users...");

  // Clear in parallel for speed
  const [r1, r2, r3, r4, r5] = await Promise.all([
    supabase.from("event_rsvps").delete().in("user_id", userIds),
    supabase.from("recommendations").delete().in("user_id", userIds),
    supabase.from("saved_items").delete().in("user_id", userIds),
    supabase.from("activities").delete().in("user_id", userIds),
    supabase.from("follows").delete().in("follower_id", userIds).not("followed_user_id", "is", null).is("followed_venue_id", null),
  ]);

  // Clear venue follows separately (keep user follows intact)
  await supabase
    .from("follows")
    .delete()
    .in("follower_id", userIds)
    .not("followed_venue_id", "is", null);

  // Clear org follows
  await supabase
    .from("follows")
    .delete()
    .in("follower_id", userIds)
    .not("followed_organization_id", "is", null);

  console.log("  Cleared RSVPs, recommendations, saves, activities, venue/org follows");
}

async function getEventsForCategories(
  categories: string[],
  limit: number
): Promise<Array<{ id: number; category: string; start_date: string; title: string; venue_id: number | null }>> {
  const mapped = mapCategories(categories);
  const today = new Date().toISOString().split("T")[0];
  const monthFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("events")
    .select("id, category, start_date, title, venue_id")
    .in("category", mapped)
    .gte("start_date", today)
    .lte("start_date", monthFromNow)
    .order("start_date", { ascending: true })
    .limit(limit * 4);

  if (error) {
    console.error("  Error fetching events:", error.message);
    return [];
  }

  return pickRandom(data || [], limit);
}

async function seedRSVPs(
  allPersonas: Array<Persona & { userId: string }>
): Promise<number> {
  console.log("\nSeeding RSVPs...");
  let total = 0;

  for (const persona of allPersonas) {
    const count = RSVP_COUNTS[persona.activity_level] || 5;
    const events = await getEventsForCategories(persona.categories, count);

    if (events.length === 0) {
      console.log(`  ${persona.username}: no matching events`);
      continue;
    }

    const rsvps = events.map((event, i) => {
      const isGoing =
        persona.activity_level === "power" || i < events.length * 0.7;
      return {
        user_id: persona.userId,
        event_id: event.id,
        status: isGoing ? "going" : "interested",
        visibility: "public",
        created_at: randomPastTimestamp(5),
      };
    });

    const { error } = await supabase.from("event_rsvps").insert(rsvps);
    if (error) {
      console.error(`  ${persona.username} RSVPs error:`, error.message);
    } else {
      const going = rsvps.filter((r) => r.status === "going").length;
      const interested = rsvps.length - going;
      console.log(
        `  ${persona.username}: ${going} going, ${interested} interested`
      );
      total += rsvps.length;

      // Create activity entries for RSVPs
      const activities = rsvps.map((r) => ({
        user_id: persona.userId,
        activity_type: "rsvp",
        event_id: r.event_id,
        visibility: "public",
        metadata: { status: r.status },
        created_at: r.created_at,
      }));
      await supabase.from("activities").insert(activities);
    }
  }

  console.log(`  Total RSVPs: ${total}`);
  return total;
}

async function seedVenueFollows(
  allPersonas: Array<Persona & { userId: string }>
): Promise<number> {
  console.log("\nSeeding venue follows...");
  let total = 0;
  const notFound = new Set<string>();

  for (const persona of allPersonas) {
    const venueHints = persona.recommended_venues || [];
    const count = Math.min(
      FOLLOW_COUNTS[persona.activity_level] || 5,
      venueHints.length
    );
    const selected = pickRandom(venueHints, count);

    const follows: Array<Record<string, unknown>> = [];
    for (const hint of selected) {
      const venue = await getVenueBySlug(hint);
      if (venue) {
        follows.push({
          follower_id: persona.userId,
          followed_venue_id: venue.id,
          created_at: randomPastTimestamp(14),
        });
      } else {
        notFound.add(hint);
      }
    }

    if (follows.length > 0) {
      const { error } = await supabase.from("follows").insert(follows);
      if (error) {
        console.error(`  ${persona.username} follows error:`, error.message);
      } else {
        total += follows.length;
        console.log(`  ${persona.username}: following ${follows.length} venues`);

        // Activity entries
        const activities = follows.map((f) => ({
          user_id: persona.userId,
          activity_type: "follow_venue",
          venue_id: f.followed_venue_id,
          visibility: "public",
          created_at: f.created_at,
        }));
        await supabase.from("activities").insert(activities);
      }
    }
  }

  if (notFound.size > 0) {
    console.log(
      `  Venues not found: ${Array.from(notFound).slice(0, 8).join(", ")}${notFound.size > 8 ? ` (+${notFound.size - 8} more)` : ""}`
    );
  }

  console.log(`  Total venue follows: ${total}`);
  return total;
}

async function seedRecommendations(
  allPersonas: Array<Persona & { userId: string }>
): Promise<number> {
  console.log("\nSeeding recommendations with notes...");
  let total = 0;

  for (const persona of allPersonas) {
    const venueHints = persona.recommended_venues || [];
    const count = Math.min(
      REC_COUNTS[persona.activity_level] || 3,
      venueHints.length
    );
    const selected = pickRandom(venueHints, count);

    const recs: Array<Record<string, unknown>> = [];
    for (const hint of selected) {
      const venue = await getVenueBySlug(hint);
      if (venue) {
        recs.push({
          user_id: persona.userId,
          venue_id: venue.id,
          note: getRecommendationNote(persona, persona.categories),
          visibility: "public",
          created_at: randomPastTimestamp(10),
        });
      }
    }

    if (recs.length > 0) {
      const { error } = await supabase.from("recommendations").insert(recs);
      if (error) {
        console.error(`  ${persona.username} recs error:`, error.message);
      } else {
        total += recs.length;
        console.log(
          `  ${persona.username}: ${recs.length} recommendations`
        );

        // Activity entries
        const activities = recs.map((r) => ({
          user_id: persona.userId,
          activity_type: "recommendation",
          venue_id: r.venue_id,
          visibility: "public",
          metadata: { note: r.note },
          created_at: r.created_at,
        }));
        await supabase.from("activities").insert(activities);
      }
    }
  }

  console.log(`  Total recommendations: ${total}`);
  return total;
}

async function seedSaves(
  allPersonas: Array<Persona & { userId: string }>
): Promise<number> {
  console.log("\nSeeding saved items...");
  let total = 0;

  for (const persona of allPersonas) {
    const count = SAVE_COUNTS[persona.activity_level] || 3;

    // Save a mix of events and venues
    const eventCount = Math.ceil(count * 0.6);
    const venueCount = count - eventCount;

    // Save events
    const events = await getEventsForCategories(persona.categories, eventCount);
    const eventSaves = events.map((e) => ({
      user_id: persona.userId,
      event_id: e.id,
      created_at: randomPastTimestamp(7),
    }));

    // Save venues
    const venueHints = persona.recommended_venues || [];
    const venueSelection = pickRandom(venueHints, venueCount);
    const venueSaves: Array<Record<string, unknown>> = [];
    for (const hint of venueSelection) {
      const venue = await getVenueBySlug(hint);
      if (venue) {
        venueSaves.push({
          user_id: persona.userId,
          venue_id: venue.id,
          created_at: randomPastTimestamp(7),
        });
      }
    }

    const allSaves = [...eventSaves, ...venueSaves];
    if (allSaves.length > 0) {
      const { error } = await supabase.from("saved_items").insert(allSaves);
      if (error) {
        console.error(`  ${persona.username} saves error:`, error.message);
      } else {
        total += allSaves.length;
        console.log(
          `  ${persona.username}: ${eventSaves.length} events, ${venueSaves.length} venues saved`
        );

        // Activity entries for saves
        const activities = allSaves.map((s) => ({
          user_id: persona.userId,
          activity_type: "save",
          event_id: (s as { event_id?: number }).event_id || null,
          venue_id: (s as { venue_id?: number }).venue_id || null,
          visibility: "public",
          created_at: s.created_at,
        }));
        await supabase.from("activities").insert(activities);
      }
    }
  }

  console.log(`  Total saved items: ${total}`);
  return total;
}

async function seedOrgFollows(
  allPersonas: Array<Persona & { userId: string }>
): Promise<number> {
  console.log("\nSeeding organization follows...");

  // Get all orgs once
  const { data: allOrgs } = await supabase
    .from("organizations")
    .select("id, name, category");

  if (!allOrgs || allOrgs.length === 0) {
    console.log("  No organizations found in database");
    return 0;
  }

  let total = 0;

  for (const persona of allPersonas) {
    const mapped = mapCategories(persona.categories);

    // Find orgs matching their categories, or random ones
    const matchingOrgs = allOrgs.filter(
      (o) => o.category && mapped.includes(o.category)
    );
    const pool = matchingOrgs.length > 0 ? matchingOrgs : allOrgs;
    const count = Math.min(
      Math.ceil(FOLLOW_COUNTS[persona.activity_level] / 3),
      pool.length
    );
    const selected = pickRandom(pool, count);

    if (selected.length > 0) {
      const follows = selected.map((org) => ({
        follower_id: persona.userId,
        followed_organization_id: org.id,
        created_at: randomPastTimestamp(14),
      }));

      const { error } = await supabase.from("follows").insert(follows);
      if (error) {
        // Might fail on unique constraint — that's OK
        if (!error.message.includes("duplicate")) {
          console.error(`  ${persona.username} org follows error:`, error.message);
        }
      } else {
        total += follows.length;
      }
    }
  }

  console.log(`  Total org follows: ${total}`);
  return total;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== LostCity Activity Seeding ===\n");

  // 1. Look up existing profiles
  const usernameToId = await lookupProfiles();
  console.log(
    `Found ${usernameToId.size} / ${personas.length + 1} persona profiles in DB\n`
  );

  if (usernameToId.size === 0) {
    console.error("No persona profiles found. Run seed-personas.ts first.");
    process.exit(1);
  }

  // 2. Build enriched persona list
  const allPersonas: Array<Persona & { userId: string }> = [];

  // Founder
  const coachId = usernameToId.get(founder.username);
  if (coachId) {
    allPersonas.push({
      ...founder,
      userId: coachId,
    });
  }

  // Seed personas
  for (const p of personas) {
    const uid = usernameToId.get(p.username);
    if (uid) {
      allPersonas.push({ ...p, userId: uid });
    } else {
      console.log(`  Skipping ${p.username} (not in DB)`);
    }
  }

  console.log(`Processing ${allPersonas.length} personas\n`);

  // 3. Clear old activity data
  const userIds = allPersonas.map((p) => p.userId);
  await clearActivityData(userIds);

  // 4. Seed all activity types
  const rsvpCount = await seedRSVPs(allPersonas);
  const followCount = await seedVenueFollows(allPersonas);
  const orgFollowCount = await seedOrgFollows(allPersonas);
  const recCount = await seedRecommendations(allPersonas);
  const saveCount = await seedSaves(allPersonas);

  // 5. Summary
  console.log("\n=== Activity Seeding Complete ===");
  console.log(`  Personas: ${allPersonas.length}`);
  console.log(`  RSVPs: ${rsvpCount}`);
  console.log(`  Venue follows: ${followCount}`);
  console.log(`  Org follows: ${orgFollowCount}`);
  console.log(`  Recommendations: ${recCount}`);
  console.log(`  Saved items: ${saveCount}`);
  console.log(
    `  Total interactions: ${rsvpCount + followCount + orgFollowCount + recCount + saveCount}`
  );
}

main().catch(console.error);
