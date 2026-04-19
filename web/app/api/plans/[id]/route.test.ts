import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    write: { limit: 20, windowSec: 60 },
    read: { limit: 120, windowSec: 60 },
  },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock("@/lib/api-middleware", () => ({
  withAuthAndParams: (schemasOrHandler: unknown, maybeHandler?: unknown) => {
    // If called with (handler), return (req, ctx) => handler(req, { ...ctx, params: await ctx.params })
    // If called with (schemas, handler), return same but pass validated from body/query
    if (typeof schemasOrHandler === "function") {
      const handler = schemasOrHandler as (req: unknown, ctx: unknown) => unknown;
      return async (request: unknown, ctx: { params: Promise<unknown>; user?: unknown; serviceClient?: unknown }) => {
        const params = await ctx.params;
        return handler(request, { user: ctx.user, serviceClient: ctx.serviceClient, params } as never);
      };
    }
    const handler = maybeHandler as (req: unknown, ctx: unknown) => unknown;
    return async (request: unknown, ctx: { params: Promise<unknown>; user?: unknown; serviceClient?: unknown }) => {
      const params = await ctx.params;
      // Parse body for validated
      const req = request as Request;
      let body: unknown = {};
      try { body = await req.clone().json(); } catch { /* empty */ }
      return handler(request, { user: ctx.user, serviceClient: ctx.serviceClient, params, validated: { body } } as never);
    };
  },
}));

const PLAN_ID = "550e8400-e29b-41d4-a716-446655440002";
const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const OTHER_USER = "550e8400-e29b-41d4-a716-446655440003";

function makeCtx(userId: string, planId = PLAN_ID) {
  return {
    user: { id: userId },
    serviceClient: {},
    params: Promise.resolve({ id: planId }),
  };
}

describe("GET /api/plans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
  });

  it("returns 400 for invalid uuid param", async () => {
    const { GET } = await import("@/app/api/plans/[id]/route");

    const request = new NextRequest("http://localhost:3000/api/plans/not-a-uuid");

    const response = await GET(request, {
      ...makeCtx(USER_ID, "not-a-uuid"),
      serviceClient: {},
    } as never);

    expect(response.status).toBe(400);
  });

  it("returns 404 when plan not found", async () => {
    const service = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })),
    };

    const { GET } = await import("@/app/api/plans/[id]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/${PLAN_ID}`);

    const response = await GET(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(404);
  });

  it("returns plan with anchor and invitees on happy path", async () => {
    const plan = {
      id: PLAN_ID,
      anchor_type: "event",
      anchor_event_id: 42,
      anchor_place_id: null,
      anchor_series_id: null,
      status: "planning",
    };

    const service = {
      from: vi.fn((table: string) => {
        if (table === "plans") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: plan, error: null }),
              }),
            }),
          };
        }
        if (table === "events") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 42, title: "Concert", start_date: null, image_url: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "plan_invitees") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
      }),
    };

    const { GET } = await import("@/app/api/plans/[id]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/${PLAN_ID}`);

    const response = await GET(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.plan.id).toBe(PLAN_ID);
    expect(body.anchor).toBeDefined();
    expect(Array.isArray(body.invitees)).toBe(true);
  });
});

describe("PATCH /api/plans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
  });

  it("returns 403 when non-creator tries to update", async () => {
    const service = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { creator_id: OTHER_USER, status: "planning" },
              error: null,
            }),
          }),
        }),
      })),
    };

    const { PATCH } = await import("@/app/api/plans/[id]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/${PLAN_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "New title" }),
    });

    const response = await PATCH(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid status transition", async () => {
    const service = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { creator_id: USER_ID, status: "planning" },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })),
    };

    const { PATCH } = await import("@/app/api/plans/[id]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/${PLAN_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ended" }), // invalid: planning -> ended not allowed
    });

    const response = await PATCH(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("Invalid transition"),
    });
  });

  it("updates title and returns ok for creator", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const service = {
      from: vi.fn((table: string) => {
        if (table === "plans") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { creator_id: USER_ID, status: "planning" },
                  error: null,
                }),
              }),
            }),
            update: updateMock,
          };
        }
        return {};
      }),
    };

    const { PATCH } = await import("@/app/api/plans/[id]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/${PLAN_ID}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated title" }),
    });

    const response = await PATCH(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });
});

describe("DELETE /api/plans/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
  });

  it("returns 403 when non-creator tries to delete", async () => {
    const service = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { creator_id: OTHER_USER },
              error: null,
            }),
          }),
        }),
      })),
    };

    const { DELETE } = await import("@/app/api/plans/[id]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/${PLAN_ID}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(403);
  });

  it("soft-cancels plan for creator", async () => {
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });

    const service = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { creator_id: USER_ID },
              error: null,
            }),
          }),
        }),
        update: updateMock,
      })),
    };

    const { DELETE } = await import("@/app/api/plans/[id]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/${PLAN_ID}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
  });
});
