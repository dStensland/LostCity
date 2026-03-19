import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  createClient: vi.fn(),
  getPortalSourceAccess: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    read: { limit: 60, windowSec: 60 },
  },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/federation", () => ({
  getPortalSourceAccess: mocks.getPortalSourceAccess,
}));

describe("GET /api/portals/[slug]/sources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
  });

  it("defaults entity_family to events when the query value is invalid", async () => {
    const portalQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    portalQuery.select.mockReturnValue(portalQuery);
    portalQuery.eq.mockReturnValue(portalQuery);
    portalQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "portal-1",
        slug: "atlanta",
        name: "Atlanta",
      },
      error: null,
    });

    mocks.createClient.mockResolvedValue({
      from: vi.fn(() => portalQuery),
    });
    mocks.getPortalSourceAccess.mockResolvedValue({
      entityFamily: "events",
      sourceIds: [10],
      categoryConstraints: new Map([[10, ["music"]]]),
      accessDetails: [
        {
          sourceId: 10,
          sourceName: "Example Source",
          accessibleCategories: ["music"],
          accessType: "subscription",
        },
      ],
    });

    const { GET } = await import("@/app/api/portals/[slug]/sources/route");

    const request = new NextRequest(
      "http://localhost:3000/api/portals/atlanta/sources?entity_family=bogus",
    );

    const response = await GET(request, {
      params: Promise.resolve({ slug: "atlanta" }),
    });

    expect(mocks.getPortalSourceAccess).toHaveBeenCalledWith("portal-1", {
      entityFamily: "events",
    });
    await expect(response.json()).resolves.toMatchObject({
      entity_family: "events",
      sourceCount: 1,
    });
  });

  it("passes through a valid non-event entity family", async () => {
    const portalQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    portalQuery.select.mockReturnValue(portalQuery);
    portalQuery.eq.mockReturnValue(portalQuery);
    portalQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "portal-arts",
        slug: "arts-atlanta",
        name: "Lost City: Arts",
      },
      error: null,
    });

    mocks.createClient.mockResolvedValue({
      from: vi.fn(() => portalQuery),
    });
    mocks.getPortalSourceAccess.mockResolvedValue({
      entityFamily: "open_calls",
      sourceIds: [41, 42],
      categoryConstraints: new Map([
        [41, null],
        [42, null],
      ]),
      accessDetails: [
        {
          sourceId: 41,
          sourceName: "Arts Source 1",
          accessibleCategories: null,
          accessType: "owner",
        },
        {
          sourceId: 42,
          sourceName: "Arts Source 2",
          accessibleCategories: null,
          accessType: "subscription",
        },
      ],
    });

    const { GET } = await import("@/app/api/portals/[slug]/sources/route");

    const request = new NextRequest(
      "http://localhost:3000/api/portals/arts-atlanta/sources?entity_family=open_calls",
    );

    const response = await GET(request, {
      params: Promise.resolve({ slug: "arts-atlanta" }),
    });

    expect(mocks.getPortalSourceAccess).toHaveBeenCalledWith("portal-arts", {
      entityFamily: "open_calls",
    });
    await expect(response.json()).resolves.toMatchObject({
      entity_family: "open_calls",
      sourceCount: 2,
    });
  });
});
