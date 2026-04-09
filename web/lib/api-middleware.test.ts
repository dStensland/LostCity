import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const { mockGetUser, mockCreateClient, mockCreateServiceClient } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockCreateClient = vi.fn(() => ({
    auth: { getUser: mockGetUser },
  }));
  const mockCreateServiceClient = vi.fn(() => ({ from: vi.fn() }));
  return { mockGetUser, mockCreateClient, mockCreateServiceClient };
});

vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockCreateServiceClient,
}));

import { withAuth, withValidation } from "./api-middleware";
import { NextRequest } from "next/server";

function makeRequest(
  url: string,
  options?: { method?: string; body?: unknown }
) {
  const req = new NextRequest(new URL(url, "http://localhost"), {
    method: options?.method ?? "GET",
    ...(options?.body
      ? {
          body: JSON.stringify(options.body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
  return req;
}

describe("withAuth with schemas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@test.com" } },
      error: null,
    });
  });

  it("passes typed body to handler when schema validates", async () => {
    const schema = z.object({
      event_id: z.number().int().positive(),
      status: z.enum(["going", "interested"]),
    });

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const route = withAuth({ body: schema }, handler);
    const req = makeRequest("http://localhost/api/test", {
      method: "POST",
      body: { event_id: 42, status: "going" },
    });

    const response = await route(req);
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        user: expect.objectContaining({ id: "user-123" }),
        validated: expect.objectContaining({
          body: { event_id: 42, status: "going" },
        }),
      })
    );
  });

  it("returns 400 when body validation fails", async () => {
    const schema = z.object({
      event_id: z.number().int().positive(),
    });

    const handler = vi.fn();
    const route = withAuth({ body: schema }, handler);
    const req = makeRequest("http://localhost/api/test", {
      method: "POST",
      body: { event_id: "not-a-number" },
    });

    const response = await route(req);
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 before validation when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "No session" },
    });

    const schema = z.object({ event_id: z.number() });
    const handler = vi.fn();
    const route = withAuth({ body: schema }, handler);
    const req = makeRequest("http://localhost/api/test", {
      method: "POST",
      body: { event_id: "bad" },
    });

    const response = await route(req);
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("validates query params for GET routes", async () => {
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).default(0),
    });

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const route = withAuth({ query: schema }, handler);
    const req = makeRequest("http://localhost/api/test?limit=50&offset=10");

    const response = await route(req);
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        validated: expect.objectContaining({
          query: { limit: 50, offset: 10 },
        }),
      })
    );
  });

  it("still works without schemas (backward compat)", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const route = withAuth(handler);
    const req = makeRequest("http://localhost/api/test");

    const response = await route(req);
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        user: expect.objectContaining({ id: "user-123" }),
      })
    );
  });
});

describe("withValidation (public routes)", () => {
  it("passes typed query to handler", async () => {
    const schema = z.object({
      q: z.string().min(1),
    });

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 })
    );

    const route = withValidation({ query: schema }, handler);
    const req = makeRequest("http://localhost/api/search?q=pizza");

    const response = await route(req);
    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        validated: expect.objectContaining({ query: { q: "pizza" } }),
      })
    );
  });

  it("returns 400 for invalid query on public routes", async () => {
    const schema = z.object({
      q: z.string().min(1),
    });

    const handler = vi.fn();
    const route = withValidation({ query: schema }, handler);
    const req = makeRequest("http://localhost/api/search?q=");

    const response = await route(req);
    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns generic error message for public routes (no schema leakage)", async () => {
    const schema = z.object({
      q: z.string().min(1),
      limit: z.number().int().positive(),
    });

    const handler = vi.fn();
    const route = withValidation({ query: schema }, handler);
    const req = makeRequest("http://localhost/api/search?q=&limit=abc");

    const response = await route(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    // Should NOT contain detailed schema paths
    expect(body.error).toBe("Invalid request");
    expect(handler).not.toHaveBeenCalled();
  });
});
