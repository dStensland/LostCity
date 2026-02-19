import { describe, expect, it } from "vitest";
import type { FeedSection as OrchestratorFeedSection } from "@/lib/agents/concierge/types";
import { filterOrchestrationSectionsByPolicy } from "@/lib/concierge/orchestration-policy";

function section(events: NonNullable<OrchestratorFeedSection["events"]>): OrchestratorFeedSection {
  return {
    title: "Tonight",
    slug: "tonight",
    events,
  };
}

describe("orchestration policy adapter", () => {
  it("filters low-fit excluded events while preserving valid options", () => {
    const sections: OrchestratorFeedSection[] = [
      section([
        {
          id: "clinic",
          title: "Mobile Vaccine Clinic",
          start_date: "2026-02-20",
          start_time: "10:00:00",
          category: "community",
        },
        {
          id: "jazz",
          title: "Rooftop Jazz Night",
          start_date: "2026-02-20",
          start_time: "20:00:00",
          category: "music",
        },
        {
          id: "dinner",
          title: "Chef Dinner Tasting",
          start_date: "2026-02-20",
          start_time: "19:30:00",
          category: "food_drink",
        },
      ]),
    ];

    const filtered = filterOrchestrationSectionsByPolicy({ settings: {} }, sections, "evening");
    const ids = (filtered[0].events || []).map((event) => String(event.id));

    expect(ids).not.toContain("clinic");
    expect(ids).toContain("jazz");
    expect(ids).toContain("dinner");
  });

  it("falls back to original sections when strict filtering yields no section", () => {
    const sections: OrchestratorFeedSection[] = [
      section([
        {
          id: "community-1",
          title: "Community Workshop",
          start_date: "2026-02-20",
          start_time: "09:00:00",
          category: "community",
        },
        {
          id: "community-2",
          title: "Neighborhood Support Group",
          start_date: "2026-02-20",
          start_time: "11:00:00",
          category: "community",
        },
      ]),
    ];

    const filtered = filterOrchestrationSectionsByPolicy({ settings: {} }, sections, "morning");
    const ids = (filtered[0].events || []).map((event) => String(event.id));

    expect(filtered).toHaveLength(1);
    expect(ids).toEqual(["community-1", "community-2"]);
  });
});
