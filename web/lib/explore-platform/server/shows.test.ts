import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolvePortalQueryContext: vi.fn(),
  getPortalSourceAccess: vi.fn(),
  getOrSetSharedCacheJson: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/portal-query-context", () => ({
  resolvePortalQueryContext: mocks.resolvePortalQueryContext,
}));

vi.mock("@/lib/federation", () => ({
  getPortalSourceAccess: mocks.getPortalSourceAccess,
}));

vi.mock("@/lib/shared-cache", () => ({
  getOrSetSharedCacheJson: mocks.getOrSetSharedCacheJson,
}));

function createThenableQuery(result: { data: unknown; error?: unknown }) {
  type MockFn = ReturnType<typeof vi.fn>;
  const query: {
    select: MockFn;
    eq: MockFn;
    gte: MockFn;
    lte: MockFn;
    not: MockFn;
    order: MockFn;
    in: MockFn;
    limit: MockFn;
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => Promise<unknown>;
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    then: (resolve) =>
      Promise.resolve(resolve({ data: result.data, error: result.error ?? null })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.not.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

describe("getShowtimesPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolvePortalQueryContext.mockResolvedValue({
      portalId: "portal-atlanta",
      filters: { city: "Atlanta" },
    });
    mocks.getPortalSourceAccess.mockResolvedValue({ sourceIds: [] });
    mocks.getOrSetSharedCacheJson.mockImplementation(
      async (_namespace, _key, _ttl, loader) => loader(),
    );
  });

  it("prefers stored screening tables when available", async () => {
    let screeningTimesCalls = 0;
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "screening_times") {
          screeningTimesCalls += 1;
          return createThenableQuery({
            data:
              screeningTimesCalls === 1
                ? [
                    {
                      id: "time-1",
                      screening_run_id: "run-1",
                      event_id: 101,
                      start_date: "2026-04-10",
                      start_time: "19:00:00",
                    },
                  ]
                : [
                    {
                      id: "time-1",
                      screening_run_id: "run-1",
                      event_id: 101,
                      start_date: "2026-04-10",
                      start_time: "19:00:00",
                    },
                    {
                      id: "time-2",
                      screening_run_id: "run-1",
                      event_id: 102,
                      start_date: "2026-04-11",
                      start_time: "21:15:00",
                    },
                  ],
          });
        }
        if (table === "screening_runs") {
          return createThenableQuery({
            data: [
              {
                id: "run-1",
                screening_title_id: "title-1",
                place_id: 44,
                source_id: 88,
                festival_id: null,
                is_special_event: false,
              },
            ],
          });
        }
        if (table === "screening_titles") {
          return createThenableQuery({
            data: [
              {
                id: "title-1",
                canonical_title: "Sinners",
                slug: "sinners",
                poster_image_url: "https://example.com/poster.jpg",
                genres: ["thriller"],
              },
            ],
          });
        }
        if (table === "places") {
          return createThenableQuery({
            data: [
              {
                id: 44,
                name: "Plaza Theatre",
                slug: "plaza-theatre",
                neighborhood: "Poncey-Highland",
                city: "Atlanta",
                place_vertical_details: { google: { rating: 4.7, rating_count: 1200 } },
              },
            ],
          });
        }
        if (table === "sources") {
          return createThenableQuery({ data: [{ id: 88 }] });
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const { getShowtimesPayload } = await import("@/lib/explore-platform/server/shows");
    const payload = await getShowtimesPayload({
      searchParams: new URLSearchParams("portal=atlanta&date=2026-04-10&meta=true"),
    });

    expect(payload.films).toHaveLength(1);
    expect(payload.films?.[0]?.title).toBe("Sinners");
    expect(payload.films?.[0]?.theaters[0]?.times).toEqual([{ time: "19:00", event_id: 101 }]);
    expect(payload.meta?.available_dates).toEqual(["2026-04-10", "2026-04-11"]);
    expect(payload.meta?.available_theaters[0]?.venue_slug).toBe("plaza-theatre");
  });

  it("merges same-title films across sources and keeps a non-null poster", async () => {
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "screening_times") {
          return createThenableQuery({
            data: [
              {
                id: "time-1",
                screening_run_id: "run-1",
                event_id: 201,
                start_date: "2026-04-10",
                start_time: "19:00:00",
              },
              {
                id: "time-2",
                screening_run_id: "run-2",
                event_id: 202,
                start_date: "2026-04-10",
                start_time: "21:00:00",
              },
            ],
          });
        }
        if (table === "screening_runs") {
          return createThenableQuery({
            data: [
              {
                id: "run-1",
                screening_title_id: "title-1",
                place_id: 44,
                source_id: 88,
                festival_id: null,
                is_special_event: false,
              },
              {
                id: "run-2",
                screening_title_id: "title-2",
                place_id: 45,
                source_id: 89,
                festival_id: null,
                is_special_event: false,
              },
            ],
          });
        }
        if (table === "screening_titles") {
          return createThenableQuery({
            data: [
              {
                id: "title-1",
                canonical_title: "Hamlet",
                slug: "hamlet-landmark",
                poster_image_url: null,
                genres: ["drama"],
              },
              {
                id: "title-2",
                canonical_title: "Hamlet",
                slug: "hamlet-tara",
                poster_image_url: "https://example.com/hamlet.jpg",
                genres: ["drama"],
              },
            ],
          });
        }
        if (table === "places") {
          return createThenableQuery({
            data: [
              {
                id: 44,
                name: "Landmark Midtown Art Cinema",
                slug: "landmark-midtown-art-cinema",
                neighborhood: "Midtown",
                city: "Atlanta",
                place_vertical_details: { google: { rating: 4.4, rating_count: 900 } },
              },
              {
                id: 45,
                name: "Tara Theatre",
                slug: "tara-theatre",
                neighborhood: "Brookwood",
                city: "Atlanta",
                place_vertical_details: { google: { rating: 4.6, rating_count: 1100 } },
              },
            ],
          });
        }
        if (table === "sources") {
          return createThenableQuery({ data: [{ id: 88 }, { id: 89 }] });
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const { getShowtimesPayload } = await import("@/lib/explore-platform/server/shows");
    const payload = await getShowtimesPayload({
      searchParams: new URLSearchParams("portal=atlanta&date=2026-04-10&meta=true"),
    });

    expect(payload.films).toHaveLength(1);
    expect(payload.films?.[0]?.title).toBe("Hamlet");
    expect(payload.films?.[0]?.image_url).toBe("https://example.com/hamlet.jpg");
    expect(payload.films?.[0]?.theaters).toHaveLength(2);
  });
});
