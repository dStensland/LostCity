import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-middleware", () => ({
  withAuthAndParams: (handler: unknown) => {
    const h = handler as (req: unknown, ctx: unknown) => unknown;
    return async (request: unknown, ctx: { params: Promise<unknown>; user?: unknown; serviceClient?: unknown }) => {
      const params = await ctx.params;
      return h(request, { user: ctx.user, serviceClient: ctx.serviceClient, params } as never);
    };
  },
}));

const PLAN_ID = "550e8400-e29b-41d4-a716-446655440002";
const USER_ID = "550e8400-e29b-41d4-a716-446655440001";

describe("PATCH /api/plans/[id]/invitees/me/seen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks seen_at for user and returns ok", async () => {
    const isMock = vi.fn().mockResolvedValue({ error: null });
    const eqUserMock = vi.fn().mockReturnValue({ is: isMock });
    const eqPlanMock = vi.fn().mockReturnValue({ eq: eqUserMock });
    const updateMock = vi.fn().mockReturnValue({ eq: eqPlanMock });

    const service = {
      from: vi.fn(() => ({ update: updateMock })),
    };

    const { PATCH } = await import("@/app/api/plans/[id]/invitees/me/seen/route");

    const request = new NextRequest(
      `http://localhost:3000/api/plans/${PLAN_ID}/invitees/me/seen`,
      { method: "PATCH" }
    );

    const response = await PATCH(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ seen_at: expect.any(String) })
    );
  });

  it("returns 400 for invalid plan id", async () => {
    const { PATCH } = await import("@/app/api/plans/[id]/invitees/me/seen/route");

    const request = new NextRequest(
      "http://localhost:3000/api/plans/not-valid/invitees/me/seen",
      { method: "PATCH" }
    );

    const response = await PATCH(request, {
      user: { id: USER_ID },
      serviceClient: {},
      params: Promise.resolve({ id: "not-valid" }),
    } as never);

    expect(response.status).toBe(400);
  });

  it("returns 500 when db update fails", async () => {
    const service = {
      from: vi.fn(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
            }),
          }),
        }),
      })),
    };

    const { PATCH } = await import("@/app/api/plans/[id]/invitees/me/seen/route");

    const request = new NextRequest(
      `http://localhost:3000/api/plans/${PLAN_ID}/invitees/me/seen`,
      { method: "PATCH" }
    );

    const response = await PATCH(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID }),
    } as never);

    expect(response.status).toBe(500);
  });
});
