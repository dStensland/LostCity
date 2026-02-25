/**
 * One-time script to seed film-specific explore tracks.
 *
 * Usage:
 *   npx tsx scripts/seed-film-explore-tracks.ts
 *   npx tsx scripts/seed-film-explore-tracks.ts --dry-run
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

type TrackSeed = {
  slug: string;
  name: string;
  quote: string;
  quote_source: string;
  description: string;
  category: string;
  group_name: string;
  accent_color: string;
  sort_order: number;
  venue_slugs: string[];
};

const TRACKS: TrackSeed[] = [
  {
    slug: "indie-circuit",
    name: "Indie Circuit",
    quote: "The real Atlanta film experience lives in these theaters.",
    quote_source: "Atlanta Film Scene",
    description: "Independent and art house theaters that define Atlanta's cinema culture.",
    category: "film",
    group_name: "Film",
    accent_color: "#818cf8",
    sort_order: 100,
    venue_slugs: [
      "plaza-theatre",
      "tara-theatre",
      "starlight-drive-in",
      "landmark-midtown-art-cinema",
      "springs-cinema-taphouse",
    ],
  },
  {
    slug: "film-festival-calendar",
    name: "Film Festival Calendar",
    quote: "From docs to horror, Atlanta's festival circuit covers every genre.",
    quote_source: "Atlanta Film Scene",
    description: "Major film festivals and the venues that host them throughout the year.",
    category: "film",
    group_name: "Film",
    accent_color: "#f59e0b",
    sort_order: 101,
    venue_slugs: [
      "atlanta-film-festival",
      "out-on-film",
      "atlanta-jewish-film-festival",
      "bronzelens-film-festival",
      "buried-alive-film-festival",
    ],
  },
  {
    slug: "drive-in-date-night",
    name: "Drive-In Date Night",
    quote: "Double features under the stars — the way movies were meant to be.",
    quote_source: "Atlanta Film Scene",
    description: "Drive-ins and outdoor screening venues perfect for date night.",
    category: "film",
    group_name: "Film",
    accent_color: "#fb7185",
    sort_order: 102,
    venue_slugs: [
      "starlight-drive-in",
    ],
  },
];

async function findVenueId(slug: string): Promise<number | null> {
  // Try venues first
  const { data: venue } = await supabase
    .from("venues")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (venue) return venue.id;

  return null;
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== SEEDING FILM EXPLORE TRACKS ===");

  for (const track of TRACKS) {
    console.log(`\nProcessing track: ${track.name}`);

    // Check if track already exists
    const { data: existing } = await supabase
      .from("explore_tracks")
      .select("id")
      .eq("slug", track.slug)
      .maybeSingle();

    if (existing) {
      console.log(`  Track "${track.slug}" already exists (id: ${existing.id}), skipping.`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  Would create track: ${track.name}`);
      for (const venueSlug of track.venue_slugs) {
        console.log(`    Would link venue: ${venueSlug}`);
      }
      continue;
    }

    // Insert track
    const { data: insertedTrack, error: trackError } = await supabase
      .from("explore_tracks")
      .insert({
        slug: track.slug,
        name: track.name,
        quote: track.quote,
        quote_source: track.quote_source,
        description: track.description,
        category: track.category,
        group_name: track.group_name,
        accent_color: track.accent_color,
        sort_order: track.sort_order,
        is_active: true,
      } as never)
      .select("id")
      .single();

    if (trackError || !insertedTrack) {
      console.error(`  Failed to create track: ${trackError?.message}`);
      continue;
    }

    console.log(`  Created track (id: ${insertedTrack.id})`);

    // Link venues
    for (const venueSlug of track.venue_slugs) {
      const venueId = await findVenueId(venueSlug);
      if (!venueId) {
        console.log(`    Venue "${venueSlug}" not found, skipping.`);
        continue;
      }

      const { error: linkError } = await supabase
        .from("explore_track_venues")
        .insert({
          track_id: insertedTrack.id,
          venue_id: venueId,
        } as never);

      if (linkError) {
        console.error(`    Failed to link venue "${venueSlug}": ${linkError.message}`);
      } else {
        console.log(`    Linked venue: ${venueSlug} (id: ${venueId})`);
      }
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
