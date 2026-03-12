import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const resolvePortalAttributionForWriteMock = vi.fn();

vi.mock("@/lib/api-middleware", () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock("@/lib/portal-attribution", () => ({
  resolvePortalAttributionForWrite: resolvePortalAttributionForWriteMock,
}));

describe("POST /api/itineraries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the shared attribution error when portal attribution is missing", async () => {
    resolvePortalAttributionForWriteMock.mockResolvedValue({
      portalId: null,
      response: NextResponse.json(
        {
          error: "Portal attribution is required for this request",
          code: "portal_attribution_required",
        },
        { status: 400 },
      ),
    });

    const { POST } = await import("@/app/api/itineraries/route");

    const request = new NextRequest("http://localhost:3000/api/itineraries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Dinner plan" }),
    });

    const response = await POST(request, {
      user: { id: "user-1" },
      serviceClient: { from: vi.fn() },
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "portal_attribution_required",
    });
  });

  it("rejects mismatched body portal ids even when another portal context resolves", async () => {
    resolvePortalAttributionForWriteMock.mockResolvedValue({
      portalId: "portal-resolved",
      response: null,
    });

    const { POST } = await import("@/app/api/itineraries/route");

    const request = new NextRequest("http://localhost:3000/api/itineraries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        portal_id: "11111111-1111-1111-1111-111111111111",
        title: "Dinner plan",
      }),
    });

    const response = await POST(request, {
      user: { id: "user-1" },
      serviceClient: { from: vi.fn() },
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "portal and portal_id parameters must reference the same portal",
    });
  });

  it("creates itineraries with the resolved portal attribution", async () => {
    resolvePortalAttributionForWriteMock.mockResolvedValue({
      portalId: "11111111-1111-1111-1111-111111111111",
      response: null,
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "itin-1",
        portal_id: "11111111-1111-1111-1111-111111111111",
        title: "Dinner plan",
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const fromMock = vi.fn(() => ({ insert: insertMock }));

    const { POST } = await import("@/app/api/itineraries/route");

    const request = new NextRequest("http://localhost:3000/api/itineraries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        portal_id: "11111111-1111-1111-1111-111111111111",
        title: "Dinner plan",
      }),
    });

    const response = await POST(request, {
      user: { id: "user-1" },
      serviceClient: { from: fromMock },
    } as never);

    expect(fromMock).toHaveBeenCalledWith("itineraries");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        portal_id: "11111111-1111-1111-1111-111111111111",
        title: "Dinner plan",
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      itinerary: {
        id: "itin-1",
        portal_id: "11111111-1111-1111-1111-111111111111",
      },
    });
  });
});
