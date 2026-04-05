import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShowListings } from "@/lib/hooks/useShowListings";

describe("useShowListings", () => {
  const idleCallbacks: IdleRequestCallback[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    idleCallbacks.length = 0;
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: vi.fn((callback: IdleRequestCallback) => {
        idleCallbacks.push(callback);
        return idleCallbacks.length;
      }),
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("renders from seeded payload without an initial fetch", () => {
    const { result } = renderHook(() =>
      useShowListings({
        apiPath: "/api/whats-on/music",
        portalSlug: "atlanta",
        initialPayload: {
          date: "2025-04-03",
          meta: {
            available_dates: ["2025-04-03", "2025-04-04"],
          },
          shows: [{ event_id: 1, title: "Seeded Music Show" }],
          requestKey: "music|2025-04-03",
        },
      }),
    );

    expect(result.current.shows).toEqual([
      { event_id: 1, title: "Seeded Music Show" },
    ]);
    expect(result.current.loading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(idleCallbacks).toHaveLength(1);
  });

  it("defers adjacent-date prefetch until idle", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        date: "2025-04-04",
        shows: [{ event_id: 2, title: "Prefetched Music Show" }],
      }),
    } as Response);

    renderHook(() =>
      useShowListings({
        apiPath: "/api/whats-on/music",
        portalSlug: "atlanta",
        initialPayload: {
          date: "2025-04-03",
          meta: {
            available_dates: ["2025-04-03", "2025-04-04"],
          },
          shows: [{ event_id: 1, title: "Seeded Music Show" }],
          requestKey: "music|2025-04-03",
        },
      }),
    );

    expect(global.fetch).not.toHaveBeenCalled();

    act(() => {
      idleCallbacks[0]?.({
        didTimeout: false,
        timeRemaining: () => 50,
      } as IdleDeadline);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
