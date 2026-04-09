import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  createClient: vi.fn(),
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

vi.mock("@/lib/image-quality-suppression", () => ({
  suppressVenueImagesIfFlagged: <T,>(value: T) => value,
}));

vi.mock("@/lib/feed-gate", () => ({
  applyFeedGate: <T,>(query: T) => query,
}));

vi.mock("@/lib/formats", () => ({
  getLocalDateString: (date?: Date) => (date ?? new Date("2026-04-07T12:00:00Z")).toISOString().slice(0, 10),
}));

function createResolvedQuery<T>(result: T) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    is: vi.fn(),
    or: vi.fn(),
    limit: vi.fn(),
    then: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.limit.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);
  query.then.mockImplementation((resolve: (value: T) => unknown) => Promise.resolve(resolve(result)));
  return query;
}

describe("GET /api/explore/tracks/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue("test-client");
  });

  it("uses the venues:places alias and returns approved venues", async () => {
    const trackQuery = createResolvedQuery({
      data: {
        id: 1,
        slug: "welcome-to-atlanta",
        name: "Welcome to Atlanta",
        sort_order: 1,
        is_active: true,
      },
      error: null,
    });
    const trackVenuesQuery = createResolvedQuery({
      data: [
        {
          id: 11,
          editorial_blurb: "Start here.",
          source_url: null,
          source_label: null,
          is_featured: true,
          upvote_count: 3,
          sort_order: 1,
          venues: {
            id: 100,
            name: "Georgia Aquarium",
            slug: "georgia-aquarium",
            neighborhood: "Midtown",
            short_description: "Aquarium",
            image_url: "https://example.com/aquarium.jpg",
            hero_image_url: null,
            place_type: "aquarium",
            data_quality: 92,
          },
        },
      ],
      error: null,
    });
    const tipsQuery = createResolvedQuery({ data: [], error: null });
    const eventsQuery = createResolvedQuery({ data: [], error: null });
    const highlightsQuery = createResolvedQuery({ data: [], error: null });

    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "explore_tracks") return trackQuery;
        if (table === "explore_track_venues") return trackVenuesQuery;
        if (table === "explore_tips") return tipsQuery;
        if (table === "events") return eventsQuery;
        if (table === "venue_highlights") return highlightsQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const { GET } = await import("@/app/api/explore/tracks/[slug]/route");
    const request = new NextRequest("http://localhost:3000/api/explore/tracks/welcome-to-atlanta");
    const response = await GET(request, { params: Promise.resolve({ slug: "welcome-to-atlanta" }) });
    const body = await response.json();

    expect(trackVenuesQuery.select).toHaveBeenCalled();
    expect(trackVenuesQuery.select.mock.calls[0][0]).toContain("venues:places");
    expect(body.track.slug).toBe("welcome-to-atlanta");
    expect(body.venues).toHaveLength(1);
    expect(body.venues[0].venue.name).toBe("Georgia Aquarium");
  });
});
