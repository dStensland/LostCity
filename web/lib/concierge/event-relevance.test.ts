import { describe, expect, it } from "vitest";
import { getQuickActions } from "@/lib/forth-data";
import type { FeedEvent } from "@/lib/forth-types";
import {
  dedupeConciergeEvents,
  getConciergeReasonChips,
  rankEventsForConcierge,
  scoreEventForConcierge,
} from "@/lib/concierge/event-relevance";

function event(overrides: Partial<FeedEvent>): FeedEvent {
  return {
    id: "1",
    title: "Sample Event",
    start_date: "2026-02-20",
    start_time: "19:00:00",
    category: "music",
    ...overrides,
  };
}

describe("concierge event relevance", () => {
  it("prefers hospitality-fit evening events over low-fit daytime community items", () => {
    const lowFit = event({
      id: "low",
      title: "Mobile Vaccine Clinic",
      category: "community",
      start_time: "10:00:00",
      distance_km: 0.7,
    });

    const highFit = event({
      id: "high",
      title: "Rooftop Jazz Night",
      category: "music",
      start_time: "20:00:00",
      distance_km: 1.1,
    });

    const ranked = rankEventsForConcierge([lowFit, highFit], "evening");

    expect(ranked[0].id).toBe("high");
    expect(scoreEventForConcierge(highFit, "evening")).toBeGreaterThan(
      scoreEventForConcierge(lowFit, "evening")
    );
  });

  it("dedupes repeated events with same id/date/time", () => {
    const first = event({ id: "repeat", title: "Late Night Set" });
    const second = event({ id: "repeat", title: "Late Night Set" });
    const unique = event({ id: "unique", title: "Chef Tasting" });

    const deduped = dedupeConciergeEvents([first, second, unique]);

    expect(deduped).toHaveLength(2);
    expect(deduped.map((item) => item.id)).toEqual(["repeat", "unique"]);
  });

  it("keeps quick actions pinned to existing concierge section anchors", () => {
    const validSectionIds = new Set(["tonight", "nearby", "specials", "plan"]);

    for (const dayPart of ["morning", "afternoon", "evening", "late_night"] as const) {
      const actions = getQuickActions(dayPart);
      for (const action of actions) {
        expect(validSectionIds.has(action.sectionId)).toBe(true);
      }
    }
  });

  it("generates concise reason chips for recommendation cards", () => {
    const chips = getConciergeReasonChips(
      event({
        title: "Rooftop Jazz Night",
        start_time: "20:30:00",
        distance_km: 0.8,
        category: "music",
      }),
      "evening",
    );

    expect(chips.length).toBeGreaterThan(0);
    expect(chips).toContain("Perfect for tonight");
    expect(chips).toContain("Walkable from hotel");
  });

  it("includes free-entry signal when event is free", () => {
    const chips = getConciergeReasonChips(
      event({
        id: "free-1",
        title: "Community Jazz Jam",
        start_time: "19:00:00",
        is_free: true,
      }),
      "evening",
      { maxChips: 4 },
    );

    expect(chips).toContain("Free entry");
  });
});
