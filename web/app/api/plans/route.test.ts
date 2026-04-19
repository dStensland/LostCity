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
  withAuth: (handler: unknown) => handler,
}));

const PORTAL_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const EVENT_ID = 42;
const PLAN_ID = "550e8400-e29b-41d4-a716-446655440002";

function makeServiceClient(overrides: Record<string, unknown> = {}) {
  const eqFn = vi.fn();
  const singleFn = vi.fn();
  const maybeSingleFn = vi.fn();
  const selectFn = vi.fn();
  const insertFn = vi.fn();
  const inFn = vi.fn();
  const gteFn = vi.fn();
  const orderFn = vi.fn();
  const orFn = vi.fn();
  const deleteFn = vi.fn();

  const chain = {
    select: selectFn,
    eq: eqFn,
    in: inFn,
    gte: gteFn,
    order: orderFn,
    or: orFn,
    single: singleFn,
    maybeSingle: maybeSingleFn,
    insert: insertFn,
    delete: deleteFn,
    then: vi.fn(),
  };

  // Default: chain returns itself
  selectFn.mockReturnValue(chain);
  eqFn.mockReturnValue(chain);
  inFn.mockReturnValue(chain);
  gteFn.mockReturnValue(chain);
  orderFn.mockReturnValue(chain);
  orFn.mockReturnValue(chain);
  deleteFn.mockReturnValue(chain);
  singleFn.mockResolvedValue({ data: null, error: null });
  maybeSingleFn.mockResolvedValue({ data: null, error: null });
  insertFn.mockReturnValue(chain);

  // then: simulate awaitable query (for list queries)
  chain.then.mockImplementation((resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolve({ data: [], error: null }))
  );

  return { from: vi.fn(() => chain), ...overrides };
}

describe("POST /api/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/plans/route");

    const request = new NextRequest("http://localhost:3000/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });

    const response = await POST(request, {
      user: { id: USER_ID },
      serviceClient: makeServiceClient(),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid JSON" });
  });

  it("returns 400 for missing required fields", async () => {
    const { POST } = await import("@/app/api/plans/route");

    const request = new NextRequest("http://localhost:3000/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ anchor_type: "event" }), // missing anchor_id, portal_id, starts_at
    });

    const response = await POST(request, {
      user: { id: USER_ID },
      serviceClient: makeServiceClient(),
    } as never);

    expect(response.status).toBe(400);
  });

  it("returns 404 when anchor not found", async () => {
    const service = makeServiceClient();
    (service.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const { POST } = await import("@/app/api/plans/route");

    const request = new NextRequest("http://localhost:3000/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        anchor_type: "event",
        anchor_id: EVENT_ID,
        portal_id: PORTAL_ID,
        starts_at: "2026-05-01T20:00:00Z",
      }),
    });

    const response = await POST(request, {
      user: { id: USER_ID },
      serviceClient: service,
    } as never);

    expect(response.status).toBe(404);
  });

  it("returns 400 when portal_id mismatches anchor portal", async () => {
    const service = makeServiceClient();
    (service.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { portal_id: "different-portal-id" },
            error: null,
          }),
        }),
      }),
    });

    const { POST } = await import("@/app/api/plans/route");

    const request = new NextRequest("http://localhost:3000/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        anchor_type: "event",
        anchor_id: EVENT_ID,
        portal_id: PORTAL_ID,
        starts_at: "2026-05-01T20:00:00Z",
      }),
    });

    const response = await POST(request, {
      user: { id: USER_ID },
      serviceClient: service,
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "portal_id does not match anchor's portal",
    });
  });

  it("creates plan and returns 201 with id and share_token", async () => {
    let callCount = 0;

    const planInsertChain = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: PLAN_ID, share_token: "abc123abc123abc123abc123" },
          error: null,
        }),
      }),
    };
    const inviteeInsertChain = {
      // returns from plan_invitees.insert
    };

    const service = {
      from: vi.fn((table: string) => {
        if (table === "events") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { portal_id: PORTAL_ID },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "plans") {
          if (callCount === 0) { callCount++; return { insert: vi.fn().mockReturnValue(planInsertChain) }; }
        }
        if (table === "plan_invitees") {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return { from: vi.fn() };
      }),
    };

    const { POST } = await import("@/app/api/plans/route");

    const request = new NextRequest("http://localhost:3000/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        anchor_type: "event",
        anchor_id: EVENT_ID,
        portal_id: PORTAL_ID,
        starts_at: "2026-05-01T20:00:00Z",
      }),
    });

    const response = await POST(request, {
      user: { id: USER_ID },
      serviceClient: service,
    } as never);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.plan.id).toBe(PLAN_ID);
    expect(body.plan.share_token).toBeDefined();
  });

  it("returns null from rate limit guard and blocks on rate limit hit", async () => {
    mocks.applyRateLimit.mockResolvedValue(
      NextResponse.json({ error: "Too many requests" }, { status: 429 })
    );

    const { POST } = await import("@/app/api/plans/route");

    const request = new NextRequest("http://localhost:3000/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request, {
      user: { id: USER_ID },
      serviceClient: makeServiceClient(),
    } as never);

    expect(response.status).toBe(429);
  });
});

describe("GET /api/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
  });

  it("returns plans list for mine scope", async () => {
    const inviteeChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };
    const planChain = {
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: PLAN_ID, status: "planning" }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "plan_invitees") return inviteeChain;
        return planChain;
      }),
    };

    const { GET } = await import("@/app/api/plans/route");

    const request = new NextRequest(
      "http://localhost:3000/api/plans?scope=mine&status=upcoming"
    );

    const response = await GET(request, {
      user: { id: USER_ID },
      serviceClient: makeServiceClient(),
      supabase,
    } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.plans)).toBe(true);
  });

  it("returns 400 for invalid status param", async () => {
    const { GET } = await import("@/app/api/plans/route");

    const request = new NextRequest(
      "http://localhost:3000/api/plans?status=invalid"
    );

    const response = await GET(request, {
      user: { id: USER_ID },
      serviceClient: makeServiceClient(),
      supabase: makeServiceClient(),
    } as never);

    expect(response.status).toBe(400);
  });

  it("reads plans through the RLS-scoped client, never the service client", async () => {
    // Regression guard: if a future refactor reintroduces the service client
    // here, scope=friends and anchor_*_id filters would bypass RLS and leak
    // every plan DB-wide. Assert the list SELECT is issued via `supabase`,
    // not `serviceClient`.
    const serviceClient = makeServiceClient();
    const supabase = makeServiceClient();

    const { GET } = await import("@/app/api/plans/route");

    const request = new NextRequest(
      "http://localhost:3000/api/plans?scope=friends&status=upcoming"
    );

    await GET(request, {
      user: { id: USER_ID },
      serviceClient,
      supabase,
    } as never);

    expect(supabase.from).toHaveBeenCalledWith("plans");
    expect(serviceClient.from).not.toHaveBeenCalled();
  });

  it("omits share_token from the list response", async () => {
    // share_token is the gate to /api/plans/shared/:token. Only the creator
    // should see it (via the detail endpoint). Ensure the list SELECT doesn't
    // include it so token harvesting via the list isn't possible.
    const supabase = makeServiceClient();
    let capturedSelect = "";
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      select: vi.fn((fields: string) => {
        capturedSelect = fields;
        return {
          order: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }),
    }));

    const { GET } = await import("@/app/api/plans/route");

    const request = new NextRequest(
      "http://localhost:3000/api/plans?scope=friends&status=upcoming"
    );

    await GET(request, {
      user: { id: USER_ID },
      serviceClient: makeServiceClient(),
      supabase,
    } as never);

    expect(capturedSelect).not.toContain("share_token");
  });
});
