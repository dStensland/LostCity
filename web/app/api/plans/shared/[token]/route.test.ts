import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

// Valid 24-char hex token
const VALID_TOKEN = "abcdef1234567890abcdef12";
const PLAN_ID = "550e8400-e29b-41d4-a716-446655440002";
const USER_ID = "550e8400-e29b-41d4-a716-446655440001";

describe("GET /api/plans/shared/[token]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
  });

  it("returns 404 for invalid token length", async () => {
    const { GET } = await import("@/app/api/plans/shared/[token]/route");

    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })),
    });

    const request = new NextRequest("http://localhost:3000/api/plans/shared/tooshort");

    const response = await GET(request, {
      params: Promise.resolve({ token: "tooshort" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 when plan not found by token", async () => {
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })),
    });

    const { GET } = await import("@/app/api/plans/shared/[token]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/shared/${VALID_TOKEN}`);

    const response = await GET(request, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });

    expect(response.status).toBe(404);
  });

  it("returns plan for public visibility without auth", async () => {
    const plan = { id: PLAN_ID, visibility: "public", creator_id: "creator-id" };

    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: plan, error: null }),
          }),
        }),
      })),
    });

    const { GET } = await import("@/app/api/plans/shared/[token]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/shared/${VALID_TOKEN}`);

    const response = await GET(request, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.plan.id).toBe(PLAN_ID);
  });

  it("returns plan for friends visibility without auth check", async () => {
    const plan = { id: PLAN_ID, visibility: "friends", creator_id: "creator-id" };

    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: plan, error: null }),
          }),
        }),
      })),
    });

    const { GET } = await import("@/app/api/plans/shared/[token]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/shared/${VALID_TOKEN}`);

    const response = await GET(request, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });

    expect(response.status).toBe(200);
  });

  it("returns 404 for private plan when user not authenticated", async () => {
    const plan = { id: PLAN_ID, visibility: "private", creator_id: "creator-id" };

    mocks.createServiceClient.mockReturnValue({
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
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        };
      }),
    });

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const { GET } = await import("@/app/api/plans/shared/[token]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/shared/${VALID_TOKEN}`);

    const response = await GET(request, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });

    expect(response.status).toBe(404);
  });

  it("returns plan for private visibility when authenticated invitee", async () => {
    const plan = { id: PLAN_ID, visibility: "private", creator_id: "creator-id" };

    const inviteRecord = { user_id: USER_ID };

    mocks.createServiceClient.mockReturnValue({
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
        // plan_invitees check
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: inviteRecord, error: null }),
              }),
            }),
          }),
        };
      }),
    });

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
      },
    });

    const { GET } = await import("@/app/api/plans/shared/[token]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/shared/${VALID_TOKEN}`);

    const response = await GET(request, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.plan.id).toBe(PLAN_ID);
  });

  it("blocks when rate limited", async () => {
    mocks.applyRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 })
    );

    const { GET } = await import("@/app/api/plans/shared/[token]/route");

    const request = new NextRequest(`http://localhost:3000/api/plans/shared/${VALID_TOKEN}`);

    const response = await GET(request, {
      params: Promise.resolve({ token: VALID_TOKEN }),
    });

    expect(response.status).toBe(429);
  });
});
