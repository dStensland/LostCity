import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * Seed RSVPs for existing persona users.
 *
 * Looks up persona profiles by username, finds upcoming events matching
 * their categories, and creates RSVPs with going/interested distribution.
 *
 * Run with: npx tsx scripts/seed-rsvps.ts
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
  categories: string[];
  activity_level: "power" | "regular" | "casual";
}

const founder = personasData.founder;
const personas: Persona[] = personasData.personas;

const RSVP_COUNTS: Record<string, number> = {
  power: 15,
  regular: 8,
  casual: 4,
};

const CATEGORY_MAP: Record<string, string> = {
  music: "music",
  art: "art",
  comedy: "comedy",
  theater: "theater",
  film: "film",
  sports: "sports",
  food: "food_drink",
  food_drink: "food_drink",
  nightlife: "nightlife",
  community: "community",
  fitness: "fitness",
  wellness: "fitness",
  family: "family",
  tech: "tech",
  networking: "tech",
  tours: "tours",
  history: "tours",
  games: "games",
  trivia: "games",
  outdoor: "outdoor",
  dance: "dance",
  pets: "family",
  gardening: "community",
  classes: "classes",
  beer: "food_drink",
  wine: "food_drink",
  bbq: "food_drink",
  brunch: "food_drink",
  markets: "food_drink",
  hiphop: "music",
};

async function getEventsForCategories(
  categories: string[],
  limit: number
): Promise<Array<{ id: number; category: string }>> {
  const mappedCategories = categories
    .map((c) => CATEGORY_MAP[c.toLowerCase()] || c)
    .filter((v, i, a) => a.indexOf(v) === i);

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("events")
    .select("id, category")
    .in("category", mappedCategories)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(limit * 3);

  if (error) {
    console.error("  Error fetching events:", error.message);
    return [];
  }

  // Shuffle and return requested number
  const shuffled = (data || []).sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

async function main() {
  console.log("Seeding RSVPs for existing persona users...\n");

  // Collect all persona usernames (including founder)
  const allPersonas: Persona[] = [
    {
      id: founder.id,
      username: founder.username,
      categories: founder.categories,
      activity_level: founder.activity_level,
    },
    ...personas,
  ];

  // Look up all profiles by username
  const usernames = allPersonas.map((p) => p.username);
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .in("username", usernames);

  if (profileError) {
    console.error("Error fetching profiles:", profileError.message);
    process.exit(1);
  }

  const usernameToId = new Map<string, string>();
  for (const p of profiles || []) {
    usernameToId.set(p.username, p.id);
  }

  console.log(`Found ${usernameToId.size} / ${allPersonas.length} persona profiles in DB\n`);

  // Clear existing RSVPs for seed users to avoid duplicates
  const seedUserIds = Array.from(usernameToId.values());
  if (seedUserIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("event_rsvps")
      .delete()
      .in("user_id", seedUserIds);

    if (deleteError) {
      console.error("Error clearing old RSVPs:", deleteError.message);
    } else {
      console.log("Cleared existing RSVPs for seed users");
    }
  }

  let totalRsvps = 0;
  let totalGoing = 0;
  let totalInterested = 0;

  for (const persona of allPersonas) {
    const userId = usernameToId.get(persona.username);
    if (!userId) {
      console.log(`  Skipping ${persona.username} (not found in DB)`);
      continue;
    }

    const rsvpCount = RSVP_COUNTS[persona.activity_level] || 5;
    const events = await getEventsForCategories(persona.categories, rsvpCount);

    if (events.length === 0) {
      console.log(`  ${persona.username}: no matching events found for [${persona.categories.join(", ")}]`);
      continue;
    }

    const rsvps = events.map((event, i) => {
      // Power users: all going. Others: 70% going, 30% interested
      const status =
        persona.activity_level === "power" || i < events.length * 0.7
          ? "going"
          : "interested";
      return {
        user_id: userId,
        event_id: event.id,
        status,
        visibility: "public",
      };
    });

    const goingCount = rsvps.filter((r) => r.status === "going").length;
    const interestedCount = rsvps.filter((r) => r.status === "interested").length;

    const { error } = await supabase.from("event_rsvps").insert(rsvps);
    if (error) {
      console.error(`  Error creating RSVPs for ${persona.username}:`, error.message);
    } else {
      totalRsvps += rsvps.length;
      totalGoing += goingCount;
      totalInterested += interestedCount;
      console.log(
        `  ${persona.username}: ${goingCount} going, ${interestedCount} interested (${persona.categories.slice(0, 3).join(", ")})`
      );
    }
  }

  console.log(`\nDone! Created ${totalRsvps} RSVPs (${totalGoing} going, ${totalInterested} interested)`);
}

main().catch(console.error);
