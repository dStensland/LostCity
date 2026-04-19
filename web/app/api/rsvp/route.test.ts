import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be set up before any imports from the route
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  ensureUserProfile: vi.fn(),
  warnSpy: vi.fn(),
  after: vi.fn(),
  checkBodySize: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: mocks.after };
});

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    write: { limit: 30, windowSec: 60 },
    read: { limit: 200, windowSec: 60 },
  },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock("@/lib/api-middleware", () => ({
  // Strip wrapper so handler receives (request, ctx) directly
  withAuth: (schemas: unknown, handler?: unknown) => {
    // withAuth can be called as withAuth(handler) or withAuth(schemas, handler)
    if (typeof schemas === "function") return schemas;
    return handler;
  },
}));

vi.mock("@/lib/user-utils", () => ({
  ensureUserProfile: mocks.ensureUserProfile,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mocks.warnSpy,
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...actual,
    checkBodySize: mocks.checkBodySize,
  };
});

vi.mock("@/lib/push-notifications", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("web-push", () => ({
  default: { sendNotification: vi.fn() },
  sendNotification: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const PORTAL_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const EVENT_ID = 42;
const PLAN_ID = "550e8400-e29b-41d4-a716-446655440002";

// ---------------------------------------------------------------------------
// Service client factory
// ---------------------------------------------------------------------------
function makeFlexibleClient(tableHandlers: Record<string, unknown> = {}) {
  return {
    from: vi.fn((table: string) => {
      if (tableHandlers[table]) return tableHandlers[table];
      // Default chain — all methods return the chain, terminal returns empty success
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      const methods = ["select", "eq", "in", "gte", "order", "or", "limit", "update", "delete", "insert"];
      for (const m of methods) {
        chain[m] = vi.fn(() => chain);
      }
      chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      // make the chain itself awaitable (for count queries)
      (chain as unknown as Promise<unknown>)[Symbol.iterator as never] = vi.fn();
      return chain;
    }),
  };
}

function makeRequest(method: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ---------------------------------------------------------------------------
// POST /api/rsvp
// ---------------------------------------------------------------------------
describe("POST /api/rsvp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
    mocks.ensureUserProfile.mockResolvedValue(undefined);
    mocks.checkBodySize.mockReturnValue(null); // no size error
    mocks.after.mockImplementation((fn: () => void) => fn()); // run immediately in tests
  });

  it("returns 400 deprecated for status='interested'", async () => {
    const { POST } = await import("@/app/api/rsvp/route");
    const req = makeRequest("POST", "http://localhost/api/rsvp", {
      event_id: EVENT_ID,
      status: "interested",
    });
    // validated.body is injected by withAuth mock (which passes args through)
    const resp = await (POST as Function)(req, {
      user: { id: USER_ID },
      serviceClient: makeFlexibleClient(),
      validated: { body: { event_id: EVENT_ID, status: "interested", visibility: "friends" } },
    });
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/Deprecated.*interested/);
  });

  it("returns 400 deprecated for status='went'", async () => {
    const { POST } = await import("@/app/api/rsvp/route");
    const req = makeRequest("POST", "http://localhost/api/rsvp", {
      event_id: EVENT_ID,
      status: "went",
    });
    const resp = await (POST as Function)(req, {
      user: { id: USER_ID },
      serviceClient: makeFlexibleClient(),
      validated: { body: { event_id: EVENT_ID, status: "went", visibility: "friends" } },
    });
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/Deprecated.*went/);
  });

  it("POST 'going' creates a plan + invitee row", async () => {
    const inviteeInsert = vi.fn().mockResolvedValue({ error: null });
    const planInsertChain = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: PLAN_ID },
          error: null,
        }),
      }),
    };

    const service = makeFlexibleClient({
      events: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { portal_id: PORTAL_ID, start_date: "2026-05-01T20:00:00Z" },
              error: null,
            }),
          }),
        }),
      },
      plans: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue(planInsertChain),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      },
      plan_invitees: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
        insert: inviteeInsert,
      },
    });

    const { POST } = await import("@/app/api/rsvp/route");
    const req = makeRequest("POST", "http://localhost/api/rsvp");
    const resp = await (POST as Function)(req, {
      user: { id: USER_ID },
      serviceClient: service,
      validated: { body: { event_id: EVENT_ID, status: "going", visibility: "friends" } },
    });

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(body.rsvp.plan_id).toBe(PLAN_ID);
    expect(body.rsvp.status).toBe("going");

    // Invitee insert should have been called
    expect(inviteeInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: PLAN_ID,
        user_id: USER_ID,
        rsvp_status: "going",
      })
    );
  });

  it("POST 'going' is idempotent when user already has a planning plan", async () => {
    const service = makeFlexibleClient({
      events: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { portal_id: PORTAL_ID, start_date: "2026-05-01T20:00:00Z" },
              error: null,
            }),
          }),
        }),
      },
      plans: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  // Existing plan found — should return success without new insert
                  data: { id: PLAN_ID },
                  error: null,
                }),
              }),
            }),
          }),
        }),
        insert: vi.fn(), // should NOT be called
      },
    });

    const { POST } = await import("@/app/api/rsvp/route");
    const req = makeRequest("POST", "http://localhost/api/rsvp");
    const resp = await (POST as Function)(req, {
      user: { id: USER_ID },
      serviceClient: service,
      validated: { body: { event_id: EVENT_ID, status: "going", visibility: "friends" } },
    });

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    // plan insert should NOT have been called
    expect(service.from("plans").insert).not.toHaveBeenCalled();
  });

  it("emits deprecation warn on POST", async () => {
    const service = makeFlexibleClient({
      events: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      },
    });

    const { POST } = await import("@/app/api/rsvp/route");
    const req = makeRequest("POST", "http://localhost/api/rsvp");
    await (POST as Function)(req, {
      user: { id: USER_ID },
      serviceClient: service,
      validated: { body: { event_id: EVENT_ID, status: "going", visibility: "friends" } },
    });

    expect(mocks.warnSpy).toHaveBeenCalledWith(
      "deprecated route: /api/rsvp",
      expect.objectContaining({ route: "/api/rsvp", method: "POST" })
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/rsvp
// ---------------------------------------------------------------------------
describe("GET /api/rsvp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
  });

  it("reads from event_rsvps view for a specific event", async () => {
    const rsvpRow = { user_id: USER_ID, event_id: EVENT_ID, status: "going", portal_id: PORTAL_ID, created_at: "2026-05-01T00:00:00Z" };

    const service = makeFlexibleClient({
      event_rsvps: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: rsvpRow, error: null }),
            }),
          }),
        }),
      },
    });

    const { GET } = await import("@/app/api/rsvp/route");
    const req = makeRequest("GET", `http://localhost/api/rsvp?event_id=${EVENT_ID}`);
    const resp = await (GET as Function)(req, {
      user: { id: USER_ID },
      serviceClient: service,
    });

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.rsvp).toMatchObject({ event_id: EVENT_ID, status: "going" });
  });

  it("supports ?check=ever_rsvped", async () => {
    const service = makeFlexibleClient({
      event_rsvps: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 3, data: null, error: null }),
        }),
      },
    });

    const { GET } = await import("@/app/api/rsvp/route");
    const req = makeRequest("GET", "http://localhost/api/rsvp?check=ever_rsvped");
    const resp = await (GET as Function)(req, {
      user: { id: USER_ID },
      serviceClient: service,
    });

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.hasRsvped).toBe(true);
  });

  it("returns 400 for missing event_id", async () => {
    const { GET } = await import("@/app/api/rsvp/route");
    const req = makeRequest("GET", "http://localhost/api/rsvp");
    const resp = await (GET as Function)(req, {
      user: { id: USER_ID },
      serviceClient: makeFlexibleClient(),
    });
    expect(resp.status).toBe(400);
  });

  it("emits deprecation warn on GET", async () => {
    const service = makeFlexibleClient({
      event_rsvps: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      },
    });

    const { GET } = await import("@/app/api/rsvp/route");
    const req = makeRequest("GET", `http://localhost/api/rsvp?event_id=${EVENT_ID}`);
    await (GET as Function)(req, {
      user: { id: USER_ID },
      serviceClient: service,
    });

    expect(mocks.warnSpy).toHaveBeenCalledWith(
      "deprecated route: /api/rsvp",
      expect.objectContaining({ route: "/api/rsvp", method: "GET" })
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/rsvp
// ---------------------------------------------------------------------------
describe("DELETE /api/rsvp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
  });

  it("soft-cancels an active plan", async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    const service = makeFlexibleClient({
      plans: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: PLAN_ID }, error: null }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue(updateChain),
      },
    });

    const { DELETE } = await import("@/app/api/rsvp/route");
    const req = makeRequest("DELETE", `http://localhost/api/rsvp?event_id=${EVENT_ID}`);
    const resp = await (DELETE as Function)(req, {
      user: { id: USER_ID },
      serviceClient: service,
    });

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);

    // update should have been called with status=cancelled
    expect(service.from("plans").update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" })
    );
  });

  it("is idempotent — no matching plan returns success", async () => {
    const service = makeFlexibleClient({
      plans: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        update: vi.fn(), // should NOT be called
      },
    });

    const { DELETE } = await import("@/app/api/rsvp/route");
    const req = makeRequest("DELETE", `http://localhost/api/rsvp?event_id=${EVENT_ID}`);
    const resp = await (DELETE as Function)(req, {
      user: { id: USER_ID },
      serviceClient: service,
    });

    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(service.from("plans").update).not.toHaveBeenCalled();
  });

  it("returns 400 for missing event_id", async () => {
    const { DELETE } = await import("@/app/api/rsvp/route");
    const req = makeRequest("DELETE", "http://localhost/api/rsvp");
    const resp = await (DELETE as Function)(req, {
      user: { id: USER_ID },
      serviceClient: makeFlexibleClient(),
    });
    expect(resp.status).toBe(400);
  });

  it("emits deprecation warn on DELETE", async () => {
    const service = makeFlexibleClient({
      plans: {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      },
    });

    const { DELETE } = await import("@/app/api/rsvp/route");
    const req = makeRequest("DELETE", `http://localhost/api/rsvp?event_id=${EVENT_ID}`);
    await (DELETE as Function)(req, {
      user: { id: USER_ID },
      serviceClient: service,
    });

    expect(mocks.warnSpy).toHaveBeenCalledWith(
      "deprecated route: /api/rsvp",
      expect.objectContaining({ route: "/api/rsvp", method: "DELETE" })
    );
  });
});
