/**
 * Integration test: verifies that filter params from SearchOptions.filters
 * are threaded through the full pipeline and arrive at the search_unified
 * RPC call with the correct parameter names.
 *
 * Root cause this guards: Zod parsed categories/neighborhoods/date/free/types
 * but the route handler only forwarded q + limit to search(). The values were
 * silently dropped at two layers — route handler and search-service.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { search } from "@/lib/search";

// Capture what the RPC is called with
const rpcSpy = vi.fn().mockResolvedValue({ data: [], error: null });

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc: rpcSpy,
  }),
}));

describe("filter wiring", () => {
  beforeEach(() => rpcSpy.mockClear());

  it("passes categories through to p_categories", async () => {
    await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
      filters: { categories: ["music", "nightlife"] },
    });
    expect(rpcSpy).toHaveBeenCalledWith(
      "search_unified",
      expect.objectContaining({ p_categories: ["music", "nightlife"] })
    );
  });

  it("passes neighborhoods through to p_neighborhoods", async () => {
    await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
      filters: { neighborhoods: ["midtown", "old_fourth_ward"] },
    });
    expect(rpcSpy).toHaveBeenCalledWith(
      "search_unified",
      expect.objectContaining({
        p_neighborhoods: ["midtown", "old_fourth_ward"],
      })
    );
  });

  it("passes free=true through to p_free_only", async () => {
    await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
      filters: { free: true },
    });
    expect(rpcSpy).toHaveBeenCalledWith(
      "search_unified",
      expect.objectContaining({ p_free_only: true })
    );
  });

  it("passes date='today' through to p_date_from/p_date_to", async () => {
    await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
      filters: { date: "today" },
    });
    const call = rpcSpy.mock.calls[0];
    const args = call[1] as Record<string, unknown>;
    expect(args.p_date_from).toBeTruthy();
    expect(args.p_date_to).toBeTruthy();
    expect(new Date(args.p_date_from as string).getTime()).toBeLessThanOrEqual(
      new Date(args.p_date_to as string).getTime()
    );
  });

  it("passes types array through to p_types (not hardcoded)", async () => {
    await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
      filters: { types: ["event"] },
    });
    expect(rpcSpy).toHaveBeenCalledWith(
      "search_unified",
      expect.objectContaining({ p_types: ["event"] })
    );
  });

  it("defaults to [event,venue,exhibition] when types not provided", async () => {
    await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
    });
    expect(rpcSpy).toHaveBeenCalledWith(
      "search_unified",
      expect.objectContaining({ p_types: ["event", "venue", "exhibition"] })
    );
  });

  it("fingerprint differs for different filter sets (cache-key regression guard)", async () => {
    // The AnnotatedQuery fingerprint MUST include filters — otherwise the
    // cache key collides across filter sets. We can't read fingerprint
    // directly here, but we verify the RPC was called for each query
    // (no cache collapse in Phase 0).
    await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
      filters: { categories: ["music"] },
    });
    await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
      filters: { categories: ["food"] },
    });
    expect(rpcSpy).toHaveBeenCalledTimes(2);
  });

  it("passes null to p_categories when no categories filter provided", async () => {
    await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
    });
    expect(rpcSpy).toHaveBeenCalledWith(
      "search_unified",
      expect.objectContaining({ p_categories: null })
    );
  });

  it("passes false to p_free_only when free filter not provided", async () => {
    await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
    });
    expect(rpcSpy).toHaveBeenCalledWith(
      "search_unified",
      expect.objectContaining({ p_free_only: false })
    );
  });
});
