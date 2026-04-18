import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Portal isolation tests for neighborhood event loaders.
 *
 * These tests assert STRUCTURE of the PostgREST filter chain — specifically
 * that `.or("portal_id.eq.{id},portal_id.is.null")` is applied when portalId
 * is passed and NOT applied when portalId is null. Catches the regression
 * we just fixed in PR #53 (entire portal filter missing) and any future
 * drop-of-filter drift.
 *
 * A full integration test that exercises "3 A + 2 B + 1 null; A-scope returns 4,
 * B-scope returns 3" requires a test DB or full PostgREST filter simulator —
 * tracked as follow-up. The structural test here is sufficient to guard the
 * client-side query-building contract.
 */

type Call = { method: string; args: unknown[] };

function makeBuilder(calls: Call[], terminalResult: unknown) {
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  const chainMethods = [
    "select",
    "eq",
    "neq",
    "in",
    "is",
    "gt",
    "gte",
    "lt",
    "lte",
    "or",
    "not",
    "order",
    "limit",
    "range",
  ];
  for (const m of chainMethods) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return builder;
    };
  }
  // Terminal: await on the builder resolves to the terminalResult.
  // Supabase builders are PromiseLike — they implement .then().
  builder.then = (onfulfilled: (v: unknown) => unknown) => {
    return Promise.resolve(terminalResult).then(onfulfilled);
  };
  return builder;
}

// Mock the supabase module BEFORE importing loaders
vi.mock("@/lib/supabase", () => {
  const calls: Call[] = [];
  const terminalByTable: Record<string, unknown> = {
    events: { data: [], error: null, count: 0 },
    places: { data: [], error: null },
  };
  const supabase = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return makeBuilder(calls, terminalByTable[table] ?? { data: [], error: null });
    },
    __calls: calls,
    __terminalByTable: terminalByTable,
  };
  return { supabase };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({}),
    rpc: () => Promise.resolve({ data: [], error: null }),
  }),
}));

// Import AFTER mocks are set up
import { supabase } from "@/lib/supabase";
import {
  getNeighborhoodEvents,
  getNeighborhoodEventCounts,
} from "@/lib/neighborhoods/loaders";

function getCalls(): Call[] {
  return (supabase as unknown as { __calls: Call[] }).__calls;
}

function orCalls(): string[] {
  return getCalls()
    .filter((c) => c.method === "or")
    .map((c) => c.args[0] as string);
}

const PORTAL_A = "00000000-0000-0000-0000-000000000001";

describe("neighborhood loaders portal isolation", () => {
  beforeEach(() => {
    getCalls().length = 0;
  });

  describe("getNeighborhoodEvents", () => {
    it("applies portal filter when portalId is provided", async () => {
      await getNeighborhoodEvents([101, 102], PORTAL_A);
      const ors = orCalls();
      expect(ors).toContain(`portal_id.eq.${PORTAL_A},portal_id.is.null`);
    });

    it("omits portal filter when portalId is null", async () => {
      await getNeighborhoodEvents([101, 102], null);
      const ors = orCalls();
      expect(ors.some((o) => o.includes("portal_id"))).toBe(false);
    });

    it("always applies sensitive-content filter regardless of portalId", async () => {
      await getNeighborhoodEvents([101, 102], null);
      const ors = orCalls();
      expect(ors).toContain("is_sensitive.eq.false,is_sensitive.is.null");
    });

    it("short-circuits with no query when placeIds is empty", async () => {
      getCalls().length = 0;
      const result = await getNeighborhoodEvents([], PORTAL_A);
      expect(result).toEqual([]);
      // Zero calls means no query was built — safe.
      expect(getCalls()).toHaveLength(0);
    });
  });

  describe("getNeighborhoodEventCounts", () => {
    it("applies portal filter to BOTH upcoming and today counts", async () => {
      await getNeighborhoodEventCounts([101], PORTAL_A);
      const portalFilterCount = orCalls().filter((o) =>
        o.includes(`portal_id.eq.${PORTAL_A}`),
      ).length;
      // Two event queries (upcoming + today) each get the portal filter.
      expect(portalFilterCount).toBe(2);
    });

    it("omits portal filter when portalId is null", async () => {
      await getNeighborhoodEventCounts([101], null);
      const ors = orCalls();
      expect(ors.some((o) => o.includes("portal_id"))).toBe(false);
    });

    it("returns zero counts when placeIds is empty without querying", async () => {
      getCalls().length = 0;
      const result = await getNeighborhoodEventCounts([], PORTAL_A);
      expect(result).toEqual({ todayCount: 0, upcomingCount: 0 });
      expect(getCalls()).toHaveLength(0);
    });
  });
});
