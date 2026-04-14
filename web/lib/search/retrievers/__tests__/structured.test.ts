import { describe, it, expect } from "vitest";
import { createStructuredRetriever } from "@/lib/search/retrievers/structured";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

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

describe("StructuredRetriever", () => {
  it("has id 'structured'", () => {
    const source: UnifiedRetrievalResult = { fts: [], trigram: [], structured: [] };
    expect(createStructuredRetriever(source).id).toBe("structured");
  });

  it("returns the structured slice unchanged", async () => {
    const source: UnifiedRetrievalResult = {
      fts: [], trigram: [],
      structured: [{
        id: "1", type: "event", source_retriever: "structured",
        raw_score: 1.0, matched_fields: [], payload: {},
      }],
    };
    const r = createStructuredRetriever(source);
    const result = await r.retrieve(mockQuery, mockCtx);
    expect(result).toHaveLength(1);
  });
});
