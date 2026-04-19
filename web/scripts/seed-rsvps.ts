import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * Seed RSVPs for existing persona users.
 *
 * Looks up persona profiles by username, finds upcoming events matching
 * their categories, and creates plans + plan_invitees rows (going only).
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
  fitness: "exercise",
  wellness: "exercise",
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
): Promise<Array<{ id: number; category_id: string; portal_id: string | null; start_date: string }>> {
  const mappedCategories = categories
    .map((c) => CATEGORY_MAP[c.toLowerCase()] || c)
    .filter((v, i, a) => a.indexOf(v) === i);

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("events")
    .select("id, category_id, portal_id, start_date")
    .in("category_id", mappedCategories)
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
  console.log("Seeding RSVPs (plans + plan_invitees) for existing persona users...\n");

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

  // Clear existing seed data by deleting plans created by seed users
  const seedUserIds = Array.from(usernameToId.values());
  if (seedUserIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("plans")
      .delete()
      .in("creator_id", seedUserIds)
      .eq("anchor_type", "event");

    if (deleteError) {
      console.error("Error clearing old plans:", deleteError.message);
    } else {
      console.log("Cleared existing event-anchor plans for seed users");
    }
  }

  let totalPlans = 0;

  for (const persona of allPersonas) {
    const userId = usernameToId.get(persona.username);
    if (!userId) {
      console.log(`  Skipping ${persona.username} (not found in DB)`);
      continue;
    }

    const rsvpCount = RSVP_COUNTS[persona.activity_level] || 5;
    // Only seed "going" — interested/went have no migration path
    const events = await getEventsForCategories(persona.categories, rsvpCount);

    if (events.length === 0) {
      console.log(`  ${persona.username}: no matching events found for [${persona.categories.join(", ")}]`);
      continue;
    }

    // Build plan rows — one plan per event
    const planRows = events.map((event) => ({
      creator_id: userId,
      portal_id: event.portal_id ?? null,
      anchor_type: "event" as const,
      anchor_event_id: event.id,
      starts_at: event.start_date,
      visibility: "friends",
    }));

    const { data: insertedPlans, error: planError } = await supabase
      .from("plans")
      .insert(planRows as never)
      .select("id");

    if (planError) {
      console.error(`  Error creating plans for ${persona.username}:`, planError.message);
      continue;
    }

    const planIds = (insertedPlans || []).map((p: { id: string }) => p.id);

    // Build plan_invitees rows
    const inviteeRows = planIds.map((planId: string) => ({
      plan_id: planId,
      user_id: userId,
      rsvp_status: "going",
      invited_by: userId,
      responded_at: new Date().toISOString(),
    }));

    const { error: inviteeError } = await supabase
      .from("plan_invitees")
      .insert(inviteeRows as never);

    if (inviteeError) {
      console.error(`  Error creating plan_invitees for ${persona.username}:`, inviteeError.message);
    } else {
      totalPlans += planIds.length;
      console.log(
        `  ${persona.username}: ${planIds.length} going plans (${persona.categories.slice(0, 3).join(", ")})`
      );
    }
  }

  console.log(`\nDone! Created ${totalPlans} plans (all going)`);
}

main().catch(console.error);
