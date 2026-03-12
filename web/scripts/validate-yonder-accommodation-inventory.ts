import {
  YONDER_ACCOMMODATION_INVENTORY_SOURCES,
  YONDER_INVENTORY_PROVIDERS,
} from "@/config/yonder-accommodation-inventory";
import { YONDER_DESTINATION_INTELLIGENCE } from "@/config/yonder-destination-intelligence";

function main() {
  const weekendEntries = YONDER_DESTINATION_INTELLIGENCE.filter(
    (entry) => entry.commitmentTier === "weekend",
  );
  const coveredSlugs = new Set(
    YONDER_ACCOMMODATION_INVENTORY_SOURCES.map((entry) => entry.slug),
  );

  console.log(`Weekend entries: ${weekendEntries.length}`);
  console.log(
    `With accommodation inventory model: ${
      weekendEntries.filter((entry) => coveredSlugs.has(entry.slug)).length
    }/${weekendEntries.length}`,
  );

  for (const entry of weekendEntries) {
    const inventory = YONDER_ACCOMMODATION_INVENTORY_SOURCES.find(
      (item) => item.slug === entry.slug,
    );

    if (!inventory) {
      console.log(`${entry.slug}: missing`);
      continue;
    }

    const provider = YONDER_INVENTORY_PROVIDERS[inventory.providerId];
    console.log(
      `${entry.slug}: ${provider.shortLabel} | ${inventory.coverageLevel} | ${inventory.integrationStatus} | ${inventory.unitSummaries.length} units`,
    );
  }
}

main();
