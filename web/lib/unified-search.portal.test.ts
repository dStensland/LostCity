import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock, fetchSocialProofCountsMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
  fetchSocialProofCountsMock: vi.fn(),
}));

vi.mock("./supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

vi.mock("@/lib/social-proof", () => ({
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

  it("skips event popularity fanout when explicitly disabled", async () => {
    const { client } = createMockClient({ city: "Atlanta" });
    createServiceClientMock.mockReturnValue(client);

    await unifiedSearch({
      query: "jazz",
      types: ["event"],
      useIntentAnalysis: false,
      includeEventPopularitySignals: false,
    });

    expect(fetchSocialProofCountsMock).not.toHaveBeenCalled();
  });

  it("reuses event social proof counts when full social proof is also requested", async () => {
    const { client } = createMockClient({ city: "Atlanta" });
    createServiceClientMock.mockReturnValue(client);
    fetchSocialProofCountsMock.mockResolvedValue(
      new Map([
        [1, { going: 2, interested: 1, recommendations: 3 }],
      ]),
    );

    const rpc = client.rpc as ReturnType<typeof vi.fn>;
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "search_events_ranked") {
        return {
          data: [
            {
              id: 1,
              title: "Jazz Night",
              description: null,
              start_date: "2026-03-10",
              start_time: "20:00:00",
              end_date: null,
              end_time: null,
              category: "music",
              subcategory: null,
              tags: [],
              is_free: false,
              price_min: null,
              price_max: null,
              image_url: null,
              source_url: "",
              ticket_url: null,
              venue_id: 99,
              venue_name: "The Earl",
              venue_neighborhood: "East Atlanta",
              venue_address: null,
              venue_lat: null,
              venue_lng: null,
              ts_rank: 0.7,
              similarity_score: 0.7,
              combined_score: 0.7,
            },
          ],
          error: null,
        };
      }

      return { data: [], error: null };
    });

    await unifiedSearch({
      query: "jazz",
      types: ["event"],
      useIntentAnalysis: false,
      includeEventPopularitySignals: true,
      includeSocialProof: true,
    });

    expect(fetchSocialProofCountsMock).toHaveBeenCalledTimes(1);
    expect(fetchSocialProofCountsMock).toHaveBeenCalledWith([1]);
  });

  it("does not request spelling suggestions when search already has results", async () => {
    const { client, rpcCalls } = createMockClient({ city: "Atlanta" });
    createServiceClientMock.mockReturnValue(client);

    const rpc = client.rpc as ReturnType<typeof vi.fn>;
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "search_events_ranked") {
        return {
          data: [
            {
              id: 1,
              title: "Jazz Night",
              description: null,
              start_date: "2026-03-10",
              start_time: "20:00:00",
              end_date: null,
              end_time: null,
              category: "music",
              subcategory: null,
              tags: [],
              is_free: false,
              price_min: null,
              price_max: null,
              image_url: null,
              source_url: "",
              ticket_url: null,
              venue_id: 99,
              venue_name: "The Earl",
              venue_neighborhood: "East Atlanta",
              venue_address: null,
              venue_lat: null,
              venue_lng: null,
              ts_rank: 0.7,
              similarity_score: 0.7,
              combined_score: 0.7,
            },
          ],
          error: null,
        };
      }

      return { data: [], error: null };
    });

    await unifiedSearch({
      query: "jazz",
      types: ["event"],
      useIntentAnalysis: false,
      includeDidYouMean: true,
    });

    expect(
      rpcCalls.some((call) => call.fn === "get_spelling_suggestions"),
    ).toBe(false);
  });
});
