import { config as loadDotenv } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServiceClient } from "@/lib/supabase/service";
import {
  YONDER_ACCOMMODATION_INVENTORY_SOURCES,
  YONDER_INVENTORY_PROVIDERS,
} from "@/config/yonder-accommodation-inventory";
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

function getReservationHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function main() {
  const weekendEntries = YONDER_DESTINATION_INTELLIGENCE.filter(
    (entry) => entry.commitmentTier === "weekend",
  );
  const weekendSlugs = weekendEntries.map((entry) => entry.slug);

  const client = createServiceClient();
  const { data, error } = await client
    .from("places")
    .select("slug,name,reservation_url,accepts_reservations,reservation_recommended")
    .in("slug", weekendSlugs);

  if (error) throw error;

  const rowsBySlug = new Map(
    ((data || []) as VenueRow[]).map((row) => [row.slug, row]),
  );

  const providerCounts = new Map<string, number>();

  console.log("Yonder accommodation provider audit");
  console.log(`Weekend anchors: ${weekendEntries.length}`);
  console.log(
    `Modeled provider rows: ${YONDER_ACCOMMODATION_INVENTORY_SOURCES.length}/${weekendEntries.length}`,
  );
  console.log("");

  for (const entry of weekendEntries) {
    const modeled = YONDER_ACCOMMODATION_INVENTORY_SOURCES.find(
      (item) => item.slug === entry.slug,
    );
    const venue = rowsBySlug.get(entry.slug);
    const provider = modeled
      ? YONDER_INVENTORY_PROVIDERS[modeled.providerId]
      : null;
    const reservationHost = getReservationHost(venue?.reservation_url || null);

    if (provider) {
      providerCounts.set(provider.id, (providerCounts.get(provider.id) || 0) + 1);
    }

    console.log(
      [
        entry.slug,
        provider?.shortLabel || "missing-provider",
        modeled?.coverageLevel || "missing-model",
        venue?.accepts_reservations === null
          ? "accepts=unknown"
          : venue?.accepts_reservations
            ? "accepts=yes"
            : "accepts=no",
        venue?.reservation_recommended === null
          ? "recommended=unknown"
          : venue?.reservation_recommended
            ? "recommended=yes"
            : "recommended=no",
        reservationHost || "-",
      ].join(" | "),
    );
  }

  console.log("");
  console.log("Provider family counts");
  for (const [providerId, count] of [...providerCounts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    console.log(`${providerId}: ${count}`);
  }
}

main().catch((error) => {
  console.error("Provider audit failed:", error);
  process.exitCode = 1;
});
