import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const dayAfter = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const timeFilter = twoHoursAgo.toTimeString().slice(0, 8);

  console.log("Today:", today, "Tomorrow:", tomorrow, "Day after:", dayAfter);
  console.log("Time filter (start_time >=):", timeFilter);
  console.log("");

  // First check ALL events today
  const { count: totalToday } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("start_date", today)
    .is("canonical_event_id", null)
    .is("portal_id", null);

  console.log("Total public events today (no time filter):", totalToday);

  // Show ALL events for next 3 days for debugging
  const { data: upcoming } = await supabase
    .from("events")
    .select("id, title, category, start_date, start_time, venue:venues(name)")
    .in("start_date", [today, tomorrow, dayAfter])
    .is("canonical_event_id", null)
    .is("portal_id", null)
    .order("start_date")
    .order("start_time")
    .limit(50);

  console.log("\nEvents for next 3 days:");
  for (const e of upcoming || []) {
    const venueName = (e.venue?.name || "?").slice(0, 30);
    // Skip painting with a twist for cleaner output
    if (venueName.toLowerCase().includes("painting with")) continue;
    console.log(`  ${e.start_date} ${e.start_time || "all-day"} | ${(e.category || "?").padEnd(10)} | ${venueName}`);
  }
  console.log("");

  const { data, count } = await supabase
    .from("events")
    .select("id, title, category, start_time, image_url, description, venue_id, venue:venues(name)", { count: "exact" })
    .eq("start_date", today)
    .is("canonical_event_id", null)
    .is("portal_id", null)
    .or(`start_time.gte.${timeFilter},is_all_day.eq.true`)
    .order("start_time")
    .limit(50);

  console.log("Events matching time filter:", count);
  console.log("");

  // Get RSVP counts
  const eventIds = (data || []).map(e => e.id);
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("event_id, status")
    .in("event_id", eventIds);

  const rsvpCounts: Record<number, number> = {};
  for (const r of rsvps || []) {
    rsvpCounts[r.event_id] = (rsvpCounts[r.event_id] || 0) + 1;
  }

  // Get venue recommendation counts
  const venueIds = (data || []).map(e => e.venue_id).filter(Boolean);
  const { data: venueRecs } = await supabase
    .from("recommendations")
    .select("venue_id")
    .in("venue_id", venueIds);

  const venueRecCounts: Record<number, number> = {};
  for (const r of venueRecs || []) {
    if (r.venue_id) venueRecCounts[r.venue_id] = (venueRecCounts[r.venue_id] || 0) + 1;
  }

  // Hip venue patterns
  const HIP_VENUE_PATTERNS = [
    /\b(earl|529|variety|terminal west|masquerade|drunken unicorn|star bar|aisle ?5)\b/i,
    /\b(dad'?s garage|laughing skull|punchline|improv)\b/i,
    /\b(plaza theatre|aurora|tara)\b/i,
    /\b(goat farm|eyedrum|wonderroot|dashboard|mammal)\b/i,
    /\b(mary'?s|sister louisa|joystick|mother|church|octopus)\b/i,
    /\b(monday night|three taverns|orpheus|sweetwater|wild heaven)\b/i,
    /\b(criminal records|wax n facts)\b/i,
    /\b(high museum|carlos museum|atlanta contemporary)\b/i,
    /\b(fox theatre|alliance|horizon|theatrical outfit)\b/i,
  ];

  const GENERIC_VENUE_PATTERNS = [
    /painting with a twist/i,
    /board & brush/i,
    /sur la table/i,
    /williams.sonoma/i,
    /cook'?s warehouse/i,
  ];

  const HIP_CATEGORIES = ["music", "comedy", "nightlife", "art", "film", "theater"];

  // Score events
  const scored = (data || []).map(e => {
    let score = 0;
    const venueName = e.venue?.name || "";
    const cat = e.category || "";

    // Hip venue +20
    if (HIP_VENUE_PATTERNS.some(p => p.test(venueName))) score += 20;
    // Generic venue -30
    if (GENERIC_VENUE_PATTERNS.some(p => p.test(venueName))) score -= 30;
    // Hip category +10
    if (HIP_CATEGORIES.includes(cat)) score += 10;
    // RSVPs
    score += (rsvpCounts[e.id] || 0) * 4;
    // Venue recs
    score += Math.min((venueRecCounts[e.venue_id] || 0) * 3, 15);
    // Image +5
    if (e.image_url) score += 5;

    return { ...e, score, rsvps: rsvpCounts[e.id] || 0, venueRecs: venueRecCounts[e.venue_id] || 0 };
  });

  scored.sort((a, b) => b.score - a.score);

  console.log("Top 15 by quality score:");
  console.log("Score | RSVPs | VenueRecs | Category   | Venue                     | Title");
  console.log("------|-------|-----------|------------|---------------------------|------");
  for (const e of scored.slice(0, 15)) {
    const score = String(e.score).padStart(5);
    const rsvps = String(e.rsvps).padStart(5);
    const vRecs = String(e.venueRecs).padStart(9);
    const cat = (e.category || "?").padEnd(10).slice(0, 10);
    const venue = (e.venue?.name || "?").padEnd(25).slice(0, 25);
    const title = e.title.slice(0, 40);
    console.log(`${score} | ${rsvps} | ${vRecs} | ${cat} | ${venue} | ${title}`);
  }
}

main().catch(console.error);
