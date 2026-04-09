import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  resolvePortalQueryContext: vi.fn(),
  getVerticalFromRequest: vi.fn(),
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

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/lib/portal-query-context", () => ({
  resolvePortalQueryContext: mocks.resolvePortalQueryContext,
  getVerticalFromRequest: mocks.getVerticalFromRequest,
}));

vi.mock("@/lib/federation", () => ({
  getPortalSourceAccess: mocks.getPortalSourceAccess,
}));

function buildProgramsQuery(data: unknown[] = []) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    not: vi.fn(),
    contains: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.not.mockReturnValue(query);
  query.contains.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockResolvedValue({
    data,
    error: null,
  });
  return query;
}

function buildEventsQuery(data: unknown[] = []) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue({
    data,
    error: null,
  });
  return query;
}

describe("GET /api/programs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
    mocks.getVerticalFromRequest.mockReturnValue("family");
    mocks.resolvePortalQueryContext.mockResolvedValue({
      portalId: "portal-family",
      hasPortalParamMismatch: false,
    });
  });

  it("returns canonical empty programs without falling back by default", async () => {
    const programsQuery = buildProgramsQuery([]);
    mocks.createClient.mockResolvedValue({
      from: vi.fn(() => programsQuery),
    });
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => programsQuery),
    });
    mocks.getPortalSourceAccess.mockResolvedValue({
      entityFamily: "programs",
      sourceIds: [],
      categoryConstraints: new Map(),
      accessDetails: [],
    });

    const { GET } = await import("@/app/api/programs/route");

    const request = new NextRequest(
      "http://localhost:3000/api/programs?portal=atlanta-families",
    );

    const response = await GET(request);

    // Federation is now called for ALL programs requests (not just fallback)
    expect(mocks.getPortalSourceAccess).toHaveBeenCalledWith("portal-family", {
      entityFamily: "programs",
    });
    expect(mocks.createServiceClient).toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      programs: [],
      total: 0,
      source: "programs",
      compatibility_mode: null,
    });
  });

  it("uses recurring-event compatibility only when explicitly requested", async () => {
    const programsQuery = buildProgramsQuery([]);
    const eventRows = [
      {
        id: 10,
        title: "Camp Preview Night",
      },
    ];
    const eventsQuery = buildEventsQuery(eventRows);

    mocks.createClient.mockResolvedValue({
      from: vi.fn(() => programsQuery),
    });
    // serviceClient.from() is called for BOTH programs (main query) and events (fallback)
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => table === "events" ? eventsQuery : programsQuery),
    });
    mocks.getPortalSourceAccess.mockResolvedValue({
      entityFamily: "programs",
      sourceIds: [101],
      categoryConstraints: new Map([[101, null]]),
      accessDetails: [],
    });

    const { GET } = await import("@/app/api/programs/route");

    const request = new NextRequest(
      "http://localhost:3000/api/programs?portal=atlanta-families&include_events_fallback=true",
    );

    const response = await GET(request);

    expect(mocks.getPortalSourceAccess).toHaveBeenCalledWith("portal-family", {
      entityFamily: "programs",
    });
    expect(mocks.createServiceClient).toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      programs: eventRows,
      total: 1,
      source: "events_fallback",
      compatibility_mode: "include_events_fallback",
    });
  });

  it("does not select the stale programs.venue_id column", async () => {
    const programRows = [
      {
        id: "prog-1",
        portal_id: "portal-family",
        source_id: 101,
        name: "Robotics Club",
        slug: "robotics-club",
        description: "Build and test robots.",
        program_type: "class",
        provider_name: "Atlanta Parks & Recreation",
        age_min: 8,
        age_max: 12,
        season: "spring",
        session_start: "2026-04-10",
        session_end: "2026-05-20",
        schedule_days: [2, 4],
        schedule_start_time: "15:00:00",
        schedule_end_time: "17:00:00",
        cost_amount: 0,
        cost_period: "season",
        cost_notes: null,
        registration_status: "open",
        registration_opens: null,
        registration_closes: null,
        registration_url: null,
        before_after_care: false,
        lunch_included: false,
        tags: ["stem"],
        status: "active",
        venue: {
          id: 44,
          name: "Grove Park Recreation Center",
          neighborhood: "Grove Park",
          address: "750 Francis Pl NW",
          city: "Atlanta",
          lat: 33.77,
          lng: -84.46,
          image_url: "https://example.com/program.jpg",
          indoor_outdoor: "indoor",
        },
      },
    ];
    const programsQuery = buildProgramsQuery(programRows);
    mocks.createClient.mockResolvedValue({
      from: vi.fn(() => programsQuery),
    });
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => programsQuery),
    });
    mocks.getPortalSourceAccess.mockResolvedValue({
      entityFamily: "programs",
      sourceIds: [101],
      categoryConstraints: new Map([[101, null]]),
      accessDetails: [],
    });

    const { GET } = await import("@/app/api/programs/route");
    const request = new NextRequest(
      "http://localhost:3000/api/programs?portal=atlanta-families",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(programsQuery.select.mock.calls[0][0]).not.toContain("venue_id");
    expect(body.programs).toHaveLength(1);
    expect(body.programs[0].name).toBe("Robotics Club");
  });
});
