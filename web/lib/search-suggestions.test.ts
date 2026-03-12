import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const getSharedCacheJsonMock = vi.fn();
const setSharedCacheJsonMock = vi.fn();

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/shared-cache", () => ({
  getSharedCacheJson: getSharedCacheJsonMock,
  setSharedCacheJson: setSharedCacheJsonMock,
}));

describe("search suggestions cache", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    getSharedCacheJsonMock.mockReset();
    setSharedCacheJsonMock.mockReset();
    getSharedCacheJsonMock.mockResolvedValue(null);
    setSharedCacheJsonMock.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("reuses cached suggestions for normalized duplicate queries", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          suggestion: "Karaoke Night",
          type: "event",
          frequency: 4,
          similarity_score: 0.8,
        },
      ],
      error: null,
    });

    const { getSearchSuggestions } = await import("@/lib/search-suggestions");

    const first = await getSearchSuggestions("  Karaoke  ", 8, "Atlanta");
    const second = await getSearchSuggestions("karaoke", 8, "atlanta");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(first[0]?.text).toBe("Karaoke Night");
    expect(second[0]?.text).toBe("Karaoke Night");
    expect(setSharedCacheJsonMock).toHaveBeenCalledTimes(1);
  });

  it("coalesces identical in-flight suggestion requests", async () => {
    let resolveRpc:
      | ((value: {
          data: Array<{
            suggestion: string;
            type: string;
            frequency: number;
            similarity_score: number;
          }>;
          error: null;
        }) => void)
      | null = null;

    rpcMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRpc = resolve;
        }),
    );

    const { getSearchSuggestions } = await import("@/lib/search-suggestions");

    const firstPromise = getSearchSuggestions("music", 8, "atlanta");
    const secondPromise = getSearchSuggestions("music", 8, "atlanta");

    await Promise.resolve();
    expect(rpcMock).toHaveBeenCalledTimes(1);

    resolveRpc?.({
      data: [
        {
          suggestion: "Music",
          type: "category",
          frequency: 10,
          similarity_score: 0.9,
        },
      ],
      error: null,
    });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first[0]?.text).toBe("Music");
    expect(second[0]?.text).toBe("Music");
  });

  it("falls back to the strongest query token when a multi-word phrase has no direct suggestions", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            suggestion: "Afrobeat",
            type: "category",
            frequency: 6,
            similarity_score: 0.7,
          },
        ],
        error: null,
      });

    const { getSearchSuggestionsWithFallback } = await import(
      "@/lib/search-suggestions"
    );

    const suggestions = await getSearchSuggestionsWithFallback(
      "afrobeat night",
      8,
      "atlanta",
    );

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[1]?.[1]).toMatchObject({
      p_query: "afrobeat",
      p_limit: 8,
      p_city: "atlanta",
    });
    expect(suggestions[0]?.text).toBe("Afrobeat");
  });
});
