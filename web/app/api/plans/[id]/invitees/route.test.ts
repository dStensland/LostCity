import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { write: { limit: 20, windowSec: 60 } },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock("@/lib/api-middleware", () => ({
  withAuthAndParams: (_schemas: unknown, handler: unknown) => {
    const h = handler as (req: unknown, ctx: unknown) => unknown;
    return async (request: unknown, ctx: { params: Promise<unknown>; user?: unknown; serviceClient?: unknown }) => {
      const params = await ctx.params;
      const req = request as Request;
      let body: unknown = {};
      try { body = await req.clone().json(); } catch { /* empty */ }
      return h(request, { user: ctx.user, serviceClient: ctx.serviceClient, params, validated: { body } } as never);
    };
  },
}));

const PLAN_ID = "550e8400-e29b-41d4-a716-446655440002";
const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const OTHER_USER = "550e8400-e29b-41d4-a716-446655440003";
const INVITEE_ID = "550e8400-e29b-41d4-a716-446655440004";

describe("POST /api/plans/[id]/invitees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
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

    const { POST } = await import("@/app/api/plans/[id]/invitees/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/${PLAN_ID}/invitees`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_ids: [INVITEE_ID] }),
    });

    const response = await POST(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(404);
  });

  it("returns 403 when non-creator tries to invite", async () => {
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

    const { POST } = await import("@/app/api/plans/[id]/invitees/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/${PLAN_ID}/invitees`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_ids: [INVITEE_ID] }),
    });

    const response = await POST(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(403);
  });

  it("inserts invitees and returns inserted count", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });

    const service = {
      from: vi.fn((table: string) => {
        if (table === "plans") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { creator_id: USER_ID },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { insert: insertMock };
      }),
    };

    const { POST } = await import("@/app/api/plans/[id]/invitees/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/${PLAN_ID}/invitees`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_ids: [INVITEE_ID] }),
    });

    const response = await POST(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, inserted: 1 });
  });

  it("returns ok with 0 inserted when only self is provided", async () => {
    const service = {
      from: vi.fn((table: string) => {
        if (table === "plans") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { creator_id: USER_ID },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { insert: vi.fn() };
      }),
    };

    const { POST } = await import("@/app/api/plans/[id]/invitees/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/${PLAN_ID}/invitees`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_ids: [USER_ID] }), // self only — filtered out
    });

    const response = await POST(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, inserted: 0 });
  });
});
