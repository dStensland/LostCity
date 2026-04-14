import { describe, it, expect, vi, beforeEach } from "vitest";
import { runUnifiedRetrieval, type UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc: vi.fn().mockResolvedValue({
      data: [
        { retriever_id: "fts", entity_type: "event", entity_id: "e1",
          raw_score: 0.9, quality: 0.8, days_out: 3, title: "Jazz Night",
          venue_name: "Variety Playhouse", neighborhood: null,
          image_url: null, href_slug: "e1",
          starts_at: "2026-04-16T20:00:00Z" },
        { retriever_id: "trigram", entity_type: "event", entity_id: "e2",
          raw_score: 0.7, quality: 0.5, days_out: 5, title: "Jaz Fest",
          venue_name: "The Earl", neighborhood: null,
          image_url: null, href_slug: "e2",
          starts_at: "2026-04-18T18:00:00Z" },
        { retriever_id: "trigram", entity_type: "venue", entity_id: "v1",
          raw_score: 0.85, quality: 0.5, days_out: 0, title: "The Jazz Corner",
          venue_name: null, neighborhood: "Midtown",
          image_url: null, href_slug: "jazz-corner",
          starts_at: null },
      ],
      error: null,
    }),
  }),
}));

const mockQuery: AnnotatedQuery = Object.freeze({
  raw: "jazz",
  normalized: "jazz",
  tokens: Object.freeze([]),
  entities: Object.freeze([]),
  spelling: Object.freeze([]),
  synonyms: Object.freeze([]),
  structured_filters: Object.freeze({}),
  intent: { type: "find_event", confidence: 0.7 },
  fingerprint: "abc123",
});

describe("runUnifiedRetrieval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("demultiplexes rows into per-retriever map", async () => {
    const result = await runUnifiedRetrieval(mockQuery, {
      portal_id: "p1",
      limit: 20,
      signal: new AbortController().signal,
    });
    expect(result.fts).toHaveLength(1);       // 1 event
    expect(result.trigram).toHaveLength(2);   // 1 event + 1 venue
    expect(result.structured).toHaveLength(0);
  });

  it("preserves retriever + type tags on candidates", async () => {
    const result = await runUnifiedRetrieval(mockQuery, {
      portal_id: "p1",
      limit: 20,
      signal: new AbortController().signal,
    });
    expect(result.fts[0].source_retriever).toBe("fts");
    expect(result.fts[0].type).toBe("event");
    expect(result.trigram[0].source_retriever).toBe("trigram");
  });

  it("puts venue_name in payload for events", async () => {
    const result = await runUnifiedRetrieval(mockQuery, {
      portal_id: "p1",
      limit: 20,
      signal: new AbortController().signal,
    });
    const eventCandidate = result.fts[0];
    expect(eventCandidate.payload.venue_name).toBe("Variety Playhouse");
    expect(eventCandidate.payload.neighborhood).toBeNull();
  });

  it("puts neighborhood in payload for venues", async () => {
    const result = await runUnifiedRetrieval(mockQuery, {
      portal_id: "p1",
      limit: 20,
      signal: new AbortController().signal,
    });
    const venueCandidate = result.trigram.find((c) => c.type === "venue");
    expect(venueCandidate).toBeDefined();
    expect(venueCandidate!.payload.neighborhood).toBe("Midtown");
    expect(venueCandidate!.payload.venue_name).toBeNull();
  });

  it("fails closed on missing portal_id", async () => {
    await expect(
      runUnifiedRetrieval(mockQuery, {
        portal_id: "",
        limit: 20,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow(/portal_id/);
  });
});

// Separate describe block so we can install a custom mock that returns an
// unknown retriever_id. The unified-retrieval module fails loudly rather
// than silently dropping rows it doesn't recognize — this pins that contract.
describe("runUnifiedRetrieval throw path", () => {
  beforeEach(() => vi.resetModules());

  it("throws on unknown retriever_id rather than dropping the row", async () => {
    vi.doMock("@/lib/supabase/service", () => ({
      createServiceClient: () => ({
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              retriever_id: "mystery_meat",
              entity_type: "event",
              entity_id: "e99",
              raw_score: 0.5,
              quality: 0.5,
              days_out: 1,
              title: "Unknown Bucket Event",
              venue_name: null,
              neighborhood: null,
              image_url: null,
              href_slug: "e99",
              starts_at: null,
            },
          ],
          error: null,
        }),
      }),
    }));

    const { runUnifiedRetrieval: runFresh } = await import(
      "@/lib/search/unified-retrieval"
    );

    await expect(
      runFresh(mockQuery, {
        portal_id: "p1",
        limit: 20,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow(/unknown retriever_id 'mystery_meat'/);
  });

  it("throws when the RPC itself returns an error", async () => {
    vi.doMock("@/lib/supabase/service", () => ({
      createServiceClient: () => ({
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "permission denied for function search_unified" },
        }),
      }),
    }));

    const { runUnifiedRetrieval: runFresh } = await import(
      "@/lib/search/unified-retrieval"
    );

    await expect(
      runFresh(mockQuery, {
        portal_id: "p1",
        limit: 20,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow(/search_unified failed: permission denied/);
  });
});
