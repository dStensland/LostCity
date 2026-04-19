import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const VALID_KEY = "test-plans-expire-key-32-chars-xx";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc: mocks.rpc,
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
  },
}));

function makeRequest(authHeader?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (authHeader !== undefined) {
    headers["authorization"] = authHeader;
  }
  return new NextRequest("http://localhost:3000/api/cron/plans-expire", {
    method: "POST",
    headers,
  });
}

describe("POST /api/cron/plans-expire", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PLANS_EXPIRE_CRON_API_KEY", VALID_KEY);
  });

  it("returns 401 when authorization header is missing", async () => {
    const { POST } = await import("@/app/api/cron/plans-expire/route");
    const response = await POST(makeRequest());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 when bearer token is wrong", async () => {
    const { POST } = await import("@/app/api/cron/plans-expire/route");
    const response = await POST(makeRequest("Bearer wrong-token-same-length-xxxx"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  it("returns 200 with expired count on successful sweep", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ expired_count: 3 }],
      error: null,
    });

    const { POST } = await import("@/app/api/cron/plans-expire/route");
    const response = await POST(makeRequest(`Bearer ${VALID_KEY}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ expired: 3 });
    expect(mocks.rpc).toHaveBeenCalledWith("expire_stale_plans");
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      "plans-expire sweep complete",
      { count: 3, component: "plans-expire" },
    );
  });

  it("returns 200 with expired: 0 when RPC returns empty array", async () => {
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const { POST } = await import("@/app/api/cron/plans-expire/route");
    const response = await POST(makeRequest(`Bearer ${VALID_KEY}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ expired: 0 });
  });

  it("returns 500 when RPC returns an error", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    const { POST } = await import("@/app/api/cron/plans-expire/route");
    const response = await POST(makeRequest(`Bearer ${VALID_KEY}`));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "database unavailable" });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "plans-expire sweep failed",
      { message: "database unavailable" },
      { component: "plans-expire" },
    );
  });
});
