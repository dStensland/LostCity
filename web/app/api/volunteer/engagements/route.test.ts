import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  getUser: vi.fn(),
  createServiceClient: vi.fn(),
  resolvePortalAttributionForWrite: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    write: { limit: 20, windowSec: 60 },
  },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: mocks.getUser,
    },
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/lib/portal-attribution", () => ({
  resolvePortalAttributionForWrite: mocks.resolvePortalAttributionForWrite,
}));

describe("POST /api/volunteer/engagements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
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
    mocks.createServiceClient.mockReturnValue({ from: vi.fn() });

    const { POST } = await import("@/app/api/volunteer/engagements/route");

    const request = new NextRequest(
      "http://localhost:3000/api/volunteer/engagements",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunity_id: "opp-1",
          status: "interested",
          portal: "helpatl",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "portal_attribution_required",
    });
  });

  it("rejects explicit portal context that conflicts with the opportunity portal", async () => {
    mocks.resolvePortalAttributionForWrite.mockResolvedValue({
      portalId: "portal-helpatl",
      response: null,
    });

    const opportunityQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    opportunityQuery.select.mockReturnValue(opportunityQuery);
    opportunityQuery.eq.mockReturnValue(opportunityQuery);
    opportunityQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "opp-1",
        event_id: 42,
        portal_id: "portal-other",
        is_active: true,
      },
      error: null,
    });

    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => opportunityQuery),
    });

    const { POST } = await import("@/app/api/volunteer/engagements/route");

    const request = new NextRequest(
      "http://localhost:3000/api/volunteer/engagements",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunity_id: "opp-1",
          status: "committed",
        }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "portal and portal_id parameters must reference the same portal",
    });
  });

  it("falls back to the opportunity portal when no explicit portal context is present", async () => {
    mocks.resolvePortalAttributionForWrite.mockResolvedValue({
      portalId: null,
      response: null,
    });

    const opportunityQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    opportunityQuery.select.mockReturnValue(opportunityQuery);
    opportunityQuery.eq.mockReturnValue(opportunityQuery);
    opportunityQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "opp-1",
        event_id: 42,
        portal_id: "portal-helpatl",
        is_active: true,
      },
      error: null,
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "eng-1",
        opportunity_id: "opp-1",
        portal_id: "portal-helpatl",
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const upsertMock = vi.fn(() => ({ select: selectMock }));
    const engagementTable = {
      upsert: upsertMock,
    };

    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === "volunteer_opportunities" ? opportunityQuery : engagementTable,
      ),
    });

    const { POST } = await import("@/app/api/volunteer/engagements/route");

    const request = new NextRequest(
      "http://localhost:3000/api/volunteer/engagements",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opportunity_id: "opp-1",
          status: "interested",
          note: "Can help on weekends",
        }),
      },
    );

    const response = await POST(request);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        opportunity_id: "opp-1",
        portal_id: "portal-helpatl",
        status: "interested",
      }),
      expect.objectContaining({
        onConflict: "user_id,opportunity_id",
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      engagement: {
        id: "eng-1",
        portal_id: "portal-helpatl",
      },
    });
  });
});
