import { YONDER_DESTINATION_INTELLIGENCE } from "@/config/yonder-destination-intelligence";

function main() {
  const weekendEntries = YONDER_DESTINATION_INTELLIGENCE.filter(
    (item) => item.commitmentTier === "weekend",
  );
  const withOvernightSupport = weekendEntries.filter(
    (item) => item.overnightSupport,
  );

  console.log("Yonder overnight support validation");
  console.log(`Weekend entries: ${weekendEntries.length}`);
  console.log(`With overnight support: ${withOvernightSupport.length}/${weekendEntries.length}`);
  console.log("");

  for (const item of weekendEntries) {
    const support = item.overnightSupport;
    console.log(
      [
        item.slug,
        support ? support.overnightReadiness : "missing",
        support ? support.accommodationTypes.join(",") : "-",
        support ? support.bookingStyle : "-",
      ].join(" | "),
    );
  }

  if (withOvernightSupport.length !== weekendEntries.length) {
    process.exitCode = 1;
  }
}

main();
