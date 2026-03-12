import { config as loadDotenv } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServiceClient } from "@/lib/supabase/service";
import { YONDER_WAVE1_DESTINATION_INTELLIGENCE } from "@/config/yonder-destination-intelligence";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");

loadDotenv({ path: path.join(REPO_ROOT, ".env") });
loadDotenv({ path: path.join(REPO_ROOT, ".env.local"), override: true });
loadDotenv({ path: path.join(WEB_ROOT, ".env.local"), override: true });

type VenueRow = {
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  venue_type: string | null;
  website: string | null;
  image_url: string | null;
  hero_image_url: string | null;
  short_description: string | null;
  typical_duration_minutes: number | null;
  planning_notes: string | null;
};

async function main() {
  const client = createServiceClient();
  const slugs = YONDER_WAVE1_DESTINATION_INTELLIGENCE.map((item) => item.slug);

  const { data, error } = await client
    .from("venues")
    .select(
      "slug,name,city,state,venue_type,website,image_url,hero_image_url,short_description,typical_duration_minutes,planning_notes",
    )
    .in("slug", slugs);

  if (error) {
    throw error;
  }

  const rows = ((data || []) as VenueRow[]).sort((a, b) => a.slug.localeCompare(b.slug));
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const missing = slugs.filter((slug) => !bySlug.has(slug));
  const withImage = rows.filter(
    (row) => Boolean(row.image_url?.trim() || row.hero_image_url?.trim()),
  ).length;
  const withShortDescription = rows.filter((row) => Boolean(row.short_description?.trim())).length;
  const withWebsite = rows.filter((row) => Boolean(row.website?.trim())).length;
  const withDuration = rows.filter((row) => row.typical_duration_minutes != null).length;
  const withPlanning = rows.filter((row) => Boolean(row.planning_notes?.trim())).length;

  console.log("Yonder Wave 1 destination validation");
  console.log(`Manifest entries: ${slugs.length}`);
  console.log(`Rows found: ${rows.length}`);
  console.log(`Missing rows: ${missing.length}`);
  if (missing.length > 0) {
    console.log(`Missing slugs: ${missing.join(", ")}`);
  }
  console.log(`With image or hero image: ${withImage}/${rows.length}`);
  console.log(`With short description: ${withShortDescription}/${rows.length}`);
  console.log(`With website: ${withWebsite}/${rows.length}`);
  console.log(`With duration: ${withDuration}/${rows.length}`);
  console.log(`With planning notes: ${withPlanning}/${rows.length}`);
  console.log("");

  for (const item of YONDER_WAVE1_DESTINATION_INTELLIGENCE) {
    const row = bySlug.get(item.slug);
    if (!row) continue;
    console.log(
      [
        item.slug,
        item.commitmentTier,
        item.destinationType,
        item.primaryActivity,
        item.difficultyLevel,
        `${item.driveTimeMinutes}m`,
        `${item.typicalDurationMinutes}m`,
        row.city || "[no-city]",
        row.venue_type || "[no-venue-type]",
      ].join(" | "),
    );
  }

  if (missing.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Validation failed:", error);
  process.exitCode = 1;
});
