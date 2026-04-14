import { describe, it, expect } from "vitest";
import { GroupedPresenter } from "@/lib/search/presenting/grouped";
import type { RankedCandidate } from "@/lib/search/ranking/types";
import type { EntityType } from "@/lib/search/types";

function rc(id: string, type: EntityType, score: number): RankedCandidate {
  return {
    id, type, source_retriever: "fts",
    raw_score: score, matched_fields: [], payload: {},
    final_score: score, contributing_retrievers: ["fts"], rank: 0,
  };
}

const policy = {
  topMatchesCount: 3,
  groupCaps: { event: 8, venue: 6 } as Partial<Record<EntityType, number>>,
  diversityLambda: 0,
  dedupeKey: (c: RankedCandidate) => `${c.type}:${c.id}`,
};

describe("GroupedPresenter", () => {
  it("produces topMatches capped at policy.topMatchesCount", () => {
    const ranked = [
      rc("a", "event", 0.9), rc("b", "venue", 0.8),
      rc("c", "event", 0.7), rc("d", "event", 0.6),
      rc("e", "venue", 0.5),
    ];
    const result = GroupedPresenter.present(ranked, policy);
    expect(result.topMatches).toHaveLength(3);
  });

  it("groups candidates by type", () => {
    const ranked = [
      rc("a", "event", 0.9), rc("b", "venue", 0.8),
      rc("c", "event", 0.7),
    ];
    const result = GroupedPresenter.present(ranked, policy);
    const eventSection = result.sections.find((s) => s.type === "event");
    const venueSection = result.sections.find((s) => s.type === "venue");
    expect(eventSection?.items).toHaveLength(2);
    expect(venueSection?.items).toHaveLength(1);
  });

  it("caps each section at groupCaps", () => {
    const ranked = Array.from({ length: 15 }, (_, i) => rc(`e${i}`, "event", 1 - i * 0.01));
    const result = GroupedPresenter.present(ranked, policy);
    const eventSection = result.sections.find((s) => s.type === "event");
    expect(eventSection?.items).toHaveLength(8); // policy.groupCaps.event
    expect(eventSection?.total).toBe(15);
  });

  it("returns totals per type", () => {
    const ranked = [rc("a", "event", 0.9), rc("b", "event", 0.8), rc("c", "venue", 0.7)];
    const result = GroupedPresenter.present(ranked, policy);
    expect(result.totals.event).toBe(2);
    expect(result.totals.venue).toBe(1);
  });

  it("handles empty input", () => {
    const result = GroupedPresenter.present([], policy);
    expect(result.topMatches).toEqual([]);
    expect(result.sections).toEqual([]);
  });

  it("dedupes via policy.dedupeKey", () => {
    const ranked = [
      rc("a", "event", 0.9),
      rc("a", "event", 0.8), // duplicate
      rc("b", "event", 0.7),
    ];
    const result = GroupedPresenter.present(ranked, policy);
    const eventSection = result.sections.find((s) => s.type === "event");
    expect(eventSection?.items).toHaveLength(2);
  });

  it("diagnostics has the expected shape", () => {
    const result = GroupedPresenter.present([rc("a", "event", 0.9)], policy);
    expect(result.diagnostics).toMatchObject({
      total_ms: expect.any(Number),
      cache_hit: "miss",
      degraded: false,
    });
  });
});
