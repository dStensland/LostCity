/**
 * Enrich venues with hours data from Google Places API
 *
 * Usage: npx ts-node scripts/enrich-venue-hours.ts [--dry-run] [--limit=N]
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

// Day mapping from Google (0=Sunday) to our format
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

interface GooglePeriod {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

interface GoogleOpeningHours {
  openNow?: boolean;
  periods?: GooglePeriod[];
  weekdayDescriptions?: string[];
}

interface HoursData {
  [day: string]: { open: string; close: string } | null;
}

/**
 * Search for a place by text query using Google Places API
 */
async function searchPlace(query: string, lat?: number, lng?: number): Promise<string | null> {
  if (!GOOGLE_API_KEY) {
    console.error("GOOGLE_PLACES_API_KEY not set");
    return null;
  }

  const body: Record<string, unknown> = {
    textQuery: query,
    maxResultCount: 1,
  };

  // If we have coordinates, bias the search to that location
  if (lat && lng) {
    body.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 1000, // 1km radius
      },
    };
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    console.error(`Search error: ${response.status}`);
    return null;
  }

  const data = await response.json() as { places?: Array<{ id: string }> };
  return data.places?.[0]?.id || null;
}

/**
 * Get place details including hours
 */
async function getPlaceDetails(placeId: string): Promise<GoogleOpeningHours | null> {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "regularOpeningHours,currentOpeningHours",
      },
    }
  );

  if (!response.ok) {
    console.error(`Details error: ${response.status}`);
    return null;
  }

  const data = await response.json() as { regularOpeningHours?: GoogleOpeningHours; currentOpeningHours?: GoogleOpeningHours };
  return data.regularOpeningHours || data.currentOpeningHours || null;
}

/**
 * Convert Google opening hours to our HoursData format
 */
function convertGoogleHours(googleHours: GoogleOpeningHours): HoursData | null {
  if (!googleHours.periods || googleHours.periods.length === 0) {
    return null;
  }

  const hours: HoursData = {};

  // Check if it's 24 hours (single period with no close time)
  if (
    googleHours.periods.length === 1 &&
    !googleHours.periods[0].close &&
    googleHours.periods[0].open.hour === 0 &&
    googleHours.periods[0].open.minute === 0
  ) {
    // 24 hours - set all days to 00:00-23:59
    for (const day of DAY_NAMES) {
      hours[day] = { open: "00:00", close: "23:59" };
    }
    return hours;
  }

  // Process each period
  for (const period of googleHours.periods) {
    const dayName = DAY_NAMES[period.open.day];
    const openTime = `${period.open.hour.toString().padStart(2, "0")}:${period.open.minute.toString().padStart(2, "0")}`;

    let closeTime = "23:59";
    if (period.close) {
      closeTime = `${period.close.hour.toString().padStart(2, "0")}:${period.close.minute.toString().padStart(2, "0")}`;
    }

    hours[dayName] = { open: openTime, close: closeTime };
  }

  return hours;
}

/**
 * Create hours display string from weekday descriptions
 */
function createHoursDisplay(weekdayDescriptions?: string[]): string | null {
  if (!weekdayDescriptions || weekdayDescriptions.length === 0) {
    return null;
  }
  return weekdayDescriptions.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find(a => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 50;

  console.log(`Enriching venue hours (dry-run: ${dryRun}, limit: ${limit})`);
  console.log("---");

  if (!GOOGLE_API_KEY) {
    console.error("ERROR: GOOGLE_PLACES_API_KEY is not set in .env.local");
    process.exit(1);
  }

  // Get venues without hours, prioritizing bars, restaurants, coffee shops
  const { data: venues, error } = await supabase
    .from("venues")
    .select("id, name, address, city, state, lat, lng, spot_type, hours")
    .eq("active", true)
    .is("hours", null)
    .in("spot_type", ["bar", "restaurant", "coffee_shop", "club", "brewery", "distillery", "winery"])
    .order("name")
    .limit(limit);

  if (error) {
    console.error("Error fetching venues:", error);
    process.exit(1);
  }

  console.log(`Found ${venues?.length || 0} venues without hours\n`);

  let updated = 0;
  let failed = 0;
  let notFound = 0;

  for (const venue of venues || []) {
    // Build search query
    const query = `${venue.name} ${venue.address || ""} ${venue.city || "Atlanta"} ${venue.state || "GA"}`.trim();

    console.log(`Searching: ${venue.name}`);

    try {
      // Search for the place
      const placeId = await searchPlace(query, venue.lat, venue.lng);

      if (!placeId) {
        console.log(`  -> Not found on Google Places`);
        notFound++;
        continue;
      }

      // Get place details
      const openingHours = await getPlaceDetails(placeId);

      if (!openingHours) {
        console.log(`  -> No hours data available`);
        notFound++;
        continue;
      }

      // Convert to our format
      const hours = convertGoogleHours(openingHours);
      const hoursDisplay = createHoursDisplay(openingHours.weekdayDescriptions);

      if (!hours) {
        console.log(`  -> Could not parse hours`);
        notFound++;
        continue;
      }

      console.log(`  -> Found hours:`, JSON.stringify(hours));

      if (!dryRun) {
        const { error: updateError } = await supabase
          .from("venues")
          .update({
            hours,
            hours_display: hoursDisplay,
          })
          .eq("id", venue.id);

        if (updateError) {
          console.log(`  -> ERROR updating: ${updateError.message}`);
          failed++;
        } else {
          console.log(`  -> Updated!`);
          updated++;
        }
      } else {
        console.log(`  -> Would update (dry-run)`);
        updated++;
      }

      // Rate limit: 1 request per 200ms
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      console.log(`  -> ERROR: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log("\n---");
  console.log(`Results: ${updated} updated, ${notFound} not found, ${failed} failed`);
  if (dryRun) {
    console.log("(dry-run mode - no changes were made)");
  }
}

main().catch(console.error);
