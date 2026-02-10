import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { RATE_LIMITS } from "@/lib/rate-limit";

// Mock dependencies
vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(() => "test-client"),
  RATE_LIMITS: {
    read: { limit: 200, windowSec: 60 },
  },
}));

vi.mock("@/lib/search", () => ({
  getFilteredEventsWithSearch: vi.fn(),
  getFilteredEventsWithCursor: vi.fn(),
  enrichEventsWithSocialProof: vi.fn((events) => Promise.resolve(events)),
  PRICE_FILTERS: [
    { value: "free", max: 0 },
    { value: "budget", max: 20 },
  ],
}));

vi.mock("@/lib/cursor", () => ({
  generateNextCursor: vi.fn(() => "mock-cursor"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("GET /api/events", () => {
  const mockEvents = [
    {
      id: 1,
      title: "Test Event 1",
      start_date: "2026-03-01",
      description: "Test description",
      start_time: "19:00",
      end_date: "2026-03-01",
      end_time: "22:00",
      is_all_day: false,
      category: "music",
      subcategory: null,
      category_id: "music",
      subcategory_id: null,
      tags: [],
      genres: [],
      price_min: null,
      price_max: null,
      price_note: null,
      is_free: true,
      source_url: "https://example.com/event1",
      ticket_url: null,
      image_url: null,
      venue: {
        id: 1,
        name: "Test Venue",
        slug: "test-venue",
        address: "123 Main St",
        neighborhood: "Downtown",
        city: "Atlanta",
        state: "GA",
        vibes: [],
        description: null,
        lat: 33.7490,
        lng: -84.3880,
        typical_price_min: null,
        typical_price_max: null,
        venue_type: null,
      },
      category_data: {
        typical_price_min: null,
        typical_price_max: null,
      },
    },
    {
      id: 2,
      title: "Test Event 2",
      start_date: "2026-03-02",
      description: "Another test description",
      start_time: "20:00",
      end_date: "2026-03-02",
      end_time: "23:00",
      is_all_day: false,
      category: "art",
      subcategory: null,
      category_id: "art",
      subcategory_id: null,
      tags: [],
      genres: [],
      price_min: null,
      price_max: null,
      price_note: null,
      is_free: false,
      source_url: "https://example.com/event2",
      ticket_url: null,
      image_url: null,
      venue: {
        id: 2,
        name: "Another Venue",
        slug: "another-venue",
        address: "456 Oak Ave",
        neighborhood: "Midtown",
        city: "Atlanta",
        state: "GA",
        vibes: [],
        description: null,
        lat: 33.7834,
        lng: -84.3831,
        typical_price_min: null,
        typical_price_max: null,
        venue_type: null,
      },
      category_data: {
        typical_price_min: null,
        typical_price_max: null,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rate Limiting", () => {
    it("applies rate limiting with read limit", async () => {
      const { applyRateLimit, getClientIdentifier } = await import("@/lib/rate-limit");
      const mockRequest = new Request("https://example.com/api/events");

      await GET(mockRequest);

      expect(applyRateLimit).toHaveBeenCalledWith(
        mockRequest,
        RATE_LIMITS.read,
        "test-client"
      );
      expect(getClientIdentifier).toHaveBeenCalledWith(mockRequest);
    });

    it("returns rate limit response when rate limit exceeded", async () => {
      const { applyRateLimit } = await import("@/lib/rate-limit");
      const rateLimitResponse = new Response(
        JSON.stringify({ error: "Too many requests" }),
        { status: 429 }
      );
      vi.mocked(applyRateLimit).mockResolvedValueOnce(rateLimitResponse);

      const mockRequest = new Request("https://example.com/api/events");
      const response = await GET(mockRequest);

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toBe("Too many requests");
    });
  });

  describe("Offset-based pagination (legacy)", () => {
    it("returns events with offset pagination when no cursor provided", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 100,
      });

      const mockRequest = new Request("https://example.com/api/events?page=1&pageSize=20");
      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.events).toEqual(mockEvents);
      expect(body.total).toBe(100);
      expect(body.hasMore).toBe(true);
      expect(body.cursor).toBe("mock-cursor");
    });

    it("uses default page and pageSize when not provided", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 10,
      });

      const mockRequest = new Request("https://example.com/api/events");
      await GET(mockRequest);

      expect(getFilteredEventsWithSearch).toHaveBeenCalledWith(
        expect.any(Object),
        1, // default page
        20 // default pageSize
      );
    });

    it("validates and clamps page and pageSize parameters", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 10,
      });

      // Test with excessive values
      const mockRequest = new Request("https://example.com/api/events?page=999&pageSize=9999");
      await GET(mockRequest);

      expect(getFilteredEventsWithSearch).toHaveBeenCalledWith(
        expect.any(Object),
        100, // max page
        500 // max pageSize
      );
    });
  });

  describe("Cursor-based pagination", () => {
    it("uses cursor pagination when cursor provided", async () => {
      const { getFilteredEventsWithCursor } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithCursor).mockResolvedValueOnce({
        events: mockEvents,
        nextCursor: "next-cursor",
        hasMore: true,
      });

      const mockRequest = new Request("https://example.com/api/events?cursor=current-cursor");
      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.events).toEqual(mockEvents);
      expect(body.cursor).toBe("next-cursor");
      expect(body.hasMore).toBe(true);
      expect(getFilteredEventsWithCursor).toHaveBeenCalledWith(
        expect.any(Object),
        "current-cursor",
        20
      );
    });

    it("uses cursor pagination when useCursor=true", async () => {
      const { getFilteredEventsWithCursor } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithCursor).mockResolvedValueOnce({
        events: mockEvents,
        nextCursor: null,
        hasMore: false,
      });

      const mockRequest = new Request("https://example.com/api/events?useCursor=true");
      await GET(mockRequest);

      expect(getFilteredEventsWithCursor).toHaveBeenCalled();
    });
  });

  describe("Filter parameters", () => {
    it("parses and applies search filter", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 10,
      });

      const mockRequest = new Request("https://example.com/api/events?search=concert");
      await GET(mockRequest);

      expect(getFilteredEventsWithSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "concert",
        }),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it("parses category filters as comma-separated values", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 10,
      });

      const mockRequest = new Request("https://example.com/api/events?categories=music,comedy");
      await GET(mockRequest);

      expect(getFilteredEventsWithSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: ["music", "comedy"],
        }),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it("parses price filter correctly", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 10,
      });

      const mockRequest = new Request("https://example.com/api/events?price=free");
      await GET(mockRequest);

      expect(getFilteredEventsWithSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          is_free: true,
        }),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it("parses venue_id as integer", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 10,
      });

      const mockRequest = new Request("https://example.com/api/events?venue=123");
      await GET(mockRequest);

      expect(getFilteredEventsWithSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          venue_id: 123,
        }),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it("parses date filter correctly", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 10,
      });

      const mockRequest = new Request("https://example.com/api/events?date=2026-03-15");
      await GET(mockRequest);

      expect(getFilteredEventsWithSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          date_range_start: "2026-03-15",
          date_range_end: "2026-03-15",
        }),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it("parses map bounds filter", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 10,
      });

      const mockRequest = new Request(
        "https://example.com/api/events?map_bounds=true&sw_lat=33.7&sw_lng=-84.5&ne_lat=33.8&ne_lng=-84.3"
      );
      await GET(mockRequest);

      expect(getFilteredEventsWithSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          geo_bounds: {
            sw_lat: 33.7,
            sw_lng: -84.5,
            ne_lat: 33.8,
            ne_lng: -84.3,
          },
        }),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it("excludes classes by default", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 10,
      });

      const mockRequest = new Request("https://example.com/api/events");
      await GET(mockRequest);

      expect(getFilteredEventsWithSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          exclude_classes: true,
        }),
        expect.any(Number),
        expect.any(Number)
      );
    });
  });

  describe("Response headers", () => {
    it("includes cache control headers", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 10,
      });

      const mockRequest = new Request("https://example.com/api/events");
      const response = await GET(mockRequest);

      expect(response.headers.get("Cache-Control")).toBe(
        "public, s-maxage=30, stale-while-revalidate=60"
      );
    });
  });

  describe("Error handling", () => {
    it("returns 500 on database error", async () => {
      const { getFilteredEventsWithSearch } = await import("@/lib/search");
      const { logger } = await import("@/lib/logger");

      vi.mocked(getFilteredEventsWithSearch).mockRejectedValueOnce(
        new Error("Database connection failed")
      );

      const mockRequest = new Request("https://example.com/api/events");
      const response = await GET(mockRequest);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Failed to fetch events");
      expect(body.events).toEqual([]);
      expect(body.hasMore).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Social proof enrichment", () => {
    it("enriches events with social proof", async () => {
      const { getFilteredEventsWithSearch, enrichEventsWithSocialProof } = await import("@/lib/search");

      vi.mocked(getFilteredEventsWithSearch).mockResolvedValueOnce({
        events: mockEvents,
        total: 10,
      });

      const mockRequest = new Request("https://example.com/api/events");
      await GET(mockRequest);

      expect(enrichEventsWithSocialProof).toHaveBeenCalledWith(mockEvents);
    });
  });
});
