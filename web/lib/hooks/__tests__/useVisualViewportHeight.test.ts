import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVisualViewportHeight } from "@/lib/hooks/useVisualViewportHeight";

describe("useVisualViewportHeight", () => {
  let addEventSpy: ReturnType<typeof vi.fn>;
  let removeEventSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addEventSpy = vi.fn();
    removeEventSpy = vi.fn();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        offsetTop: 0,
        addEventListener: addEventSpy,
        removeEventListener: removeEventSpy,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: null });
  });

  it("returns 0 when viewport is idle", () => {
    const { result } = renderHook(() => useVisualViewportHeight());
    expect(result.current).toBe(0);
  });

  it("subscribes to resize and scroll events", () => {
    renderHook(() => useVisualViewportHeight());
    expect(addEventSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(addEventSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useVisualViewportHeight());
    unmount();
    expect(removeEventSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeEventSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
