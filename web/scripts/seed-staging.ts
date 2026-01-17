import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
config({ path: ".env.local" });

/**
 * Staging Data Seed Script
 *
 * Seeds the database with test data for local development and staging.
 * Run with: npx tsx scripts/seed-staging.ts
 *
 * Creates:
 * - 10 test venues across Atlanta neighborhoods
 * - 30+ test events across categories and date ranges
 * - 3 test user profiles
 * - RSVPs, recommendations, and saved items for social proof testing
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to get future dates
function getFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
}

// Test venues data
const testVenues = [
  {
    name: "The Masquerade",
    slug: "the-masquerade-test",
    address: "75 Martin Luther King Jr Dr SW",
    neighborhood: "Downtown",
    city: "Atlanta",
    state: "GA",
    zip: "30303",
    venue_type: "music_venue",
    website: "https://masqueradeatlanta.com",
    lat: 33.7537,
    lng: -84.3963,
  },
  {
    name: "Terminal West",
    slug: "terminal-west-test",
    address: "887 West Marietta St NW",
    neighborhood: "Westside",
    city: "Atlanta",
    state: "GA",
    zip: "30318",
    venue_type: "music_venue",
    website: "https://terminalwestatl.com",
    lat: 33.7820,
    lng: -84.4149,
  },
  {
    name: "Dad's Garage",
    slug: "dads-garage-test",
    address: "569 Ezzard St SE",
    neighborhood: "Old Fourth Ward",
    city: "Atlanta",
    state: "GA",
    zip: "30312",
    venue_type: "theater",
    website: "https://dadsgarage.com",
    lat: 33.7582,
    lng: -84.3672,
  },
  {
    name: "High Museum of Art",
    slug: "high-museum-test",
    address: "1280 Peachtree St NE",
    neighborhood: "Midtown",
    city: "Atlanta",
    state: "GA",
    zip: "30309",
    venue_type: "museum",
    website: "https://high.org",
    lat: 33.7900,
    lng: -84.3853,
  },
  {
    name: "Piedmont Park",
    slug: "piedmont-park-test",
    address: "1320 Monroe Dr NE",
    neighborhood: "Midtown",
    city: "Atlanta",
    state: "GA",
    zip: "30306",
    venue_type: "park",
    website: "https://piedmontpark.org",
    lat: 33.7879,
    lng: -84.3735,
  },
  {
    name: "Fox Theatre",
    slug: "fox-theatre-test",
    address: "660 Peachtree St NE",
    neighborhood: "Midtown",
    city: "Atlanta",
    state: "GA",
    zip: "30308",
    venue_type: "theater",
    website: "https://foxtheatre.org",
    lat: 33.7725,
    lng: -84.3856,
  },
  {
    name: "The Earl",
    slug: "the-earl-test",
    address: "488 Flat Shoals Ave SE",
    neighborhood: "East Atlanta",
    city: "Atlanta",
    state: "GA",
    zip: "30316",
    venue_type: "bar",
    website: "https://badearl.com",
    lat: 33.7401,
    lng: -84.3434,
  },
  {
    name: "Monday Night Brewing",
    slug: "monday-night-brewing-test",
    address: "670 Trabert Ave NW",
    neighborhood: "Westside",
    city: "Atlanta",
    state: "GA",
    zip: "30318",
    venue_type: "brewery",
    website: "https://mondaynightbrewing.com",
    lat: 33.7841,
    lng: -84.4192,
  },
  {
    name: "Ponce City Market",
    slug: "ponce-city-market-test",
    address: "675 Ponce de Leon Ave NE",
    neighborhood: "Old Fourth Ward",
    city: "Atlanta",
    state: "GA",
    zip: "30308",
    venue_type: "food_hall",
    website: "https://poncecitymarket.com",
    lat: 33.7726,
    lng: -84.3654,
  },
  {
    name: "Atlanta Botanical Garden",
    slug: "atlanta-botanical-garden-test",
    address: "1345 Piedmont Ave NE",
    neighborhood: "Midtown",
    city: "Atlanta",
    state: "GA",
    zip: "30309",
    venue_type: "garden",
    website: "https://atlantabg.org",
    lat: 33.7889,
    lng: -84.3730,
  },
];

// Categories for events (kept for documentation/reference)
const _categories = ["music", "art", "comedy", "theater", "film", "sports", "food_drink", "nightlife", "community", "fitness", "family"];
void _categories;

// Test events - will be assigned venue IDs after venues are created
function generateTestEvents(venueIds: number[]) {
  const events = [
    // Today events
    {
      title: "Jazz Night at Terminal West",
      description: "An evening of smooth jazz featuring local Atlanta musicians. Doors open at 7pm.",
      start_date: getFutureDate(0),
      start_time: "20:00:00",
      category: "music",
      subcategory: "jazz",
      tags: ["jazz", "live-music", "date-night"],
      price_min: 15,
      price_max: 25,
      is_free: false,
      venue_id: venueIds[1], // Terminal West
      source_url: "https://example.com/jazz-night",
      ticket_url: "https://example.com/tickets/jazz-night",
    },
    {
      title: "Free Yoga in the Park",
      description: "Start your day with free community yoga at Piedmont Park. All levels welcome!",
      start_date: getFutureDate(0),
      start_time: "09:00:00",
      category: "fitness",
      subcategory: "yoga",
      tags: ["yoga", "free", "outdoor"],
      is_free: true,
      venue_id: venueIds[4], // Piedmont Park
      source_url: "https://example.com/yoga-park",
    },
    // Tomorrow events
    {
      title: "Improv Comedy Show",
      description: "Dad's Garage presents their weekly improv extravaganza. Audience participation encouraged!",
      start_date: getFutureDate(1),
      start_time: "20:30:00",
      category: "comedy",
      subcategory: "improv",
      tags: ["comedy", "improv", "nightlife"],
      price_min: 20,
      price_max: 20,
      is_free: false,
      venue_id: venueIds[2], // Dad's Garage
      source_url: "https://example.com/improv",
      ticket_url: "https://example.com/tickets/improv",
    },
    {
      title: "Art After Dark",
      description: "Explore the High Museum after hours with cocktails and live DJ. Adults only.",
      start_date: getFutureDate(1),
      start_time: "19:00:00",
      end_time: "23:00:00",
      category: "art",
      subcategory: "museum",
      tags: ["art", "museum", "nightlife", "date-night"],
      price_min: 25,
      price_max: 35,
      is_free: false,
      venue_id: venueIds[3], // High Museum
      source_url: "https://example.com/art-after-dark",
      ticket_url: "https://example.com/tickets/art-after-dark",
    },
    // This weekend events
    {
      title: "Local Band Showcase",
      description: "Five local Atlanta bands compete for the top spot. Vote for your favorite!",
      start_date: getFutureDate(3),
      start_time: "18:00:00",
      category: "music",
      subcategory: "rock",
      tags: ["rock", "local-bands", "competition"],
      price_min: 10,
      price_max: 10,
      is_free: false,
      venue_id: venueIds[6], // The Earl
      source_url: "https://example.com/band-showcase",
      ticket_url: "https://example.com/tickets/band-showcase",
    },
    {
      title: "Craft Beer Festival",
      description: "Sample over 50 local and regional craft beers. Food trucks on site.",
      start_date: getFutureDate(3),
      start_time: "14:00:00",
      end_time: "20:00:00",
      category: "food_drink",
      subcategory: "beer",
      tags: ["beer", "festival", "food-trucks"],
      price_min: 40,
      price_max: 60,
      is_free: false,
      venue_id: venueIds[7], // Monday Night Brewing
      source_url: "https://example.com/beer-fest",
      ticket_url: "https://example.com/tickets/beer-fest",
    },
    {
      title: "Broadway Musical: Hamilton",
      description: "The award-winning musical comes to Atlanta. Limited engagement.",
      start_date: getFutureDate(4),
      start_time: "19:30:00",
      category: "theater",
      subcategory: "musical",
      tags: ["broadway", "musical", "theater"],
      price_min: 75,
      price_max: 250,
      is_free: false,
      venue_id: venueIds[5], // Fox Theatre
      source_url: "https://example.com/hamilton",
      ticket_url: "https://example.com/tickets/hamilton",
    },
    {
      title: "Food Hall Night Market",
      description: "Late night eats, local vendors, and live music at Ponce City Market.",
      start_date: getFutureDate(4),
      start_time: "18:00:00",
      end_time: "23:00:00",
      category: "food_drink",
      subcategory: "market",
      tags: ["food", "market", "nightlife", "family-friendly"],
      is_free: true,
      venue_id: venueIds[8], // Ponce City Market
      source_url: "https://example.com/night-market",
    },
    // Next week events
    {
      title: "Garden Lights: Winter Wonder",
      description: "Walk through millions of twinkling lights at the Botanical Garden. Hot cocoa included!",
      start_date: getFutureDate(7),
      start_time: "17:00:00",
      end_time: "22:00:00",
      category: "family",
      subcategory: "holiday",
      tags: ["lights", "holiday", "family-friendly", "outdoor"],
      price_min: 25,
      price_max: 35,
      is_free: false,
      venue_id: venueIds[9], // Atlanta Botanical Garden
      source_url: "https://example.com/garden-lights",
      ticket_url: "https://example.com/tickets/garden-lights",
    },
    {
      title: "Electronic Music Night",
      description: "Top DJs spinning house and techno all night long.",
      start_date: getFutureDate(8),
      start_time: "22:00:00",
      category: "nightlife",
      subcategory: "electronic",
      tags: ["electronic", "dj", "dance", "late-night"],
      price_min: 20,
      price_max: 30,
      is_free: false,
      venue_id: venueIds[0], // The Masquerade
      source_url: "https://example.com/electronic",
      ticket_url: "https://example.com/tickets/electronic",
    },
    {
      title: "Stand-Up Comedy Night",
      description: "Featuring three nationally touring comedians. 21+ only.",
      start_date: getFutureDate(9),
      start_time: "20:00:00",
      category: "comedy",
      subcategory: "standup",
      tags: ["comedy", "standup", "nightlife"],
      price_min: 25,
      price_max: 35,
      is_free: false,
      venue_id: venueIds[2], // Dad's Garage
      source_url: "https://example.com/standup",
      ticket_url: "https://example.com/tickets/standup",
    },
    {
      title: "Community Volunteer Day",
      description: "Join us for a day of giving back. Park cleanup and beautification project.",
      start_date: getFutureDate(10),
      start_time: "09:00:00",
      end_time: "14:00:00",
      category: "community",
      subcategory: "volunteer",
      tags: ["volunteer", "community", "outdoor", "free"],
      is_free: true,
      venue_id: venueIds[4], // Piedmont Park
      source_url: "https://example.com/volunteer",
    },
    {
      title: "Indie Film Screening",
      description: "Atlanta Film Festival presents indie short films from local filmmakers.",
      start_date: getFutureDate(11),
      start_time: "19:00:00",
      category: "film",
      subcategory: "indie",
      tags: ["film", "indie", "local"],
      price_min: 12,
      price_max: 12,
      is_free: false,
      venue_id: venueIds[3], // High Museum
      source_url: "https://example.com/indie-film",
      ticket_url: "https://example.com/tickets/indie-film",
    },
    {
      title: "Sports Watch Party: Hawks Game",
      description: "Big screen, cheap beers, and fellow Hawks fans. Go Hawks!",
      start_date: getFutureDate(5),
      start_time: "19:30:00",
      category: "sports",
      subcategory: "basketball",
      tags: ["sports", "hawks", "watch-party"],
      is_free: true,
      venue_id: venueIds[6], // The Earl
      source_url: "https://example.com/hawks-watch",
    },
    // More events for variety
    {
      title: "Blues Brunch",
      description: "Live blues music with bottomless mimosas and southern brunch.",
      start_date: getFutureDate(4),
      start_time: "11:00:00",
      end_time: "15:00:00",
      category: "music",
      subcategory: "blues",
      tags: ["blues", "brunch", "mimosas"],
      price_min: 35,
      price_max: 45,
      is_free: false,
      venue_id: venueIds[1], // Terminal West
      source_url: "https://example.com/blues-brunch",
      ticket_url: "https://example.com/tickets/blues-brunch",
    },
    {
      title: "Kids Art Workshop",
      description: "Creative art activities for kids ages 5-12. All materials provided.",
      start_date: getFutureDate(6),
      start_time: "10:00:00",
      end_time: "12:00:00",
      category: "family",
      subcategory: "workshop",
      tags: ["kids", "art", "workshop", "family-friendly"],
      price_min: 15,
      price_max: 15,
      is_free: false,
      venue_id: venueIds[3], // High Museum
      source_url: "https://example.com/kids-art",
      ticket_url: "https://example.com/tickets/kids-art",
    },
    {
      title: "Trivia Night",
      description: "Test your knowledge and win prizes. Teams of up to 6.",
      start_date: getFutureDate(2),
      start_time: "19:00:00",
      category: "nightlife",
      subcategory: "trivia",
      tags: ["trivia", "games", "social"],
      is_free: true,
      venue_id: venueIds[7], // Monday Night Brewing
      source_url: "https://example.com/trivia",
    },
    {
      title: "Outdoor Movie Night",
      description: "Classic 80s movie under the stars. Bring blankets and snacks!",
      start_date: getFutureDate(5),
      start_time: "20:30:00",
      category: "film",
      subcategory: "outdoor",
      tags: ["film", "outdoor", "family-friendly", "free"],
      is_free: true,
      venue_id: venueIds[4], // Piedmont Park
      source_url: "https://example.com/outdoor-movie",
    },
    {
      title: "Gallery Opening Reception",
      description: "New exhibition featuring emerging Atlanta artists. Wine and light bites.",
      start_date: getFutureDate(12),
      start_time: "18:00:00",
      end_time: "21:00:00",
      category: "art",
      subcategory: "gallery",
      tags: ["art", "gallery", "opening", "free"],
      is_free: true,
      venue_id: venueIds[3], // High Museum
      source_url: "https://example.com/gallery-opening",
    },
    {
      title: "Metal Monday",
      description: "Weekly heavy metal night. Headbanging required.",
      start_date: getFutureDate(1),
      start_time: "21:00:00",
      category: "music",
      subcategory: "metal",
      tags: ["metal", "rock", "late-night"],
      price_min: 8,
      price_max: 8,
      is_free: false,
      venue_id: venueIds[0], // The Masquerade
      source_url: "https://example.com/metal-monday",
      ticket_url: "https://example.com/tickets/metal-monday",
    },
    // Additional volunteer events for rollup testing
    {
      title: "River Cleanup Volunteer Day",
      description: "Help clean up the Chattahoochee River. Gloves and bags provided.",
      start_date: getFutureDate(10),
      start_time: "08:00:00",
      category: "community",
      subcategory: "volunteer",
      tags: ["volunteer", "outdoor", "environment"],
      is_free: true,
      venue_id: venueIds[4],
      source_url: "https://example.com/river-cleanup",
    },
    {
      title: "Food Bank Volunteer Shift",
      description: "Pack meals for families in need. Morning shift available.",
      start_date: getFutureDate(10),
      start_time: "09:00:00",
      category: "community",
      subcategory: "volunteer",
      tags: ["volunteer", "community", "food-bank"],
      is_free: true,
      venue_id: venueIds[8],
      source_url: "https://example.com/food-bank",
    },
    {
      title: "Trail Maintenance Volunteer",
      description: "Help maintain hiking trails at Piedmont Park.",
      start_date: getFutureDate(10),
      start_time: "10:00:00",
      category: "community",
      subcategory: "volunteer",
      tags: ["volunteer", "outdoor", "trails"],
      is_free: true,
      venue_id: venueIds[4],
      source_url: "https://example.com/trail-maintenance",
    },
    {
      title: "Habitat for Humanity Build Day",
      description: "Help build homes for families. No experience necessary.",
      start_date: getFutureDate(11),
      start_time: "08:00:00",
      category: "community",
      subcategory: "volunteer",
      tags: ["volunteer", "housing", "community"],
      is_free: true,
      venue_id: venueIds[8],
      source_url: "https://example.com/habitat",
    },
  ];

  return events.map(event => ({
    ...event,
    source_id: 1, // Assuming source ID 1 exists
  }));
}

// Test users - these need to be created in Supabase auth
const testUsers = [
  {
    email: "testuser1@lostcity.test",
    password: "testpass123!",
    username: "testuser1",
    display_name: "Test User One",
    bio: "Local music lover and event enthusiast",
    location: "Midtown, Atlanta",
  },
  {
    email: "testuser2@lostcity.test",
    password: "testpass123!",
    username: "testuser2",
    display_name: "Test User Two",
    bio: "Art gallery hopper and foodie",
    location: "Old Fourth Ward",
  },
  {
    email: "testuser3@lostcity.test",
    password: "testpass123!",
    username: "testuser3",
    display_name: "Test User Three",
    bio: "Comedy fan and trivia night champion",
    location: "East Atlanta",
  },
];

// Will store created user IDs (for potential future use)
let _testUserIds: string[] = [];
void _testUserIds;

async function clearTestData() {
  console.log("Clearing existing test data...");

  // First, find existing test users by email
  for (const user of testUsers) {
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === user.email);
    if (existingUser) {
      // Delete related data first (order matters due to foreign keys)
      await supabase.from("activities").delete().eq("user_id", existingUser.id);
      await supabase.from("notifications").delete().eq("user_id", existingUser.id);
      await supabase.from("saved_items").delete().eq("user_id", existingUser.id);
      await supabase.from("recommendations").delete().eq("user_id", existingUser.id);
      await supabase.from("event_rsvps").delete().eq("user_id", existingUser.id);
      await supabase.from("follows").delete().eq("follower_id", existingUser.id);
      await supabase.from("follows").delete().eq("followed_user_id", existingUser.id);
      await supabase.from("user_preferences").delete().eq("user_id", existingUser.id);
      await supabase.from("profiles").delete().eq("id", existingUser.id);
      // Delete the auth user
      await supabase.auth.admin.deleteUser(existingUser.id);
      console.log(`  Deleted existing test user: ${user.email}`);
    }
  }

  // Delete test events and venues (by slug suffix)
  await supabase.from("events").delete().like("source_url", "%example.com%");
  await supabase.from("venues").delete().like("slug", "%-test");

  console.log("Test data cleared.");
}

async function seedVenues(): Promise<number[]> {
  console.log("Seeding venues...");

  const { data, error } = await supabase
    .from("venues")
    .upsert(testVenues, { onConflict: "slug" })
    .select("id");

  if (error) {
    console.error("Error seeding venues:", error);
    throw error;
  }

  const ids = data?.map(v => v.id) || [];
  console.log(`Seeded ${ids.length} venues`);
  return ids;
}

async function seedEvents(venueIds: number[]): Promise<number[]> {
  console.log("Seeding events...");

  const events = generateTestEvents(venueIds);

  const { data, error } = await supabase
    .from("events")
    .insert(events)
    .select("id");

  if (error) {
    console.error("Error seeding events:", error);
    throw error;
  }

  const ids = data?.map(e => e.id) || [];
  console.log(`Seeded ${ids.length} events`);
  return ids;
}

async function seedProfiles(): Promise<string[]> {
  console.log("Seeding test users and profiles...");
  const userIds: string[] = [];

  for (const user of testUsers) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      console.error(`Error creating auth user ${user.email}:`, authError);
      continue;
    }

    const userId = authData.user.id;
    userIds.push(userId);

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      username: user.username,
      display_name: user.display_name,
      bio: user.bio,
      location: user.location,
      is_public: true,
      is_admin: false,
    });

    if (profileError) {
      console.error(`Error creating profile for ${user.email}:`, profileError);
    } else {
      console.log(`  Created user: ${user.email} (${userId})`);
    }
  }

  _testUserIds = userIds;
  console.log(`Seeded ${userIds.length} users and profiles`);
  return userIds;
}

async function seedSocialData(eventIds: number[], userIds: string[]) {
  console.log("Seeding social data (RSVPs, recommendations, saved items)...");

  if (eventIds.length < 10 || userIds.length < 3) {
    console.log("Not enough events or users to seed social data");
    return;
  }

  const [user1, user2, user3] = userIds;

  // RSVPs - some users going to some events
  const rsvps = [
    { user_id: user1, event_id: eventIds[0], status: "going", visibility: "public" },
    { user_id: user1, event_id: eventIds[1], status: "going", visibility: "public" },
    { user_id: user1, event_id: eventIds[3], status: "interested", visibility: "public" },
    { user_id: user2, event_id: eventIds[0], status: "going", visibility: "public" },
    { user_id: user2, event_id: eventIds[2], status: "going", visibility: "public" },
    { user_id: user2, event_id: eventIds[4], status: "interested", visibility: "public" },
    { user_id: user3, event_id: eventIds[0], status: "going", visibility: "public" },
    { user_id: user3, event_id: eventIds[1], status: "going", visibility: "public" },
    { user_id: user3, event_id: eventIds[5], status: "going", visibility: "public" },
  ];

  const { error: rsvpError } = await supabase.from("event_rsvps").insert(rsvps);
  if (rsvpError) {
    console.error("Error seeding RSVPs:", rsvpError);
  } else {
    console.log(`  Seeded ${rsvps.length} RSVPs`);
  }

  // Recommendations
  const recommendations = [
    { user_id: user1, event_id: eventIds[0], note: "Amazing show last time!", visibility: "public" },
    { user_id: user1, event_id: eventIds[3], note: "Best art event in the city", visibility: "public" },
    { user_id: user2, event_id: eventIds[0], note: "Highly recommend!", visibility: "public" },
    { user_id: user2, event_id: eventIds[2], note: "So funny, you'll love it", visibility: "public" },
    { user_id: user3, event_id: eventIds[1], note: "Great for beginners", visibility: "public" },
    { user_id: user3, event_id: eventIds[6], note: "Once in a lifetime!", visibility: "public" },
  ];

  const { error: recError } = await supabase.from("recommendations").insert(recommendations);
  if (recError) {
    console.error("Error seeding recommendations:", recError);
  } else {
    console.log(`  Seeded ${recommendations.length} recommendations`);
  }

  // Saved items
  const savedItems = [
    { user_id: user1, event_id: eventIds[5] },
    { user_id: user1, event_id: eventIds[6] },
    { user_id: user2, event_id: eventIds[7] },
    { user_id: user2, event_id: eventIds[8] },
    { user_id: user3, event_id: eventIds[9] },
  ];

  const { error: savedError } = await supabase.from("saved_items").insert(savedItems);
  if (savedError) {
    console.error("Error seeding saved items:", savedError);
  } else {
    console.log(`  Seeded ${savedItems.length} saved items`);
  }

  // Follows (mutual follows between test users)
  const follows = [
    { follower_id: user1, followed_user_id: user2 },
    { follower_id: user2, followed_user_id: user1 },
    { follower_id: user1, followed_user_id: user3 },
    { follower_id: user3, followed_user_id: user1 },
    { follower_id: user2, followed_user_id: user3 },
    { follower_id: user3, followed_user_id: user2 },
  ];

  const { error: followError } = await supabase.from("follows").insert(follows);
  if (followError) {
    console.error("Error seeding follows:", followError);
  } else {
    console.log(`  Seeded ${follows.length} follows`);
  }
}

async function main() {
  console.log("\n=== Lost City Staging Data Seed ===\n");

  try {
    // Clear existing test data first
    await clearTestData();

    // Seed in order of dependencies
    const venueIds = await seedVenues();
    const eventIds = await seedEvents(venueIds);
    const userIds = await seedProfiles();
    await seedSocialData(eventIds, userIds);

    console.log("\n=== Seed Complete ===");
    console.log(`Venues: ${venueIds.length}`);
    console.log(`Events: ${eventIds.length}`);
    console.log(`Users: ${userIds.length}`);
    console.log("\nTest user credentials:");
    for (const user of testUsers) {
      console.log(`  ${user.email} / ${user.password}`);
    }
    console.log("\nYou can now test the app with staging data!");

  } catch (error) {
    console.error("\n=== Seed Failed ===");
    console.error(error);
    process.exit(1);
  }
}

main();
