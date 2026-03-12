import { config as loadDotenv } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServiceClient } from "@/lib/supabase/service";
import { YONDER_DESTINATION_INTELLIGENCE } from "@/config/yonder-destination-intelligence";

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
  reservation_url: string | null;
  accepts_reservations: boolean | null;
  reservation_recommended: boolean | null;
};

async function main() {
  const weekendSlugs = YONDER_DESTINATION_INTELLIGENCE
    .filter((item) => item.commitmentTier === "weekend")
    .map((item) => item.slug);

  const client = createServiceClient();
  const { data, error } = await client
    .from("venues")
    .select("slug,name,reservation_url,accepts_reservations,reservation_recommended")
    .in("slug", weekendSlugs);

  if (error) throw error;

  const rows = ((data || []) as VenueRow[]).sort((a, b) => a.slug.localeCompare(b.slug));
  const withDecision = rows.filter(
    (row) =>
      typeof row.accepts_reservations === "boolean" &&
      typeof row.reservation_recommended === "boolean",
  ).length;
  const withReservationUrl = rows.filter((row) => Boolean(row.reservation_url?.trim())).length;

  console.log("Yonder weekend booking validation");
  console.log(`Weekend rows found: ${rows.length}`);
  console.log(`With booking decision flags: ${withDecision}/${rows.length}`);
  console.log(`With reservation URL: ${withReservationUrl}/${rows.length}`);
  console.log("");

  for (const row of rows) {
    console.log(
      [
        row.slug,
        `accepts=${row.accepts_reservations === null ? "unknown" : row.accepts_reservations ? "yes" : "no"}`,
        `recommended=${row.reservation_recommended === null ? "unknown" : row.reservation_recommended ? "yes" : "no"}`,
        row.reservation_url || "-",
      ].join(" | "),
    );
  }
}

main().catch((error) => {
  console.error("Validation failed:", error);
  process.exitCode = 1;
});
