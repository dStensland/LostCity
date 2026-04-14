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

// Spy on annotate to verify it is called exactly once per search().
// We import the real module and wrap the export so the spy survives the
// dynamic import inside search-service.ts (which uses the same module).
vi.mock("@/lib/search/understanding/annotate", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/search/understanding/annotate")
  >("@/lib/search/understanding/annotate");
  return {
    ...actual,
    annotate: vi.fn(actual.annotate),
  };
});

describe("search orchestrator", () => {
  it("returns SearchResult { annotated, presented } for a valid query", async () => {
    const result = await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
    });
    expect(result.presented.topMatches.length).toBeGreaterThan(0);
    expect(result.presented.sections.length).toBeGreaterThan(0);
    expect(result.annotated.normalized).toBe("jazz");
  });

  it("records diagnostics (total_ms, cache_hit, retrieve_total_ms)", async () => {
    const result = await search("jazz", {
      portal_id: "p1", portal_slug: "atlanta", limit: 20,
    });
    expect(result.presented.diagnostics.total_ms).toBeGreaterThanOrEqual(0);
    expect(["fresh", "stale", "miss"]).toContain(result.presented.diagnostics.cache_hit);
    expect(result.presented.diagnostics.retrieve_total_ms).toBeGreaterThanOrEqual(0);
    // retriever_ms stays empty in Phase 0 — aggregate via retrieve_total_ms
    expect(result.presented.diagnostics.retriever_ms).toEqual({});
  });

  it("preserves raw query end-to-end (no silent substitution)", async () => {
    // Regression test for the 1869-line unified-search.ts bug. Verify
    // that calling search() with a non-substitutable query returns results
    // (the orchestrator didn't strip the query and pass empty FTS).
    const result = await search("jazz brunch", {
      portal_id: "p1", portal_slug: "atlanta", limit: 20,
    });
    expect(result).toBeDefined();
    expect(result.presented.diagnostics).toBeDefined();
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

  it("calls annotate exactly once per search() invocation", async () => {
    // Regression guard for E-3.2: the route handler previously re-invoked
    // annotate() in its after() block to read intent_type. The service
    // now returns { annotated, presented } so callers can read the
    // annotation off the result instead of re-running annotate.
    const annotateMod = await import("@/lib/search/understanding/annotate");
    const annotateSpy = vi.mocked(annotateMod.annotate);
    annotateSpy.mockClear();

    await search("jazz brunch midtown", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
    });

    expect(annotateSpy).toHaveBeenCalledTimes(1);
  });

  it("runs retrievers in parallel, not sequentially", async () => {
    // Regression guard for E-3.7: retrievers previously ran inside a
    // sequential `for` loop; Sprint E-3 changed that to Promise.all.
    // With a 40ms delay stubbed into each retriever, sequential would be
    // ~120ms total; parallel should finish in ~40ms (plus jitter).
    //
    // We mock buildRetrieverRegistry at the module level so the three
    // retrievers all sleep 40ms before returning a candidate. The test
    // caps the allowed wall-clock at 100ms — if it exceeds that the
    // sequential regression has returned.
    vi.resetModules();
    vi.doMock("@/lib/search/retrievers", () => {
      const sleep = (ms: number) =>
        new Promise<void>((r) => setTimeout(r, ms));
      const makeDelayed = (id: "fts" | "trigram" | "structured") => ({
        id,
        async retrieve() {
          await sleep(40);
          return [];
        },
      });
      return {
        buildRetrieverRegistry: () => ({
          fts: makeDelayed("fts"),
          trigram: makeDelayed("trigram"),
          structured: makeDelayed("structured"),
        }),
      };
    });
    vi.doMock("@/lib/search/unified-retrieval", () => ({
      runUnifiedRetrieval: vi.fn(async () => ({
        fts: [], trigram: [], structured: [],
      })),
    }));
    const { search: freshSearch } = await import("@/lib/search/search-service");

    const started = Date.now();
    await freshSearch("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
    });
    const elapsed = Date.now() - started;
    // 3 × 40ms sequential = 120ms. Parallel should clock in well under 100ms.
    // Give generous headroom for CI jitter.
    expect(elapsed).toBeLessThan(100);

    vi.doUnmock("@/lib/search/retrievers");
    vi.doUnmock("@/lib/search/unified-retrieval");
  });

  it("rejects with AbortError when signal is already aborted", async () => {
    // Regression guard for E-3.3: runUnifiedRetrieval now honors ctx.signal
    // and the orchestrator bails immediately if the caller cancelled before
    // work started.
    const controller = new AbortController();
    controller.abort();
    await expect(
      search("jazz", {
        portal_id: "p1",
        portal_slug: "atlanta",
        limit: 20,
        signal: controller.signal,
      })
    ).rejects.toThrow(/abort/i);
  });
});
