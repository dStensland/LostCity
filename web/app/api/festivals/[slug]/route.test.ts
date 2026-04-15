import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  resolvePortalQueryContext: vi.fn(),
  filterByPortalCity: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    read: { limit: 60, windowSec: 60 },
  },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock("@/lib/portal-query-context", () => ({
  resolvePortalQueryContext: mocks.resolvePortalQueryContext,
}));

vi.mock("@/lib/portal-scope", () => ({
  filterByPortalCity: mocks.filterByPortalCity,
}));

function createQuery(result: { data: unknown; error?: unknown }) {
  const resolved = { data: result.data, error: result.error ?? null };
  type MockFn = ReturnType<typeof vi.fn>;
  const query: {
    select: MockFn;
    eq: MockFn;
    maybeSingle: MockFn;
    order: MockFn;
    in: MockFn;
    is: MockFn;
    limit: MockFn;
    then: (resolve: (value: typeof resolved) => unknown) => Promise<unknown>;
    catch: () => Promise<unknown>;
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    limit: vi.fn(),
    then: (resolve) => Promise.resolve(resolve(resolved)),
    catch: () => Promise.resolve(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.limit.mockResolvedValue(resolved);
  query.maybeSingle.mockResolvedValue(resolved);
  return query;
}

describe("GET /api/festivals/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
    mocks.resolvePortalQueryContext.mockResolvedValue({
      portalId: "portal-atlanta",
      filters: { city: "Atlanta" },
      hasPortalParamMismatch: false,
    });
    mocks.filterByPortalCity.mockImplementation((rows: unknown[]) => rows);
  });

  it("returns screenings from screening tables alongside programs", async () => {
    const festivalQuery = createQuery({
      data: {
        id: "atlanta-film-festival",
        slug: "atlanta-film-festival",
        name: "Atlanta Film Festival",
      },
    });
    const programsQuery = createQuery({
      data: [
        {
          id: "program-1",
          slug: "opening-night",
          title: "Opening Night",
          description: null,
          image_url: "https://example.com/program.jpg",
          series_type: "festival_program",
        },
      ],
    });
    const eventsQuery = createQuery({
      data: [
        {
          id: 101,
          title: "Opening Night Film",
          start_date: "2026-04-25",
          start_time: "19:00:00",
          end_time: "21:00:00",
          series_id: "program-1",
          image_url: "https://example.com/poster.jpg",
          tags: ["screening"],
          source_url: "https://example.com/session",
          ticket_url: "https://example.com/tickets",
          category_id: "film",
          series: {
            id: "program-1",
            slug: "opening-night",
            title: "Opening Night",
            series_type: "festival_program",
            image_url: "https://example.com/program.jpg",
            festival: {
              id: "atlanta-film-festival",
              name: "Atlanta Film Festival",
            },
          },
          venue: null,
        },
      ],
    });
    const directEventsQuery = createQuery({ data: [] });

    // Screening tables populated — screening-primary is the source of truth
    const screeningRunsQuery = createQuery({
      data: [
        {
          id: "run-1",
          screening_title_id: "title-1",
          place_id: null,
          festival_id: "atlanta-film-festival",
          label: "Opening Night Film",
          start_date: "2026-04-25",
          end_date: "2026-04-25",
          source_id: 1,
          buy_url: "https://example.com/tickets",
          info_url: "https://example.com/session",
          is_special_event: true,
        },
      ],
    });
    const screeningTimesQuery = createQuery({
      data: [
        {
          id: "time-1",
          screening_run_id: "run-1",
          event_id: 101,
          start_date: "2026-04-25",
          start_time: "19:00:00",
          end_time: "21:00:00",
          ticket_url: "https://example.com/tickets",
          source_url: "https://example.com/session",
          format_labels: [],
          status: "scheduled",
        },
      ],
    });
    const screeningTitlesQuery = createQuery({
      data: [
        {
          id: "title-1",
          canonical_title: "Opening Night Film",
          slug: "opening-night-film",
          kind: "festival_screening_block",
          poster_image_url: "https://example.com/poster.jpg",
          synopsis: null,
          genres: [],
        },
      ],
    });

    let eventTableCalls = 0;

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "festivals") return festivalQuery;
        if (table === "series") return programsQuery;
        if (table === "events") {
          eventTableCalls += 1;
          return eventTableCalls === 1 ? eventsQuery : directEventsQuery;
        }
        if (table === "screening_runs") return screeningRunsQuery;
        if (table === "screening_times") return screeningTimesQuery;
        if (table === "screening_titles") return screeningTitlesQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const { GET } = await import("@/app/api/festivals/[slug]/route");
    const response = await GET(
      new NextRequest("http://localhost:3000/api/festivals/atlanta-film-festival?portal=atlanta"),
      { params: Promise.resolve({ slug: "atlanta-film-festival" }) },
    );
    const body = await response.json();

    expect(body.programs).toHaveLength(1);
    expect(body.screenings.titles).toHaveLength(1);
    expect(body.screenings.titles[0].kind).toBe("festival_screening_block");
    expect(body.screenings.times[0].event_id).toBe(101);
  });
});
