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
const OTHER_USER = "550e8400-e29b-41d4-a716-446655440003";
const INVITEE_ID = "550e8400-e29b-41d4-a716-446655440004";

describe("DELETE /api/plans/[id]/invitees/[userId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid params", async () => {
    const { DELETE } = await import("@/app/api/plans/[id]/invitees/[userId]/route");

    const request = new NextRequest(
      "http://localhost:3000/api/plans/not-valid/invitees/also-not-valid",
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      user: { id: USER_ID },
      serviceClient: {},
      params: Promise.resolve({ id: "not-valid", userId: "also-not-valid" }),
    } as never);

    expect(response.status).toBe(400);
  });

  it("returns 400 when trying to remove creator", async () => {
    const service = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { creator_id: USER_ID }, // USER_ID is the creator
              error: null,
            }),
          }),
        }),
      })),
    };

    const { DELETE } = await import("@/app/api/plans/[id]/invitees/[userId]/route");

    const request = new NextRequest(
      `http://localhost:3000/api/plans/${PLAN_ID}/invitees/${USER_ID}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      user: { id: USER_ID }, // self-remove check passes
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID, userId: USER_ID }),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("Cannot remove creator"),
    });
  });

  it("returns 403 when non-creator tries to remove another user", async () => {
    const service = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { creator_id: OTHER_USER }, // OTHER_USER is creator, not USER_ID
              error: null,
            }),
          }),
        }),
      })),
    };

    const { DELETE } = await import("@/app/api/plans/[id]/invitees/[userId]/route");

    const request = new NextRequest(
      `http://localhost:3000/api/plans/${PLAN_ID}/invitees/${INVITEE_ID}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      user: { id: USER_ID }, // USER_ID tries to remove INVITEE_ID, but isn't creator
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID, userId: INVITEE_ID }),
    } as never);

    expect(response.status).toBe(403);
  });

  it("removes invitee when creator removes them", async () => {
    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const service = {
      from: vi.fn((table: string) => {
        if (table === "plans") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { creator_id: USER_ID }, // USER_ID is creator
                  error: null,
                }),
              }),
            }),
          };
        }
        return { delete: deleteMock };
      }),
    };

    const { DELETE } = await import("@/app/api/plans/[id]/invitees/[userId]/route");

    const request = new NextRequest(
      `http://localhost:3000/api/plans/${PLAN_ID}/invitees/${INVITEE_ID}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      user: { id: USER_ID },
      serviceClient: service,
      params: Promise.resolve({ id: PLAN_ID, userId: INVITEE_ID }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });
});
