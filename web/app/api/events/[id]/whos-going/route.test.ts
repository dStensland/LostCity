import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  getUser: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    read: { limit: 200, windowSec: 60 },
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

function makeRequest(id: string) {
  return new NextRequest(`http://localhost:3000/api/events/${id}/whos-going`);
}

/**
 * Build a service client mock:
 *  - `plan_invitees` SELECT resolves to `rows`
 *  - `get_friend_ids` RPC resolves to the caller's friend list (as `{friend_id}` shape)
 */
function makeService(rows: unknown[], friendIds: string[] = []) {
  const chainNode = {
    eq: vi.fn(),
    in: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  chainNode.eq.mockReturnValue(chainNode);
  return {
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(chainNode) }),
    rpc: vi.fn().mockResolvedValue({
      data: friendIds.map((id) => ({ friend_id: id })),
      error: null,
    }),
  };
}

describe("GET /api/events/[id]/whos-going", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "not authenticated" },
    });
    mocks.createServiceClient.mockReturnValue({ from: vi.fn() });

    const { GET } = await import("@/app/api/events/[id]/whos-going/route");
    const response = await GET(makeRequest("42"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 for a non-numeric event id", async () => {
    mocks.createServiceClient.mockReturnValue({ from: vi.fn() });

    const { GET } = await import("@/app/api/events/[id]/whos-going/route");
    const response = await GET(makeRequest("not-a-number"), {
      params: Promise.resolve({ id: "not-a-number" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid event id" });
  });

  it("returns profiles and count on happy path", async () => {
    const mockProfile = {
      id: "user-2",
      username: "johntheo",
      display_name: "John Theo",
      avatar_url: "https://example.com/avatar.jpg",
    };

    const mockRows = [
      {
        user_id: "user-2",
        rsvp_status: "going",
        profile: mockProfile,
        plan: {
          id: "plan-1",
          creator_id: "user-2",
          anchor_event_id: 42,
          anchor_type: "event",
          visibility: "public",
        },
      },
    ];

    mocks.createServiceClient.mockReturnValue(makeService(mockRows));

    const { GET } = await import("@/app/api/events/[id]/whos-going/route");
    const response = await GET(makeRequest("42"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      profiles: [mockProfile],
      count: 1,
    });
  });

  it("returns empty profiles when no going plans exist", async () => {
    mocks.createServiceClient.mockReturnValue(makeService([]));

    const { GET } = await import("@/app/api/events/[id]/whos-going/route");
    const response = await GET(makeRequest("99"), {
      params: Promise.resolve({ id: "99" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ profiles: [], count: 0 });
  });

  it("returns 500 on database error", async () => {
    const chainNode = { eq: vi.fn(), in: vi.fn().mockResolvedValue({ data: null, error: { message: "DB timeout" } }) };
    chainNode.eq.mockReturnValue(chainNode);
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(chainNode) }),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const { GET } = await import("@/app/api/events/[id]/whos-going/route");
    const response = await GET(makeRequest("42"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "DB timeout" });
  });

  it("filters out rows with null profile", async () => {
    const mockRows = [
      {
        user_id: "user-deleted",
        rsvp_status: "going",
        profile: null,
        plan: {
          id: "plan-1",
          creator_id: "user-deleted",
          anchor_event_id: 42,
          anchor_type: "event",
          visibility: "public",
        },
      },
      {
        user_id: "user-2",
        rsvp_status: "going",
        profile: { id: "user-2", username: "alicesmith", display_name: "Alice Smith", avatar_url: null },
        plan: {
          id: "plan-2",
          creator_id: "user-2",
          anchor_event_id: 42,
          anchor_type: "event",
          visibility: "public",
        },
      },
    ];

    mocks.createServiceClient.mockReturnValue(makeService(mockRows));

    const { GET } = await import("@/app/api/events/[id]/whos-going/route");
    const response = await GET(makeRequest("42"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(1);
    expect(body.profiles[0].username).toBe("alicesmith");
  });

  // ─── friendship-gate regression guards ──────────────────────────────────
  // Non-friend should NOT see `visibility='friends'` attendance. This was
  // the live leak that shipped with PR #76/#80 before this fix. The aggregate
  // uses the service client (RLS-bypass) to reach across plan_invitees
  // policies; without an explicit friendship filter, friends-scoped plans
  // were visible to everyone.

  it("hides visibility='friends' attendance from a non-friend viewer", async () => {
    const mockRows = [
      {
        user_id: "user-2",
        rsvp_status: "going",
        profile: { id: "user-2", username: "bob", display_name: "Bob", avatar_url: null },
        plan: {
          id: "plan-1",
          creator_id: "user-2", // Bob (not a friend of viewer user-1)
          anchor_event_id: 42,
          anchor_type: "event",
          visibility: "friends",
        },
      },
    ];

    // Viewer user-1 has no friends — Bob's friends-scoped plan must be dropped.
    mocks.createServiceClient.mockReturnValue(makeService(mockRows, []));

    const { GET } = await import("@/app/api/events/[id]/whos-going/route");
    const response = await GET(makeRequest("42"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ profiles: [], count: 0 });
  });

  it("includes visibility='friends' attendance when the viewer is friends with the plan creator", async () => {
    const mockRows = [
      {
        user_id: "user-2",
        rsvp_status: "going",
        profile: { id: "user-2", username: "bob", display_name: "Bob", avatar_url: null },
        plan: {
          id: "plan-1",
          creator_id: "user-2",
          anchor_event_id: 42,
          anchor_type: "event",
          visibility: "friends",
        },
      },
    ];

    // user-1 (viewer) IS friends with user-2 (plan creator).
    mocks.createServiceClient.mockReturnValue(makeService(mockRows, ["user-2"]));

    const { GET } = await import("@/app/api/events/[id]/whos-going/route");
    const response = await GET(makeRequest("42"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(1);
    expect(body.profiles[0].username).toBe("bob");
  });

  it("includes visibility='friends' attendance when the viewer IS the plan creator", async () => {
    // Edge case: viewer's own friends-scoped plan should always surface — no
    // friendship lookup needed since self-match short-circuits the check.
    const mockRows = [
      {
        user_id: "user-1",
        rsvp_status: "going",
        profile: { id: "user-1", username: "me", display_name: "Me", avatar_url: null },
        plan: {
          id: "plan-1",
          creator_id: "user-1", // viewer is the creator
          anchor_event_id: 42,
          anchor_type: "event",
          visibility: "friends",
        },
      },
    ];

    mocks.createServiceClient.mockReturnValue(makeService(mockRows, []));

    const { GET } = await import("@/app/api/events/[id]/whos-going/route");
    const response = await GET(makeRequest("42"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(1);
    expect(body.profiles[0].username).toBe("me");
  });

  it("mixes public and friends-scoped rows correctly across friend and non-friend creators", async () => {
    const mockRows = [
      // Public plan from a non-friend — always included
      {
        user_id: "user-a",
        rsvp_status: "going",
        profile: { id: "user-a", username: "alice", display_name: "Alice", avatar_url: null },
        plan: {
          id: "plan-a",
          creator_id: "user-a",
          anchor_event_id: 42,
          anchor_type: "event",
          visibility: "public",
        },
      },
      // Friends plan from a friend — included
      {
        user_id: "user-b",
        rsvp_status: "going",
        profile: { id: "user-b", username: "bob", display_name: "Bob", avatar_url: null },
        plan: {
          id: "plan-b",
          creator_id: "user-b",
          anchor_event_id: 42,
          anchor_type: "event",
          visibility: "friends",
        },
      },
      // Friends plan from a non-friend — EXCLUDED
      {
        user_id: "user-c",
        rsvp_status: "going",
        profile: { id: "user-c", username: "carol", display_name: "Carol", avatar_url: null },
        plan: {
          id: "plan-c",
          creator_id: "user-c",
          anchor_event_id: 42,
          anchor_type: "event",
          visibility: "friends",
        },
      },
    ];

    // user-1 is friends with user-b only.
    mocks.createServiceClient.mockReturnValue(makeService(mockRows, ["user-b"]));

    const { GET } = await import("@/app/api/events/[id]/whos-going/route");
    const response = await GET(makeRequest("42"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(2);
    const usernames = body.profiles.map((p: { username: string }) => p.username).sort();
    expect(usernames).toEqual(["alice", "bob"]);
  });
});
