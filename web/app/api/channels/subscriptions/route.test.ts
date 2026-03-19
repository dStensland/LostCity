import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  resolvePortalAttributionForWrite: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    write: { limit: 20, windowSec: 60 },
  },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock("@/lib/api-middleware", () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock("@/lib/launch-flags", () => ({
  ENABLE_INTEREST_CHANNELS_V1: true,
}));

vi.mock("@/lib/portal-attribution", () => ({
  resolvePortalAttributionForWrite: mocks.resolvePortalAttributionForWrite,
}));

describe("POST /api/channels/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
  });

  it("returns the shared attribution error when hinted portal context cannot be resolved", async () => {
    mocks.resolvePortalAttributionForWrite.mockResolvedValue({
      portalId: null,
      response: NextResponse.json(
        {
          error: "Portal attribution is required for this request",
          code: "portal_attribution_required",
        },
        { status: 400 },
      ),
    });

    const { POST } = await import("@/app/api/channels/subscriptions/route");

    const request = new NextRequest(
      "http://localhost:3000/api/channels/subscriptions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel_id: "11111111-1111-1111-1111-111111111111",
          delivery_mode: "feed_only",
          portal: "helpatl",
        }),
      },
    );

    const response = await POST(request, {
      user: { id: "user-1" },
      serviceClient: { from: vi.fn() },
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "portal_attribution_required",
    });
  });

  it("falls back to the channel portal when no explicit portal context is present", async () => {
    mocks.resolvePortalAttributionForWrite.mockResolvedValue({
      portalId: null,
      response: null,
    });

    const channelQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    channelQuery.select.mockReturnValue(channelQuery);
    channelQuery.eq.mockReturnValue(channelQuery);
    channelQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        portal_id: "portal-helpatl",
        is_active: true,
      },
      error: null,
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "sub-1",
        channel_id: "11111111-1111-1111-1111-111111111111",
        portal_id: "portal-helpatl",
        delivery_mode: "feed_only",
        digest_frequency: null,
      },
      error: null,
    });
    const selectAfterUpsert = vi.fn(() => ({ single: singleMock }));
    const upsertMock = vi.fn(() => ({ select: selectAfterUpsert }));

    const fromMock = vi.fn((table: string) => {
      if (table === "interest_channels") return channelQuery;
      return { upsert: upsertMock };
    });

    const { POST } = await import("@/app/api/channels/subscriptions/route");

    const request = new NextRequest(
      "http://localhost:3000/api/channels/subscriptions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel_id: "11111111-1111-1111-1111-111111111111",
          delivery_mode: "feed_only",
        }),
      },
    );

    const response = await POST(request, {
      user: { id: "user-1" },
      serviceClient: { from: fromMock },
    } as never);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        channel_id: "11111111-1111-1111-1111-111111111111",
        portal_id: "portal-helpatl",
        delivery_mode: "feed_only",
      }),
      expect.objectContaining({ onConflict: "user_id,channel_id" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      subscription: {
        id: "sub-1",
        portal_id: "portal-helpatl",
      },
    });
  });
});
