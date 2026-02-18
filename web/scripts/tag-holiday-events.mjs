import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rtppvljfrkjtoxmaizea.supabase.co";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0cHB2bGpmcmtqdG94bWFpemVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDMzMTQsImV4cCI6MjA4MzcxOTMxNH0.KN1csOc0xOTDb3VSz5LgT-tMrcQNxOHNmp0yWsa83Wg";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------- Event definitions ----------

const HOLIDAYS = [
  {
    tag: "womens-history-month",
    label: "Women's History Month",
    eventIds: [
      // High-confidence WHM
      17677, 51910, 15934, 26066, 53188, 12495, 7262, 46200,
      // Ladies Night (March WHM tie-in)
      15503, 15534, 15532, 53469, 15207, 56478, 17535,
      // Circle of Sisterhood
      46203, 46204, 59471,
      // Menopause the Musical 2
      11131, 11132, 11133, 11134, 11135, 11137, 58231,
    ],
  },
  {
    tag: "st-patricks-day",
    label: "St. Patrick's Day",
    eventIds: [
      26197, 20456, 26231, 21743, 35201, 25373, 25372, 21032,
      53115, 53547, 53158, 13180, 34665, 15412, 2176, 53015,
      21967, 15333,
      // Pre-St. Pat's Irish cultural events
      7648, 13088, 23080,
    ],
  },
  {
    tag: "ramadan",
    label: "Ramadan",
    eventIds: [60536],
  },
];

// ---------- Main logic ----------

async function tagEvents() {
  const summary = {};

  for (const holiday of HOLIDAYS) {
    const { tag, label, eventIds } = holiday;
    summary[label] = { attempted: eventIds.length, tagged: 0, skipped: 0, errors: 0 };

    console.log(`\n========== ${label} (tag: "${tag}") ==========`);
    console.log(`Processing ${eventIds.length} events...\n`);

    for (const eventId of eventIds) {
      // 1. Fetch the current event
      const { data: event, error: fetchError } = await supabase
        .from("events")
        .select("id, title, tags")
        .eq("id", eventId)
        .single();

      if (fetchError) {
        console.error(`  [ERROR] Event ${eventId}: fetch failed - ${fetchError.message}`);
        summary[label].errors++;
        continue;
      }

      if (!event) {
        console.error(`  [ERROR] Event ${eventId}: not found`);
        summary[label].errors++;
        continue;
      }

      // 2. Check if tag is already present
      const currentTags = event.tags ?? [];
      if (currentTags.includes(tag)) {
        console.log(`  [SKIP]  ${eventId} - "${event.title}" already has tag "${tag}"`);
        summary[label].skipped++;
        continue;
      }

      // 3. Append the tag
      const newTags = [...currentTags, tag];
      const { error: updateError } = await supabase
        .from("events")
        .update({ tags: newTags })
        .eq("id", eventId);

      if (updateError) {
        console.error(`  [ERROR] Event ${eventId} ("${event.title}"): update failed - ${updateError.message}`);
        summary[label].errors++;
        continue;
      }

      console.log(`  [ADDED] ${eventId} - "${event.title}" => tag "${tag}" added (tags now: [${newTags.join(", ")}])`);
      summary[label].tagged++;
    }
  }

  // ---------- Summary ----------
  console.log("\n\n============================");
  console.log("         SUMMARY");
  console.log("============================");
  let totalTagged = 0;
  let totalErrors = 0;
  let totalSkipped = 0;
  for (const [label, counts] of Object.entries(summary)) {
    console.log(`\n  ${label}:`);
    console.log(`    Attempted: ${counts.attempted}`);
    console.log(`    Tagged:    ${counts.tagged}`);
    console.log(`    Skipped:   ${counts.skipped} (already had tag)`);
    console.log(`    Errors:    ${counts.errors}`);
    totalTagged += counts.tagged;
    totalErrors += counts.errors;
    totalSkipped += counts.skipped;
  }
  console.log(`\n  TOTAL: ${totalTagged} events tagged, ${totalSkipped} skipped, ${totalErrors} errors`);
  console.log("============================\n");
}

tagEvents().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
