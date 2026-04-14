import { describe, it, expect, beforeAll } from "vitest";
import { search } from "@/lib/search";
import { parseSearchInput } from "@/lib/search/input-schema";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * End-to-end integration test for the search pipeline.
 *
 * Unlike the unit tests, which mock runUnifiedRetrieval and verify orchestrator
 * wiring in isolation, this test exercises the FULL pipeline against a live
 * Supabase instance:
 *
 *   Zod parse → normalize → annotate → search_unified RPC → retrievers
 *     → RRF ranking → grouped presenter → PresentedResults
 *
 * It is env-gated: the test only runs when real Supabase credentials are
 * present in process.env. Otherwise it is skipped so CI without DB access
 * stays green.
 *
 * Gating logic — a few things to know:
 *
 * 1. vitest.setup.ts hardcodes NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
 *    as a stub for unit tests. A naive Boolean check on that var would lie to us
 *    and try to run the integration test against a non-existent host. We detect
 *    and reject the stub value explicitly.
 *
 * 2. The real service-role key in .env.local is named SUPABASE_SERVICE_KEY
 *    (historical). createServiceClient accepts either SUPABASE_SERVICE_KEY
 *    or SUPABASE_SERVICE_ROLE_KEY, so we check both.
 *
 * 3. We do NOT load dotenv inside this test file. If .env.local is not loaded
 *    by the vitest runner, the test silently skips — which is the expected,
 *    safe outcome.
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const isStubUrl =
  supabaseUrl === "https://test.supabase.co" || supabaseUrl === "";
const hasServiceKey = Boolean(
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);
const hasDb = !isStubUrl && hasServiceKey;

const maybe = hasDb ? describe : describe.skip;

maybe("search integration (requires live DB)", () => {
  let portalId: string;

  beforeAll(async () => {
    const client = createServiceClient();
    const { data, error } = await client
      .from("portals")
      .select("id")
      .eq("slug", "atlanta")
      .single();
    if (error) throw new Error(`portal lookup failed: ${error.message}`);
    portalId = (data as { id: string } | null)?.id ?? "";
    if (!portalId) throw new Error("atlanta portal not found in test DB");
  });

  it("returns non-empty results for a common query", async () => {
    const result = await search("jazz", {
      portal_id: portalId,
      portal_slug: "atlanta",
      limit: 20,
    });
    expect(result.presented.diagnostics.total_ms).toBeGreaterThan(0);
    expect(
      result.presented.sections.length + result.presented.topMatches.length
    ).toBeGreaterThan(0);
  });

  it("returns zero results for nonsense query", async () => {
    const result = await search("qxzvwrbnonsense", {
      portal_id: portalId,
      portal_slug: "atlanta",
      limit: 20,
    });
    expect(result.presented.sections).toEqual([]);
    expect(result.presented.topMatches).toEqual([]);
  });

  it("end-to-end: parseSearchInput + search produces valid diagnostics shape", async () => {
    const params = new URLSearchParams("q=music&limit=5");
    const input = parseSearchInput(params);
    const result = await search(input.q, {
      portal_id: portalId,
      portal_slug: "atlanta",
      limit: input.limit,
    });
    expect(result.presented.diagnostics.cache_hit).toBeDefined();
    expect(result.annotated).toBeDefined();
    expect(result.annotated.raw).toBeDefined();
  });
});
