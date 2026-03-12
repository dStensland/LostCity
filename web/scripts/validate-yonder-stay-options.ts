import { YONDER_DESTINATION_INTELLIGENCE } from "@/config/yonder-destination-intelligence";

function main() {
  const weekendEntries = YONDER_DESTINATION_INTELLIGENCE.filter(
    (item) => item.commitmentTier === "weekend",
  );
  const withStayOptions = weekendEntries.filter(
    (item) => item.overnightSupport?.stayOptions?.length,
  );

  console.log("Yonder stay-option validation");
  console.log(`Weekend entries: ${weekendEntries.length}`);
  console.log(`With stay options: ${withStayOptions.length}/${weekendEntries.length}`);
  console.log("");

  for (const item of weekendEntries) {
    const labels =
      item.overnightSupport?.stayOptions?.map((option) => option.label).join(", ") || "-";
    console.log([item.slug, labels].join(" | "));
  }

  if (withStayOptions.length !== weekendEntries.length) {
    process.exitCode = 1;
  }
}

main();
