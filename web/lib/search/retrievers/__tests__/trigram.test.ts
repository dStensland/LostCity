import { describe, it, expect } from "vitest";
import { createTrigramRetriever } from "@/lib/search/retrievers/trigram";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

function source(scores: number[]): UnifiedRetrievalResult {
  return {
    fts: [],
    structured: [],
    trigram: scores.map((s, i) => ({
      id: `${i}`,
      type: "event" as const,
      source_retriever: "trigram" as const,
      raw_score: s,
      matched_fields: [],
      payload: {},
    })),
  };
}

const mockQuery: AnnotatedQuery = Object.freeze({
  raw: "test", normalized: "test",
  tokens: Object.freeze([]), entities: Object.freeze([]),
  spelling: Object.freeze([]), synonyms: Object.freeze([]),
  structured_filters: Object.freeze({}),
  intent: { type: "find_event", confidence: 0.7 },
  fingerprint: "abc",
});

const mockCtx = {
  portal_id: "p",
  limit: 10,
  signal: new AbortController().signal,
};

describe("TrigramRetriever", () => {
  it("has id 'trigram'", () => {
    expect(createTrigramRetriever(source([])).id).toBe("trigram");
  });

  it("filters out candidates below similarity floor (0.25)", async () => {
    const r = createTrigramRetriever(source([0.8, 0.5, 0.2, 0.1]));
    const result = await r.retrieve(mockQuery, mockCtx);
    expect(result).toHaveLength(2); // 0.8, 0.5 — 0.2 and 0.1 below floor
  });

  it("preserves input order above the floor", async () => {
    const r = createTrigramRetriever(source([0.9, 0.7, 0.5]));
    const result = await r.retrieve(mockQuery, mockCtx);
    expect(result[0].raw_score).toBe(0.9);
    expect(result[2].raw_score).toBe(0.5);
  });

  it("returns empty array when all below floor", async () => {
    const r = createTrigramRetriever(source([0.2, 0.1, 0.05]));
    const result = await r.retrieve(mockQuery, mockCtx);
    expect(result).toEqual([]);
  });
});
