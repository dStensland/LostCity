import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock, fetchSocialProofCountsMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
  fetchSocialProofCountsMock: vi.fn(),
}));

vi.mock("./supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

vi.mock("@/lib/search", () => ({
  fetchSocialProofCounts: fetchSocialProofCountsMock,
}));

import { unifiedSearch } from "@/lib/unified-search";

type RpcCall = {
  fn: string;
  args: Record<string, unknown>;
};

function createMockClient(portalFilters: Record<string, unknown> | null = { city: "Atlanta" }) {
  const rpcCalls: RpcCall[] = [];
  const fromCalls: string[] = [];

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    return { data: [], error: null };
  });

  const from = vi.fn((table: string) => {
    fromCalls.push(table);
    if (table !== "portals") {
      throw new Error(`Unexpected table lookup: ${table}`);
    }

    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({
        data: portalFilters ? { filters: portalFilters } : null,
      })),
    };

    return chain;
  });

  return { client: { rpc, from }, rpcCalls, fromCalls };
}

describe("unifiedSearch portal city behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSocialProofCountsMock.mockResolvedValue(new Map());
  });

  it("resolves city from portal filters for venue search when city is omitted", async () => {
    const { client, rpcCalls, fromCalls } = createMockClient({ city: "Atlanta" });
    createServiceClientMock.mockReturnValue(client);

    await unifiedSearch({
      query: "jazz",
      types: ["venue"],
      portalId: "11111111-1111-1111-1111-111111111111",
      useIntentAnalysis: false,
    });

    expect(fromCalls).toContain("portals");

    const venueCall = rpcCalls.find((call) => call.fn === "search_venues_ranked");
    expect(venueCall).toBeTruthy();
    expect(venueCall?.args.p_city).toBe("Atlanta");
  });

  it("uses explicit city override and skips portal lookup", async () => {
    const { client, rpcCalls, fromCalls } = createMockClient({ city: "Atlanta" });
    createServiceClientMock.mockReturnValue(client);

    await unifiedSearch({
      query: "jazz",
      types: ["venue"],
      portalId: "11111111-1111-1111-1111-111111111111",
      city: "Decatur",
      useIntentAnalysis: false,
    });

    expect(fromCalls).toHaveLength(0);

    const venueCall = rpcCalls.find((call) => call.fn === "search_venues_ranked");
    expect(venueCall).toBeTruthy();
    expect(venueCall?.args.p_city).toBe("Decatur");
  });

  it("does not query portal filters when venue search is not requested", async () => {
    const { client, rpcCalls, fromCalls } = createMockClient({ city: "Atlanta" });
    createServiceClientMock.mockReturnValue(client);

    await unifiedSearch({
      query: "jazz",
      types: ["organizer"],
      portalId: "11111111-1111-1111-1111-111111111111",
      useIntentAnalysis: false,
    });

    expect(fromCalls).toHaveLength(0);
    expect(rpcCalls.some((call) => call.fn === "search_organizers_ranked")).toBe(false);
    expect(rpcCalls.some((call) => call.fn === "search_organizations_ranked")).toBe(true);
  });
});
