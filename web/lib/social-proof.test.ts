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

describe("fetchSocialProofCounts", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    getSharedCacheJsonMock.mockReset();
    setSharedCacheJsonMock.mockReset();
    getSharedCacheJsonMock.mockResolvedValue(null);
    setSharedCacheJsonMock.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it("caches identical event-id sets regardless of input order", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          event_id: 1,
          going_count: 2,
          interested_count: 3,
          recommendation_count: 1,
        },
      ],
      error: null,
    });

    const { fetchSocialProofCounts } = await import("@/lib/social-proof");

    const first = await fetchSocialProofCounts([2, 1, 1]);
    const second = await fetchSocialProofCounts([1, 2]);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(first.get(1)).toEqual({
      going: 2,
      interested: 3,
      recommendations: 1,
    });
    expect(second.get(2)).toEqual({
      going: 0,
      interested: 0,
      recommendations: 0,
    });
    expect(setSharedCacheJsonMock).toHaveBeenCalledTimes(1);
  });

  it("coalesces identical in-flight requests", async () => {
    let resolveRpc:
      | ((value: {
          data: Array<{
            event_id: number;
            going_count: number;
            interested_count: number;
            recommendation_count: number;
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

    const { fetchSocialProofCounts } = await import("@/lib/social-proof");

    const firstPromise = fetchSocialProofCounts([9, 8]);
    const secondPromise = fetchSocialProofCounts([8, 9]);

    await Promise.resolve();
    expect(rpcMock).toHaveBeenCalledTimes(1);

    resolveRpc?.({
      data: [
        {
          event_id: 8,
          going_count: 1,
          interested_count: 0,
          recommendation_count: 0,
        },
      ],
      error: null,
    });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first.get(8)).toEqual({
      going: 1,
      interested: 0,
      recommendations: 0,
    });
    expect(second.get(9)).toEqual({
      going: 0,
      interested: 0,
      recommendations: 0,
    });
  });

  it("hydrates from shared cache before calling the RPC", async () => {
    getSharedCacheJsonMock.mockResolvedValue([
      [
        5,
        {
          going: 4,
          interested: 1,
          recommendations: 2,
        },
      ],
    ]);

    const { fetchSocialProofCounts } = await import("@/lib/social-proof");
    const counts = await fetchSocialProofCounts([5]);

    expect(rpcMock).not.toHaveBeenCalled();
    expect(counts.get(5)).toEqual({
      going: 4,
      interested: 1,
      recommendations: 2,
    });
  });

  it("reuses per-event cache across overlapping event sets", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: [
          {
            event_id: 1,
            going_count: 2,
            interested_count: 0,
            recommendation_count: 0,
          },
          {
            event_id: 2,
            going_count: 3,
            interested_count: 1,
            recommendation_count: 0,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            event_id: 3,
            going_count: 4,
            interested_count: 2,
            recommendation_count: 1,
          },
        ],
        error: null,
      });

    const { fetchSocialProofCounts } = await import("@/lib/social-proof");

    const first = await fetchSocialProofCounts([1, 2]);
    const second = await fetchSocialProofCounts([2, 3]);

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock.mock.calls[0]?.[1]).toEqual({ event_ids: [1, 2] });
    expect(rpcMock.mock.calls[1]?.[1]).toEqual({ event_ids: [3] });
    expect(first.get(2)).toEqual({
      going: 3,
      interested: 1,
      recommendations: 0,
    });
    expect(second.get(2)).toEqual({
      going: 3,
      interested: 1,
      recommendations: 0,
    });
    expect(second.get(3)).toEqual({
      going: 4,
      interested: 2,
      recommendations: 1,
    });
  });
});
