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

describe("PATCH /api/volunteer/engagements/[id]", () => {
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

    const { PATCH } = await import("@/app/api/volunteer/engagements/[id]/route");

    const request = new NextRequest(
      "http://localhost:3000/api/volunteer/engagements/eng-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "committed",
          portal: "helpatl",
        }),
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "eng-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "portal_attribution_required",
    });
  });

  it("rejects explicit portal context that conflicts with the engagement portal", async () => {
    mocks.resolvePortalAttributionForWrite.mockResolvedValue({
      portalId: "portal-helpatl",
      response: null,
    });

    const engagementQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    engagementQuery.select.mockReturnValue(engagementQuery);
    engagementQuery.eq.mockReturnValue(engagementQuery);
    engagementQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "eng-1",
        user_id: "user-1",
        portal_id: "portal-other",
      },
      error: null,
    });

    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => engagementQuery),
    });

    const { PATCH } = await import("@/app/api/volunteer/engagements/[id]/route");

    const request = new NextRequest(
      "http://localhost:3000/api/volunteer/engagements/eng-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "attended",
        }),
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "eng-1" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "portal and portal_id parameters must reference the same portal",
    });
  });

  it("updates the engagement when the portal context matches or is omitted", async () => {
    mocks.resolvePortalAttributionForWrite.mockResolvedValue({
      portalId: null,
      response: null,
    });

    const engagementLookup = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    engagementLookup.select.mockReturnValue(engagementLookup);
    engagementLookup.eq.mockReturnValue(engagementLookup);
    engagementLookup.maybeSingle.mockResolvedValue({
      data: {
        id: "eng-1",
        user_id: "user-1",
        portal_id: "portal-helpatl",
      },
      error: null,
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "eng-1",
        portal_id: "portal-helpatl",
        status: "attended",
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const eqAfterUpdateMock = vi.fn(() => ({ select: selectMock }));
    const updateMock = vi.fn(() => ({ eq: eqAfterUpdateMock }));

    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        ...engagementLookup,
        update: updateMock,
      })),
    });

    const { PATCH } = await import("@/app/api/volunteer/engagements/[id]/route");

    const request = new NextRequest(
      "http://localhost:3000/api/volunteer/engagements/eng-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "attended",
          note: "Completed orientation",
        }),
      },
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "eng-1" }),
    });

    expect(updateMock).toHaveBeenCalledWith({
      status: "attended",
      note: "Completed orientation",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      engagement: {
        id: "eng-1",
        status: "attended",
      },
    });
  });
});
