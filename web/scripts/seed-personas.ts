import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env.local
config({ path: ".env.local" });

/**
 * Persona Seeding Script
 *
 * Seeds the database with AI-controlled users for social proof and testing.
 * Run with: npx tsx scripts/seed-personas.ts
 *
 * Creates:
 * - 40+ seed user accounts with consistent personas
 * - Profiles with bios, locations, and preferences
 * - Mutual follows with @coach
 * - RSVPs based on persona interests
 * - Venue recommendations
 * - Lists for @coach
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Load personas from JSON file
const personasPath = path.join(__dirname, "seed-personas.json");
const personasData = JSON.parse(fs.readFileSync(personasPath, "utf-8"));

interface Persona {
  id: string;
  name: string;
  username: string;
  email?: string;
  bio: string;
  avatar_seed?: string;
  home_neighborhood: string;
  frequents: string[];
  categories: string[];
  vibes: string[];
  activity_level: "power" | "regular" | "casual";
  personality: string;
  recommended_venues?: string[];
  favorite_venues?: string[];
  lists?: Array<{
    title: string;
    description: string;
    venues: string[];
  }>;
}

interface FounderData extends Persona {
  favorite_categories?: Record<string, string[]>;
  sample_rsvps?: {
    description: string;
    patterns: string[];
  };
}

const founder: FounderData = personasData.founder;
const personas: Persona[] = personasData.personas;

// Activity level determines how many RSVPs each persona gets
const RSVP_COUNTS: Record<string, number> = {
  power: 15,
  regular: 8,
  casual: 4,
};

// Mapping from category/vibe names to database values
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
  latin: "dance",
  dj: "nightlife",
  yoga: "fitness",
  running: "fitness",
  drag: "nightlife",
  pride: "community",
  halloween: "community",
  charity: "community",
  activism: "community",
  urban: "community",
  talks: "tech",
  startup: "tech",
  photography: "art",
  gallery: "art",
  vintage: "art",
  alternative: "music",
  classical: "music",
  festivals: "community",
  books: "community",
  cars: "sports",
  soccer: "sports",
  travel: "community",
  karaoke: "nightlife",
  meditation: "fitness",
  volunteer: "community",
};

// Store created user IDs for later use
const createdUserIds: Map<string, string> = new Map();

async function findCoachUser(): Promise<string | null> {
  console.log("Looking for @coach user...");

  // Try to find coach by username in profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", "coach")
    .maybeSingle();

  if (profile) {
    console.log(`  Found @coach: ${profile.id}`);
    return profile.id;
  }

  // Try to find by email patterns
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const coachUser = authUsers?.users.find(
    (u) =>
      u.email?.includes("coach") ||
      u.user_metadata?.username === "coach" ||
      u.user_metadata?.display_name?.toLowerCase().includes("coach")
  );

  if (coachUser) {
    console.log(`  Found @coach via auth: ${coachUser.id}`);
    return coachUser.id;
  }

  console.log("  @coach not found - will create seed user instead");
  return null;
}

async function clearCoachSeedData(coachId: string | null) {
  if (!coachId) return;

  console.log("Clearing @coach's existing seed data...");

  // Clear follows from/to seed users (will be recreated)
  // Don't delete all coach follows - just ones with seed users
  const { data: seedProfiles } = await supabase
    .from("profiles")
    .select("id")
    .like("username", "seed-%");

  if (seedProfiles && seedProfiles.length > 0) {
    const seedIds = seedProfiles.map((p) => p.id);
    await supabase.from("follows").delete().eq("follower_id", coachId).in("followed_user_id", seedIds);
    await supabase.from("follows").delete().in("follower_id", seedIds).eq("followed_user_id", coachId);
  }

  // Clear coach's venue recommendations (so we can recreate fresh)
  await supabase.from("recommendations").delete().eq("user_id", coachId);

  // Clear coach's lists that match seed list names
  const seedListTitles = (founder.lists || []).map((l: { title: string }) => l.title);
  if (seedListTitles.length > 0) {
    const { data: existingLists } = await supabase
      .from("lists")
      .select("id")
      .eq("creator_id", coachId)
      .in("title", seedListTitles);

    if (existingLists) {
      for (const list of existingLists) {
        await supabase.from("list_items").delete().eq("list_id", list.id);
        await supabase.from("lists").delete().eq("id", list.id);
      }
      console.log(`  Cleared ${existingLists.length} existing seed lists`);
    }
  }

  // Clear coach's RSVPs (so we can recreate fresh)
  await supabase.from("event_rsvps").delete().eq("user_id", coachId);

  console.log("  Cleared @coach seed data");
}

async function clearExistingSeedUsers() {
  console.log("Clearing existing seed users...");

  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const seedUsers =
    authUsers?.users.filter((u) => u.email?.endsWith("@lostcity.local")) || [];

  for (const user of seedUsers) {
    // Delete related data first (order matters due to foreign keys)
    await supabase.from("activities").delete().eq("user_id", user.id);
    await supabase.from("notifications").delete().eq("user_id", user.id);
    await supabase.from("notifications").delete().eq("actor_id", user.id);
    await supabase.from("saved_items").delete().eq("user_id", user.id);
    await supabase.from("recommendations").delete().eq("user_id", user.id);
    await supabase.from("event_rsvps").delete().eq("user_id", user.id);
    await supabase.from("follows").delete().eq("follower_id", user.id);
    await supabase.from("follows").delete().eq("followed_user_id", user.id);
    await supabase.from("friend_requests").delete().eq("from_user_id", user.id);
    await supabase.from("friend_requests").delete().eq("to_user_id", user.id);
    await supabase.from("list_items").delete().eq("added_by", user.id);
    // Get and delete lists created by this user
    const { data: userLists } = await supabase
      .from("lists")
      .select("id")
      .eq("creator_id", user.id);
    if (userLists) {
      for (const list of userLists) {
        await supabase.from("list_items").delete().eq("list_id", list.id);
        await supabase.from("lists").delete().eq("id", list.id);
      }
    }
    await supabase.from("user_preferences").delete().eq("user_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);

    // Delete the auth user
    await supabase.auth.admin.deleteUser(user.id);
    console.log(`  Deleted: ${user.email}`);
  }

  console.log(`  Cleared ${seedUsers.length} seed users`);
}

async function createSeedUser(persona: Persona): Promise<string | null> {
  const email = persona.email || `seed-${persona.id}@lostcity.local`;

  // Create auth user
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password: "SeedUser123!",
      email_confirm: true,
      user_metadata: {
        username: persona.username,
        display_name: persona.name,
      },
    });

  if (authError) {
    console.error(`  Error creating auth user ${email}:`, authError.message);
    return null;
  }

  const userId = authData.user.id;
  createdUserIds.set(persona.id, userId);

  // Generate avatar URL using DiceBear
  const avatarSeed = persona.avatar_seed || persona.username;
  const avatarUrl = `https://api.dicebear.com/7.x/personas/png?seed=${avatarSeed}`;

  // Update profile (trigger may have already created it with minimal data)
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    username: persona.username,
    display_name: persona.name,
    bio: persona.bio,
    location: persona.home_neighborhood,
    avatar_url: avatarUrl,
    is_public: true,
    is_admin: false,
  });

  if (profileError) {
    console.error(
      `  Error updating profile for ${email}:`,
      profileError.message
    );
    // Don't return null - user was created, just profile update failed
  }

  // Create user preferences (use upsert in case trigger created empty prefs)
  const mappedCategories = persona.categories
    .map((c) => CATEGORY_MAP[c.toLowerCase()] || c)
    .filter((v, i, a) => a.indexOf(v) === i); // dedupe

  const { error: prefError } = await supabase.from("user_preferences").upsert({
    user_id: userId,
    favorite_categories: mappedCategories,
    favorite_neighborhoods: [persona.home_neighborhood, ...persona.frequents].slice(
      0,
      10
    ),
    favorite_vibes: persona.vibes,
    notification_settings: {
      email_digest: false,
      new_events: false,
      friend_activity: false,
    },
  });

  if (prefError) {
    console.error(`  Error creating preferences for ${email}:`, prefError.message);
  }

  return userId;
}

async function createMutualFollows(coachId: string | null) {
  console.log("Creating mutual follows with @coach...");

  if (!coachId) {
    console.log("  Skipping - no coach user found");
    return;
  }

  const follows: Array<{ follower_id: string; followed_user_id: string }> = [];

  for (const [, userId] of createdUserIds) {
    // Each seed user follows coach
    follows.push({ follower_id: userId, followed_user_id: coachId });
    // Coach follows each seed user
    follows.push({ follower_id: coachId, followed_user_id: userId });
  }

  // Insert in batches to avoid overwhelming the DB
  const batchSize = 50;
  for (let i = 0; i < follows.length; i += batchSize) {
    const batch = follows.slice(i, i + batchSize);
    const { error } = await supabase.from("follows").insert(batch);
    if (error) {
      console.error(`  Error inserting follows batch:`, error.message);
    }
  }

  console.log(`  Created ${follows.length} follow relationships`);
}

async function getEventsForCategories(
  categories: string[],
  limit: number
): Promise<Array<{ id: number; category: string }>> {
  const mappedCategories = categories
    .map((c) => CATEGORY_MAP[c.toLowerCase()] || c)
    .filter((v, i, a) => a.indexOf(v) === i);

  // Get future events matching these categories
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("events")
    .select("id, category")
    .in("category", mappedCategories)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(limit * 3); // Get extra to allow randomization

  if (error) {
    console.error("  Error fetching events:", error.message);
    return [];
  }

  // Shuffle and return requested number
  const shuffled = (data || []).sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

async function createRSVPs() {
  console.log("Creating RSVPs based on persona interests...");

  let totalRsvps = 0;

  for (const persona of personas) {
    const userId = createdUserIds.get(persona.id);
    if (!userId) continue;

    const rsvpCount = RSVP_COUNTS[persona.activity_level] || 5;
    const events = await getEventsForCategories(persona.categories, rsvpCount);

    const rsvps = events.map((event, i) => ({
      user_id: userId,
      event_id: event.id,
      // Mix of going and interested, weighted toward going for power users
      status:
        persona.activity_level === "power" || i < events.length * 0.7
          ? "going"
          : "interested",
      visibility: "public",
    }));

    if (rsvps.length > 0) {
      const { error } = await supabase.from("event_rsvps").insert(rsvps);
      if (error) {
        console.error(
          `  Error creating RSVPs for ${persona.username}:`,
          error.message
        );
      } else {
        totalRsvps += rsvps.length;
      }
    }
  }

  console.log(`  Created ${totalRsvps} RSVPs`);
}

async function getVenueIdBySlug(
  slugHint: string
): Promise<{ id: number; name: string } | null> {
  // Try exact match first
  const { data } = await supabase
    .from("venues")
    .select("id, name")
    .eq("slug", slugHint)
    .maybeSingle();

  if (data) return data;

  // Try with common variations
  const variations = [
    slugHint,
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

    if (varData) return varData;
  }

  // Try name search as fallback
  const searchName = slugHint.replace(/-/g, " ").replace(/_/g, " ");
  const { data: nameData } = await supabase
    .from("venues")
    .select("id, name")
    .ilike("name", `%${searchName}%`)
    .limit(1)
    .maybeSingle();

  return nameData || null;
}

async function createVenueRecommendations() {
  console.log("Creating venue recommendations...");

  let totalRecs = 0;
  const notFoundVenues = new Set<string>();

  for (const persona of personas) {
    const userId = createdUserIds.get(persona.id);
    if (!userId) continue;

    const venueHints = persona.recommended_venues || [];
    const recommendations: Array<{
      user_id: string;
      venue_id: number;
      visibility: string;
    }> = [];

    for (const hint of venueHints) {
      const venue = await getVenueIdBySlug(hint);
      if (venue) {
        recommendations.push({
          user_id: userId,
          venue_id: venue.id,
          visibility: "public",
        });
      } else {
        notFoundVenues.add(hint);
      }
    }

    if (recommendations.length > 0) {
      const { error } = await supabase
        .from("recommendations")
        .insert(recommendations);
      if (error) {
        console.error(
          `  Error creating recommendations for ${persona.username}:`,
          error.message
        );
      } else {
        totalRecs += recommendations.length;
      }
    }
  }

  console.log(`  Created ${totalRecs} venue recommendations`);
  if (notFoundVenues.size > 0) {
    console.log(
      `  Venues not found: ${Array.from(notFoundVenues).slice(0, 10).join(", ")}${notFoundVenues.size > 10 ? ` (+${notFoundVenues.size - 10} more)` : ""}`
    );
  }
}

async function createCoachLists(coachId: string | null) {
  console.log("Creating lists for @coach...");

  if (!coachId || !founder.lists) {
    console.log("  Skipping - no coach user or lists defined");
    return;
  }

  for (const listDef of founder.lists) {
    // Create the list (slug is auto-generated by trigger)
    const { data: list, error: listError } = await supabase
      .from("lists")
      .insert({
        creator_id: coachId,
        title: listDef.title,
        description: listDef.description,
        is_public: true,
      })
      .select("id")
      .single();

    if (listError) {
      console.error(`  Error creating list "${listDef.title}":`, listError.message);
      continue;
    }

    // Add venues to the list
    let addedCount = 0;
    let position = 0;
    for (const venueHint of listDef.venues) {
      const venue = await getVenueIdBySlug(venueHint);
      if (venue) {
        const { error: itemError } = await supabase.from("list_items").insert({
          list_id: list.id,
          item_type: "venue",
          venue_id: venue.id,
          added_by: coachId,
          position: position++,
        });
        if (!itemError) addedCount++;
      }
    }

    console.log(`  Created list "${listDef.title}" with ${addedCount} venues`);
  }
}

async function createSeedUserLists() {
  console.log("Creating lists from seed users...");

  let totalLists = 0;

  for (const persona of personas) {
    const userId = createdUserIds.get(persona.id);
    if (!userId || !persona.lists) continue;

    for (const listDef of persona.lists) {
      // Create the list
      const { data: list, error: listError } = await supabase
        .from("lists")
        .insert({
          creator_id: userId,
          title: listDef.title,
          description: listDef.description,
          is_public: true,
        })
        .select("id")
        .single();

      if (listError) {
        console.error(`  Error creating list "${listDef.title}" for ${persona.username}:`, listError.message);
        continue;
      }

      // Add venues to the list
      let addedCount = 0;
      let position = 0;
      for (const venueHint of listDef.venues) {
        const venue = await getVenueIdBySlug(venueHint);
        if (venue) {
          const { error: itemError } = await supabase.from("list_items").insert({
            list_id: list.id,
            item_type: "venue",
            venue_id: venue.id,
            added_by: userId,
            position: position++,
          });
          if (!itemError) addedCount++;
        }
      }

      console.log(`  @${persona.username}: "${listDef.title}" (${addedCount} venues)`);
      totalLists++;
    }
  }

  console.log(`  Created ${totalLists} lists from seed users`);
}

async function createCoachRecommendations(coachId: string | null) {
  console.log("Creating recommendations for @coach...");

  if (!coachId) {
    console.log("  Skipping - no coach user found");
    return;
  }

  const venueHints = founder.recommended_venues || founder.favorite_venues || [];
  const recommendations: Array<{
    user_id: string;
    venue_id: number;
    visibility: string;
  }> = [];

  for (const hint of venueHints) {
    const venue = await getVenueIdBySlug(hint);
    if (venue) {
      recommendations.push({
        user_id: coachId,
        venue_id: venue.id,
        visibility: "public",
      });
    }
  }

  if (recommendations.length > 0) {
    const { error } = await supabase
      .from("recommendations")
      .insert(recommendations);
    if (error) {
      console.error(`  Error creating coach recommendations:`, error.message);
    } else {
      console.log(`  Created ${recommendations.length} recommendations for @coach`);
    }
  }
}

async function createCoachRSVPs(coachId: string | null) {
  console.log("Creating RSVPs for @coach...");

  if (!coachId) {
    console.log("  Skipping - no coach user found");
    return;
  }

  // Get events matching coach's interests
  const events = await getEventsForCategories(founder.categories, 20);

  const rsvps = events.map((event, i) => ({
    user_id: coachId,
    event_id: event.id,
    status: i < events.length * 0.6 ? "going" : "interested",
    visibility: "public",
  }));

  if (rsvps.length > 0) {
    const { error } = await supabase.from("event_rsvps").insert(rsvps);
    if (error) {
      console.error(`  Error creating coach RSVPs:`, error.message);
    } else {
      console.log(`  Created ${rsvps.length} RSVPs for @coach`);
    }
  }
}

async function main() {
  console.log("\n=== Lost City Persona Seeding ===\n");

  try {
    // Clear existing seed users
    await clearExistingSeedUsers();

    // Find the @coach user
    const coachId = await findCoachUser();

    // Clear coach's existing seed data
    await clearCoachSeedData(coachId);

    // Create seed users
    console.log(`\nCreating ${personas.length} seed users...`);
    let createdCount = 0;
    for (const persona of personas) {
      const userId = await createSeedUser(persona);
      if (userId) {
        createdCount++;
        if (createdCount % 10 === 0) {
          console.log(`  Created ${createdCount}/${personas.length} users`);
        }
      }
    }
    console.log(`Created ${createdCount} seed users`);

    // Create mutual follows with @coach
    await createMutualFollows(coachId);

    // Create RSVPs based on persona interests
    await createRSVPs();

    // Create venue recommendations
    await createVenueRecommendations();

    // Create @coach's content
    await createCoachRecommendations(coachId);
    await createCoachLists(coachId);
    await createCoachRSVPs(coachId);

    // Create lists from seed users
    await createSeedUserLists();

    console.log("\n=== Seeding Complete ===");
    console.log(`\nSummary:`);
    console.log(`  Seed users created: ${createdCount}`);
    console.log(`  Coach user: ${coachId ? "found" : "not found"}`);
    console.log(`\nSeed user password: SeedUser123!`);
    console.log(`Email format: seed-{persona-id}@lostcity.local`);
  } catch (error) {
    console.error("\n=== Seeding Failed ===");
    console.error(error);
    process.exit(1);
  }
}

main();
