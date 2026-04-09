import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  normalizePortalSlug: vi.fn(),
  resolvePortalSlugAlias: vi.fn(),
  getSharedCacheJson: vi.fn(),
  setSharedCacheJson: vi.fn(),
  loadPortalFeed: vi.fn(),
  createServerTimingRecorder: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    feed: { limit: 60, windowSec: 60 },
  },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock("@/lib/portal-aliases", () => ({
  normalizePortalSlug: mocks.normalizePortalSlug,
  resolvePortalSlugAlias: mocks.resolvePortalSlugAlias,
}));

vi.mock("@/lib/shared-cache", () => ({
  getSharedCacheJson: mocks.getSharedCacheJson,
  setSharedCacheJson: mocks.setSharedCacheJson,
}));

vi.mock("@/lib/portal-feed-loader", () => ({
  loadPortalFeed: mocks.loadPortalFeed,
}));

vi.mock("@/lib/server-timing", () => ({
  createServerTimingRecorder: mocks.createServerTimingRecorder,
}));

describe("GET /api/portals/[slug]/feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
    mocks.normalizePortalSlug.mockImplementation((value: string) => value);
    mocks.resolvePortalSlugAlias.mockImplementation((value: string) => value);
    mocks.getSharedCacheJson.mockResolvedValue(null);
    mocks.setSharedCacheJson.mockResolvedValue(undefined);
    mocks.createServerTimingRecorder.mockReturnValue({
      measure: async (_name: string, fn: () => Promise<unknown>) => fn(),
      addMetric: vi.fn(),
      toHeader: () => "cache_lookup;dur=1",
    });
  });

  it("delegates to the shared portal feed loader and returns sections", async () => {
    mocks.loadPortalFeed.mockResolvedValue({
      payload: {
        portal: { slug: "atlanta", name: "Atlanta" },
        sections: [{ id: "today", title: "Today" }],
      },
      serverTiming: "load;dur=5",
    });

    const { GET } = await import("@/app/api/portals/[slug]/feed/route");
    const request = new NextRequest(
      "http://localhost:3000/api/portals/atlanta/feed?limit=8",
    );

    const response = await GET(request, {
      params: Promise.resolve({ slug: "atlanta" }),
    });
    const body = await response.json();

    expect(mocks.loadPortalFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalSlug: "atlanta",
        requestSlug: "atlanta",
        defaultLimit: 8,
      }),
    );
    expect(mocks.setSharedCacheJson).toHaveBeenCalled();
    expect(body.sections).toHaveLength(1);
    expect(body.sections[0].id).toBe("today");
  });

  it("serves shared-cache hits without invoking the loader", async () => {
    mocks.getSharedCacheJson.mockResolvedValue({
      portal: { slug: "atlanta", name: "Atlanta" },
      sections: [{ id: "weekend", title: "Weekend" }],
    });

    const { GET } = await import("@/app/api/portals/[slug]/feed/route");
    const request = new NextRequest(
      "http://localhost:3000/api/portals/atlanta/feed",
    );

    const response = await GET(request, {
      params: Promise.resolve({ slug: "atlanta" }),
    });
    const body = await response.json();

    expect(mocks.loadPortalFeed).not.toHaveBeenCalled();
    expect(body.sections).toHaveLength(1);
    expect(body.sections[0].id).toBe("weekend");
  });
});
