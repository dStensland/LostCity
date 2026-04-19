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
        plan: { id: "plan-1", anchor_event_id: 42, anchor_type: "event", visibility: "friends" },
      },
    ];

    // Build a terminal mock that resolves to the data
    const terminalMock = vi.fn().mockResolvedValue({ data: mockRows, error: null });

    // Chain needs: select → eq → eq → eq → in
    // Each eq/in returns an object with both eq and in so any call order works
    const chainNode = {
      eq: vi.fn(),
      in: terminalMock,
    };
    chainNode.eq.mockReturnValue(chainNode);

    const fromMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(chainNode),
    });

    mocks.createServiceClient.mockReturnValue({ from: fromMock });

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
    const chainNode = { eq: vi.fn(), in: vi.fn().mockResolvedValue({ data: [], error: null }) };
    chainNode.eq.mockReturnValue(chainNode);
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(chainNode) }),
    });

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
        plan: { id: "plan-1", anchor_event_id: 42, anchor_type: "event", visibility: "public" },
      },
      {
        user_id: "user-2",
        rsvp_status: "going",
        profile: { id: "user-2", username: "alicesmith", display_name: "Alice Smith", avatar_url: null },
        plan: { id: "plan-2", anchor_event_id: 42, anchor_type: "event", visibility: "public" },
      },
    ];

    const chainNode = { eq: vi.fn(), in: vi.fn().mockResolvedValue({ data: mockRows, error: null }) };
    chainNode.eq.mockReturnValue(chainNode);
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(chainNode) }),
    });

    const { GET } = await import("@/app/api/events/[id]/whos-going/route");
    const response = await GET(makeRequest("42"), {
      params: Promise.resolve({ id: "42" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(1);
    expect(body.profiles[0].username).toBe("alicesmith");
  });
});
