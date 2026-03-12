import { YONDER_DESTINATION_INTELLIGENCE } from "@/config/yonder-destination-intelligence";

function main() {
  const weekendEntries = YONDER_DESTINATION_INTELLIGENCE.filter(
    (item) => item.commitmentTier === "weekend",
  );
  const withStayProfile = weekendEntries.filter(
    (item) => item.overnightSupport?.stayProfile,
  );

  console.log("Yonder stay-profile validation");
  console.log(`Weekend entries: ${weekendEntries.length}`);
  console.log(`With stay profile: ${withStayProfile.length}/${weekendEntries.length}`);
  console.log("");

  for (const item of weekendEntries) {
    const profile = item.overnightSupport?.stayProfile;
    console.log(
      [
        item.slug,
        profile ? profile.inventoryDepth : "missing",
        profile ? profile.leadTime : "-",
        profile ? profile.priceSignal : "-",
      ].join(" | "),
    );
  }

  if (withStayProfile.length !== weekendEntries.length) {
    process.exitCode = 1;
  }
}

main();
