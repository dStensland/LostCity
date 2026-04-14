import { describe, it, expect } from "vitest";
import { RrfRanker } from "@/lib/search/ranking/rrf";
import type { Candidate, RetrieverId } from "@/lib/search/types";

function c(id: string, retriever: RetrieverId, score: number): Candidate {
  return {
    id, type: "event", source_retriever: retriever,
    raw_score: score, matched_fields: [], payload: {},
  };
}

describe("RrfRanker", () => {
  it("has a stable id", () => {
    expect(RrfRanker.id).toBe("rrf-k60");
  });

  it("fuses candidates from multiple retrievers", () => {
    const sets = new Map<RetrieverId, Candidate[]>([
      ["fts", [c("a", "fts", 0.9), c("b", "fts", 0.5)]],
      ["trigram", [c("b", "trigram", 0.8), c("c", "trigram", 0.6)]],
      ["structured", []],
    ]);
    const result = RrfRanker.rank(sets, { weights: {}, intent: { type: "find_event", confidence: 0.7 } });
    // 'b' appears in both → should outrank 'a' and 'c'
    expect(result[0].id).toBe("b");
    expect(result[0].contributing_retrievers).toContain("fts");
    expect(result[0].contributing_retrievers).toContain("trigram");
  });

  it("assigns ranks starting at 0", () => {
    const sets = new Map<RetrieverId, Candidate[]>([
      ["fts", [c("a", "fts", 0.9)]],
      ["trigram", []],
      ["structured", []],
    ]);
    const result = RrfRanker.rank(sets, { weights: {}, intent: { type: "find_event", confidence: 0.7 } });
    expect(result[0].rank).toBe(0);
  });

  it("handles empty retriever sets", () => {
    const sets = new Map<RetrieverId, Candidate[]>([
      ["fts", []], ["trigram", []], ["structured", []],
    ]);
    const result = RrfRanker.rank(sets, { weights: {}, intent: { type: "unknown", confidence: 0 } });
    expect(result).toEqual([]);
  });

  it("preserves id and type of merged candidates", () => {
    const sets = new Map<RetrieverId, Candidate[]>([
      ["fts", [c("a", "fts", 0.9)]],
      ["trigram", []],
      ["structured", []],
    ]);
    const result = RrfRanker.rank(sets, { weights: {}, intent: { type: "find_event", confidence: 0.7 } });
    expect(result[0].id).toBe("a");
    expect(result[0].type).toBe("event");
  });

  it("final_score decreases with rank in fused results", () => {
    const sets = new Map<RetrieverId, Candidate[]>([
      ["fts", [c("a", "fts", 0.9), c("b", "fts", 0.8), c("c", "fts", 0.7)]],
      ["trigram", []],
      ["structured", []],
    ]);
    const result = RrfRanker.rank(sets, { weights: {}, intent: { type: "find_event", confidence: 0.7 } });
    expect(result[0].final_score).toBeGreaterThan(result[1].final_score);
    expect(result[1].final_score).toBeGreaterThan(result[2].final_score);
  });
});
