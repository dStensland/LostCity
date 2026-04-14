import { describe, it, expect } from "vitest";
import { createFtsRetriever } from "@/lib/search/retrievers/fts";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

const mockSource: UnifiedRetrievalResult = {
  fts: [
    { id: "1", type: "event", source_retriever: "fts",
      raw_score: 0.9, matched_fields: [], payload: {} },
    { id: "2", type: "event", source_retriever: "fts",
      raw_score: 0.7, matched_fields: [], payload: {} },
  ],
  trigram: [],
  structured: [],
};

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

describe("FtsRetriever", () => {
  it("has id 'fts'", () => {
    const r = createFtsRetriever(mockSource);
    expect(r.id).toBe("fts");
  });

  it("returns the fts slice of the source", async () => {
    const r = createFtsRetriever(mockSource);
    const result = await r.retrieve(mockQuery, mockCtx);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1");
  });

  it("returns empty array when source has no fts results", async () => {
    const empty: UnifiedRetrievalResult = { fts: [], trigram: [], structured: [] };
    const r = createFtsRetriever(empty);
    expect(await r.retrieve(mockQuery, mockCtx)).toEqual([]);
  });

  it("preserves raw_score monotonicity (source is already sorted)", async () => {
    const r = createFtsRetriever(mockSource);
    const result = await r.retrieve(mockQuery, mockCtx);
    expect(result[0].raw_score).toBeGreaterThanOrEqual(result[1].raw_score);
  });
});
