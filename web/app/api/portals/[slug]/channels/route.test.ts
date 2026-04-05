import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/launch-flags", () => ({
  ENABLE_INTEREST_CHANNELS_V1: false,
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
  RATE_LIMITS: {
    read: {},
  },
  getClientIdentifier: vi.fn(() => "test-client"),
}));

describe("GET /api/portals/[slug]/channels", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a disabled payload instead of a 404 when interest channels are off", async () => {
    const { GET } = await import("@/app/api/portals/[slug]/channels/route");

    const response = await GET(
      new Request("https://lostcity.ai/api/portals/helpatl/channels") as never,
      { params: Promise.resolve({ slug: "helpatl" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
    await expect(response.json()).resolves.toMatchObject({
      disabled: true,
      channels: [],
      portal: null,
    });
  });
});
