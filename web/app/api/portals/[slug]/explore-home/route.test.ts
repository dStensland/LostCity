import { beforeEach, describe, expect, it, vi } from "vitest";

const { afterMock } = vi.hoisted(() => ({
  afterMock: vi.fn((callback: () => void | Promise<void>) => {
    void callback();
  }),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: afterMock,
  };
});

vi.mock("@/lib/explore-home-data", () => ({
  getCachedExploreHomeSeed: vi.fn(),
  getExploreHomeData: vi.fn(),
}));

vi.mock("@/lib/shared-cache", () => ({
  getSharedCacheJson: vi.fn(),
  setSharedCacheJson: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
  RATE_LIMITS: {
    read: {},
  },
  getClientIdentifier: vi.fn(() => "test-client"),
}));

import { GET } from "./route";
import { getCachedExploreHomeSeed, getExploreHomeData } from "@/lib/explore-home-data";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";

describe("GET /api/portals/[slug]/explore-home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves a cached seed immediately and refreshes in after()", async () => {
    vi.mocked(getSharedCacheJson).mockResolvedValue(null);
    vi.mocked(getCachedExploreHomeSeed).mockResolvedValue({
      data: {
        lanes: {
          events: {
            state: "alive",
            count: 7,
            count_today: 2,
            count_weekend: 4,
            copy: "2 events happening today",
          },
          shows: { state: "quiet", count: 0, count_today: 0, count_weekend: 0, copy: "" },
          "game-day": { state: "quiet", count: 0, count_today: 0, count_weekend: 0, copy: "" },
          regulars: { state: "quiet", count: 0, count_today: 0, count_weekend: 0, copy: "" },
          classes: { state: "zero", count: 0, count_today: 0, count_weekend: 0, copy: "" },
          places: { state: "alive", count: 10, count_today: null, count_weekend: null, copy: "10 places to explore" },
        },
      },
      isStale: true,
    } as never);
    vi.mocked(getExploreHomeData).mockResolvedValue({
      lanes: {
        events: {
          state: "alive",
          count: 9,
          count_today: 3,
          count_weekend: 5,
          copy: "3 events happening today",
        },
        shows: { state: "quiet", count: 0, count_today: 0, count_weekend: 0, copy: "" },
        "game-day": { state: "quiet", count: 0, count_today: 0, count_weekend: 0, copy: "" },
        regulars: { state: "quiet", count: 0, count_today: 0, count_weekend: 0, copy: "" },
        classes: { state: "zero", count: 0, count_today: 0, count_weekend: 0, copy: "" },
        places: { state: "alive", count: 10, count_today: null, count_weekend: null, copy: "10 places to explore" },
      },
    } as never);

    const response = await GET(new Request("https://lostcity.ai/api/portals/atlanta/explore-home"), {
      params: Promise.resolve({ slug: "atlanta" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-LostCity-Explore-Home-Seed")).toBe("stale");
    expect(await response.json()).toMatchObject({
      lanes: {
        events: {
          count: 7,
          count_today: 2,
        },
      },
    });
    expect(afterMock).toHaveBeenCalled();
    expect(getExploreHomeData).toHaveBeenCalledWith("atlanta");
    expect(setSharedCacheJson).toHaveBeenCalled();
  });
});
