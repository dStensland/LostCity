import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  createPortalScopedClient: vi.fn(),
  getPortalBySlug: vi.fn(),
  getLocalDateString: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
  isValidUUID: vi.fn(),
  applyManifestFederatedScopeToQuery: vi.fn((query) => query),
  excludeSensitiveEvents: vi.fn((query) => query),
  applyPortalCategoryFilters: vi.fn((query) => query),
  parsePortalContentFilters: vi.fn(() => ({})),
  buildPortalManifest: vi.fn(() => ({ id: "manifest" })),
  getPortalSourceAccess: vi.fn(),
  isNoiseEvent: vi.fn(() => false),
  applyFeedGate: vi.fn((query) => query),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    read: { limit: 60, windowSec: 60 },
  },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock("@/lib/supabase/server", () => ({
  createPortalScopedClient: mocks.createPortalScopedClient,
}));

vi.mock("@/lib/portal", () => ({
  getPortalBySlug: mocks.getPortalBySlug,
}));

vi.mock("@/lib/formats", () => ({
  getLocalDateString: mocks.getLocalDateString,
}));

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

vi.mock("@/lib/api-utils", () => ({
  isValidUUID: mocks.isValidUUID,
}));

vi.mock("@/lib/portal-scope", () => ({
  applyManifestFederatedScopeToQuery: mocks.applyManifestFederatedScopeToQuery,
  excludeSensitiveEvents: mocks.excludeSensitiveEvents,
  applyPortalCategoryFilters: mocks.applyPortalCategoryFilters,
  parsePortalContentFilters: mocks.parsePortalContentFilters,
}));

vi.mock("@/lib/portal-manifest", () => ({
  buildPortalManifest: mocks.buildPortalManifest,
}));

vi.mock("@/lib/federation", () => ({
  getPortalSourceAccess: mocks.getPortalSourceAccess,
}));

vi.mock("@/lib/show-noise-filter", () => ({
  isNoiseEvent: mocks.isNoiseEvent,
}));

vi.mock("@/lib/feed-gate", () => ({
  applyFeedGate: mocks.applyFeedGate,
}));

function buildThenableQuery(result: { data: unknown[] | null; error: unknown | null }) {
  const query: Record<string, unknown> = {};

  for (const method of ["select", "gte", "lte", "eq", "is", "or", "order", "in"]) {
    query[method] = vi.fn(() => query);
  }

  query.then = (resolve: (value: { data: unknown[] | null; error: unknown | null }) => unknown) =>
    Promise.resolve(result).then(resolve);

  return query as {
    select: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
  };
}

describe("GET /api/portals/[slug]/shows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
    mocks.getPortalBySlug.mockResolvedValue({
      id: "123e4567-e89b-12d3-a456-426614174000",
      slug: "atlanta",
      portal_type: "consumer",
      parent_portal_id: null,
      settings: {},
      filters: {},
    });
    mocks.getLocalDateString.mockReturnValue("2026-03-30");
    mocks.isValidUUID.mockReturnValue(true);
    mocks.getPortalSourceAccess.mockResolvedValue({
      sourceIds: [],
    });
  });

  it("applies is_show filtering when requested", async () => {
    const query = buildThenableQuery({
      data: [],
      error: null,
    });

    mocks.createPortalScopedClient.mockResolvedValue({
      from: vi.fn(() => query),
    });

    const { GET } = await import("@/app/api/portals/[slug]/shows/route");
    const request = new NextRequest(
      "http://localhost:3000/api/portals/atlanta/shows?categories=music&is_show=true",
    );

    const response = await GET(request, {
      params: Promise.resolve({ slug: "atlanta" }),
    });

    expect(query.eq).toHaveBeenCalledWith("is_show", true);
    expect(response.status).toBe(200);
  });

  it("falls back when is_show column is missing", async () => {
    const firstQuery = buildThenableQuery({
      data: null,
      error: { message: 'column "is_show" does not exist' },
    });
    const secondQuery = buildThenableQuery({
      data: [],
      error: null,
    });

    mocks.createPortalScopedClient.mockResolvedValue({
      from: vi.fn()
        .mockReturnValueOnce(firstQuery)
        .mockReturnValueOnce(secondQuery),
    });

    const { GET } = await import("@/app/api/portals/[slug]/shows/route");
    const request = new NextRequest(
      "http://localhost:3000/api/portals/atlanta/shows?categories=music&is_show=true",
    );

    const response = await GET(request, {
      params: Promise.resolve({ slug: "atlanta" }),
    });

    expect(firstQuery.eq).toHaveBeenCalledWith("is_show", true);
    expect(secondQuery.eq).not.toHaveBeenCalledWith("is_show", true);
    expect(mocks.logger.warn).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
