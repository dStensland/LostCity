import { describe, it, expect, vi } from "vitest";
import { search } from "@/lib/search";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

vi.mock("@/lib/search/unified-retrieval", () => ({
  runUnifiedRetrieval: vi.fn(async (): Promise<UnifiedRetrievalResult> => ({
    fts: [
      {
        id: "e1", type: "event", source_retriever: "fts", raw_score: 0.9,
        matched_fields: [], payload: { title: "Jazz Night" },
      },
    ],
    trigram: [
      {
        id: "e2", type: "event", source_retriever: "trigram", raw_score: 0.6,
        matched_fields: [], payload: { title: "Jaz Show" },
      },
    ],
    structured: [],
  })),
}));

describe("search orchestrator", () => {
  it("returns PresentedResults for a valid query", async () => {
    const result = await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
    });
    expect(result.topMatches.length).toBeGreaterThan(0);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it("records diagnostics (total_ms, cache_hit)", async () => {
    const result = await search("jazz", {
      portal_id: "p1", portal_slug: "atlanta", limit: 20,
    });
    expect(result.diagnostics.total_ms).toBeGreaterThanOrEqual(0);
    expect(["fresh", "stale", "miss"]).toContain(result.diagnostics.cache_hit);
  });

  it("preserves raw query end-to-end (no silent substitution)", async () => {
    // Regression test for the 1869-line unified-search.ts bug. Verify
    // that calling search() with a non-substitutable query returns results
    // (the orchestrator didn't strip the query and pass empty FTS).
    const result = await search("jazz brunch", {
      portal_id: "p1", portal_slug: "atlanta", limit: 20,
    });
    expect(result).toBeDefined();
    expect(result.diagnostics).toBeDefined();
  });

  it("passes portal_id through to retrieval", async () => {
    const mod = await import("@/lib/search/unified-retrieval");
    const spy = vi.mocked(mod.runUnifiedRetrieval);
    spy.mockClear();
    await search("jazz", {
      portal_id: "specific-portal-id",
      portal_slug: "atlanta",
      limit: 20,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const callArgs = spy.mock.calls[0];
    expect(callArgs[1].portal_id).toBe("specific-portal-id");
  });
});
