import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockPathname = "/atlanta";
let mockSearchParams = new URLSearchParams("view=find&utm_source=newsletter");

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

import { usePortalTracking } from "@/lib/hooks/usePortalTracking";

function Probe() {
  usePortalTracking("atlanta");
  return null;
}

describe("usePortalTracking", () => {
  let idleCallback: IdleRequestCallback | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    idleCallback = null;
    mockPathname = "/atlanta";
    mockSearchParams = new URLSearchParams("view=find&utm_source=newsletter");
    vi.stubGlobal("fetch", vi.fn());
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: vi.fn((callback: IdleRequestCallback) => {
        idleCallback = callback;
        return 1;
      }),
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://example.com/from",
    });
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => true),
    });
  });

  it("defers the page-view send until idle", () => {
    render(<Probe />);

    expect(window.navigator.sendBeacon).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(idleCallback).not.toBeNull();

    idleCallback?.({
      didTimeout: false,
      timeRemaining: () => 50,
    } as IdleDeadline);

    expect(window.navigator.sendBeacon).toHaveBeenCalledTimes(1);
    expect(window.navigator.sendBeacon).toHaveBeenCalledWith(
      "/api/portals/atlanta/track",
      expect.any(Blob),
    );
  });
});
