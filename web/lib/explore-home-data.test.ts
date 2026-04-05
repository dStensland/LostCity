import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createPortalScopedClient: vi.fn(),
}));

vi.mock("@/lib/portal", () => ({
  getPortalBySlug: vi.fn(),
  getCachedPortalBySlug: vi.fn(),
}));

vi.mock("@/lib/federation", () => ({
  getPortalSourceAccess: vi.fn(),
}));

vi.mock("@/lib/city-pulse/time-slots", () => ({
  getTimeSlot: vi.fn(() => "evening"),
  isWeekend: vi.fn(() => false),
}));

vi.mock("@/lib/formats", () => ({
  getLocalDateString: vi.fn(() => "2025-04-03"),
  getLocalDateStringOffset: vi.fn(() => "2025-04-10"),
}));

vi.mock("@/lib/explore-platform/home", () => ({
  buildExploreHomePayload: vi.fn((_slug: string, payload: unknown) => payload),
}));

vi.mock("@/lib/explore-platform/server/home-fallback", () => ({
  getExploreHomeFallbackCounts: vi.fn(),
}));

vi.mock("@/lib/shared-cache", () => ({
  getSharedCacheJson: vi.fn().mockResolvedValue(null),
  setSharedCacheJson: vi.fn().mockResolvedValue(undefined),
}));

import {
  getCachedExploreHomeSeed,
  getExploreHomeData,
} from "@/lib/explore-home-data";
import { createPortalScopedClient } from "@/lib/supabase/server";
import { getCachedPortalBySlug } from "@/lib/portal";
import { getPortalSourceAccess } from "@/lib/federation";
import { getExploreHomeFallbackCounts } from "@/lib/explore-platform/server/home-fallback";
import { getSharedCacheJson } from "@/lib/shared-cache";

describe("getExploreHomeData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to compact count queries when the RPC is unavailable", async () => {
    vi.mocked(getCachedPortalBySlug).mockResolvedValue({
      id: "portal-1",
      filters: { city: "Atlanta" },
    } as never);
    vi.mocked(getPortalSourceAccess).mockResolvedValue({
      sourceIds: [1, 2, 3],
    } as never);
    vi.mocked(createPortalScopedClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST202", message: "missing rpc" },
      }),
    } as never);
    vi.mocked(getExploreHomeFallbackCounts).mockResolvedValue({
      events: { count: 20, count_today: 6, count_weekend: 8 },
      shows: { count: 10, count_today: 4, count_weekend: 5 },
      "game-day": { count: 3, count_today: 1, count_weekend: 2 },
      regulars: { count: 15, count_today: 2, count_weekend: 7 },
      classes: { count: 12, count_today: 3, count_weekend: 4 },
      places: { count: 50, count_today: null, count_weekend: null },
    });

    const result = await getExploreHomeData("atlanta");

    expect(getExploreHomeFallbackCounts).toHaveBeenCalledWith("atlanta");
    expect(result).toMatchObject({
      lanes: {
        events: { count: 20, count_today: 6 },
        shows: { count: 10, count_today: 4 },
        "game-day": { count: 3, count_today: 1 },
        regulars: { count: 15, count_today: 2 },
        classes: { count: 12, count_today: 3 },
        places: { count: 50, count_today: null },
      },
    });
  });

  it("returns an exact cached home payload without recomputing it", async () => {
    vi.mocked(getSharedCacheJson).mockResolvedValueOnce({
      lanes: {
        events: {
          state: "alive",
          count: 12,
          count_today: 4,
          count_weekend: 6,
          copy: "4 events happening today",
        },
      },
    } as never);

    const result = await getCachedExploreHomeSeed("atlanta");

    expect(result).toMatchObject({
      data: {
        lanes: {
          events: {
            count: 12,
            count_today: 4,
          },
        },
      },
      isStale: false,
    });
    expect(getCachedPortalBySlug).not.toHaveBeenCalled();
    expect(getPortalSourceAccess).not.toHaveBeenCalled();
    expect(createPortalScopedClient).not.toHaveBeenCalled();
  });

  it("falls back to the latest cached payload when the current slot is cold", async () => {
    vi.mocked(getSharedCacheJson)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        lanes: {
          events: {
            state: "alive",
            count: 9,
            count_today: 3,
            count_weekend: 5,
            copy: "3 events happening today",
          },
        },
      } as never);

    const result = await getCachedExploreHomeSeed("atlanta");

    expect(result).toMatchObject({
      data: {
        lanes: {
          events: {
            count: 9,
            count_today: 3,
          },
        },
      },
      isStale: true,
    });
    expect(getCachedPortalBySlug).not.toHaveBeenCalled();
    expect(getPortalSourceAccess).not.toHaveBeenCalled();
    expect(createPortalScopedClient).not.toHaveBeenCalled();
  });
});
