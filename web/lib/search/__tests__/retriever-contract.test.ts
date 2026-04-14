/**
 * Retriever contract test. Enforces that every registered retriever is:
 *   1. PURE — same input produces same output
 *   2. MONOTONIC — raw_score is non-increasing in the returned array
 *   3. SELF-LABELED — every candidate has source_retriever === retriever.id
 *
 * Sprint E-1.2 FIX: The original test scaffold used a directory-import path
 * hack (process.cwd() + "/lib/search/retrievers") that Node ESM rejects with
 * ERR_UNSUPPORTED_DIR_IMPORT. The catch swallowed the error, loadRegistry()
 * returned null, and every test body exited early via `if (registry === null)
 * return`. All 4 tests reported passing despite executing zero assertions.
 *
 * Fix: static import from @/lib/search/retrievers + real fixture with
 * non-trivial cross-retriever data including one candidate below the 0.25
 * trigram floor (which the TrigramRetriever must filter out).
 *
 * Together with the `no-retriever-rpc-calls` ESLint rule, this is the second
 * half of the three-layer contract enforcement: lint prevents DB calls at
 * compile time, contract test verifies runtime behavior.
 */

import { describe, it, expect } from "vitest";
import { buildRetrieverRegistry } from "@/lib/search/retrievers";
import type { Candidate, RetrieverContext } from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * Non-trivial fixture with:
 *   - 5 fts rows (monotonically decreasing raw_score)
 *   - 5 trigram rows: 4 above 0.25 floor + 1 below (e7 at 0.15)
 *   - 1 cross-retriever overlap: e3 appears in both fts and trigram
 *   - 1 structured row
 */
function buildFixture(): UnifiedRetrievalResult {
  return {
    fts: [
      // Rows must be monotonically non-increasing in raw_score — this mirrors
      // the SQL function's ORDER BY ts_rank_cd DESC guarantee. FtsRetriever
      // is a pass-through; the fixture must respect this invariant.
      {
        id: "e1",
        type: "event",
        source_retriever: "fts",
        raw_score: 0.9,
        matched_fields: [],
        payload: { title: "Jazz Night" },
      },
      {
        id: "v1",
        type: "venue",
        source_retriever: "fts",
        raw_score: 0.85,
        matched_fields: [],
        payload: { title: "The Jazz Corner" },
      },
      {
        id: "e2",
        type: "event",
        source_retriever: "fts",
        raw_score: 0.7,
        matched_fields: [],
        payload: { title: "Blue Note" },
      },
      {
        id: "e3",
        type: "event",
        source_retriever: "fts",
        raw_score: 0.5,
        matched_fields: [],
        payload: { title: "Smooth Jazz Brunch" },
      },
      {
        id: "v2",
        type: "venue",
        source_retriever: "fts",
        raw_score: 0.4,
        matched_fields: [],
        payload: { title: "Jazz Room" },
      },
    ],
    trigram: [
      {
        id: "e4",
        type: "event",
        source_retriever: "trigram",
        raw_score: 0.8,
        matched_fields: [],
        payload: { title: "Jazzy Brunch" },
      },
      {
        id: "e5",
        type: "event",
        source_retriever: "trigram",
        raw_score: 0.6,
        matched_fields: [],
        payload: { title: "Jazz Session" },
      },
      {
        id: "e3",
        type: "event",
        source_retriever: "trigram",
        raw_score: 0.45,
        matched_fields: [],
        payload: { title: "Smooth Jazz Brunch" },
      }, // cross-retriever overlap with fts
      {
        id: "e6",
        type: "event",
        source_retriever: "trigram",
        raw_score: 0.3,
        matched_fields: [],
        payload: { title: "Jaz Evening" },
      },
      // BELOW similarity floor 0.25 — TrigramRetriever must filter this out
      {
        id: "e7",
        type: "event",
        source_retriever: "trigram",
        raw_score: 0.15,
        matched_fields: [],
        payload: { title: "Jz" },
      },
    ],
    structured: [
      {
        id: "e8",
        type: "event",
        source_retriever: "structured",
        raw_score: 1.0,
        matched_fields: [],
        payload: { title: "Music Category Match" },
      },
    ],
  };
}

const mockAnnotatedQuery: AnnotatedQuery = Object.freeze({
  raw: "jazz",
  normalized: "jazz",
  tokens: Object.freeze([]) as AnnotatedQuery["tokens"],
  entities: Object.freeze([]) as AnnotatedQuery["entities"],
  spelling: Object.freeze([]) as AnnotatedQuery["spelling"],
  synonyms: Object.freeze([]) as AnnotatedQuery["synonyms"],
  structured_filters: Object.freeze({}),
  intent: { type: "find_event" as const, confidence: 0.7 },
  fingerprint: "contract-test-fixture",
});

const mockContext: RetrieverContext = {
  portal_id: "contract-test-portal",
  limit: 20,
  signal: new AbortController().signal,
};

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

describe("Retriever contract", () => {
  // Meta-assertion: guards against future regression back to the silent-skip
  // pattern. If registry is null, every retriever test would silently pass.
  it("meta: registry is non-null and contains expected retriever ids", () => {
    const registry = buildRetrieverRegistry(buildFixture());
    expect(registry).not.toBeNull();
    expect(Object.keys(registry)).toEqual(
      expect.arrayContaining(["fts", "trigram", "structured"])
    );
  });

  describe("FtsRetriever", () => {
    it("is pure — same input, same output", async () => {
      const registry = buildRetrieverRegistry(buildFixture());
      const a = await registry.fts.retrieve(mockAnnotatedQuery, mockContext);
      const b = await registry.fts.retrieve(mockAnnotatedQuery, mockContext);
      expect(a).toEqual(b);
    });

    it("returns raw_score non-increasing (monotonic)", async () => {
      const registry = buildRetrieverRegistry(buildFixture());
      const result = await registry.fts.retrieve(mockAnnotatedQuery, mockContext);
      expect(result.length).toBeGreaterThan(0);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].raw_score).toBeGreaterThanOrEqual(result[i].raw_score);
      }
    });

    it("every candidate has source_retriever='fts'", async () => {
      const registry = buildRetrieverRegistry(buildFixture());
      const result = await registry.fts.retrieve(mockAnnotatedQuery, mockContext);
      for (const c of result) {
        expect(c.source_retriever).toBe("fts");
      }
    });
  });

  describe("TrigramRetriever", () => {
    it("is pure — same input, same output", async () => {
      const registry = buildRetrieverRegistry(buildFixture());
      const a = await registry.trigram.retrieve(mockAnnotatedQuery, mockContext);
      const b = await registry.trigram.retrieve(mockAnnotatedQuery, mockContext);
      expect(a).toEqual(b);
    });

    it("filters out candidates below 0.25 similarity floor", async () => {
      const registry = buildRetrieverRegistry(buildFixture());
      const result = await registry.trigram.retrieve(mockAnnotatedQuery, mockContext);
      expect(result.length).toBeGreaterThan(0);
      for (const c of result) {
        expect(c.raw_score).toBeGreaterThanOrEqual(0.25);
      }
      // Specifically: e7 (raw_score 0.15) must NOT appear
      expect(result.find((c: Candidate) => c.id === "e7")).toBeUndefined();
    });

    it("returns raw_score non-increasing after filtering", async () => {
      const registry = buildRetrieverRegistry(buildFixture());
      const result = await registry.trigram.retrieve(mockAnnotatedQuery, mockContext);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].raw_score).toBeGreaterThanOrEqual(result[i].raw_score);
      }
    });

    it("every candidate has source_retriever='trigram'", async () => {
      const registry = buildRetrieverRegistry(buildFixture());
      const result = await registry.trigram.retrieve(mockAnnotatedQuery, mockContext);
      for (const c of result) {
        expect(c.source_retriever).toBe("trigram");
      }
    });
  });

  describe("StructuredRetriever", () => {
    it("is pure — same input, same output", async () => {
      const registry = buildRetrieverRegistry(buildFixture());
      const a = await registry.structured.retrieve(mockAnnotatedQuery, mockContext);
      const b = await registry.structured.retrieve(mockAnnotatedQuery, mockContext);
      expect(a).toEqual(b);
    });

    it("passes through the structured slice", async () => {
      const registry = buildRetrieverRegistry(buildFixture());
      const result = await registry.structured.retrieve(
        mockAnnotatedQuery,
        mockContext
      );
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("e8");
    });

    it("every candidate has source_retriever='structured'", async () => {
      const registry = buildRetrieverRegistry(buildFixture());
      const result = await registry.structured.retrieve(
        mockAnnotatedQuery,
        mockContext
      );
      for (const c of result) {
        expect(c.source_retriever).toBe("structured");
      }
    });
  });
});
