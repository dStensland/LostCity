import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaceDiscovery } from "@/lib/hooks/usePlaceDiscovery";

vi.mock("@/lib/hooks/useReplaceStateParams", () => ({
  useReplaceStateParams: () => new URLSearchParams("view=find&lane=places"),
}));

vi.mock("@/lib/analytics/find-tracking", () => ({
  createFindFilterSnapshot: () => ({
    signature: "places-seeded",
    activeCount: 0,
  }),
  trackFindZeroResults: vi.fn(),
}));

describe("usePlaceDiscovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
  });

  it("hydrates seeded place payloads without an initial fetch", () => {
    const { result } = renderHook(() =>
      usePlaceDiscovery({
        portalId: "portal-1",
        portalSlug: "atlanta",
        initialPayload: {
          spots: [
            {
              id: 1,
              name: "Seeded Spot",
              slug: "seeded-spot",
              neighborhood: "Old Fourth Ward",
              place_type: "restaurant",
              image_url: null,
              event_count: 3,
              price_level: 2,
              short_description: "Good patio.",
              is_open: true,
              closes_at: "23:00",
            },
          ],
          meta: {
            openCount: 1,
            neighborhoods: ["Old Fourth Ward"],
          },
          requestKey: "seeded-places",
        },
      }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.fetchError).toBeNull();
    expect(result.current.spots).toHaveLength(1);
    expect(result.current.spots[0]).toMatchObject({
      name: "Seeded Spot",
      city: "",
      state: "GA",
      short_description: "Good patio.",
      is_open: true,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
