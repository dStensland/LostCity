import { describe, expect, it, vi } from "vitest";
import {
  buildPortalNightlifeCarouselData,
  classifyPortalNightlifeActivity,
  mergePortalMixedSectionEvents,
  selectPortalAutoSectionEvents,
  type PortalAutoSectionEvent,
} from "@/lib/portal-auto-section";

const pool: PortalAutoSectionEvent[] = [
  {
    id: 1,
    title: "Trivia at the Bar",
    start_date: "2026-03-09",
    start_time: "18:00",
    is_free: true,
    price_min: null,
    category: "community",
    genres: ["trivia"],
    tags: ["weekly"],
    source_id: 10,
    venue: { id: 100, neighborhood: "Old Fourth Ward", venue_type: "bar" },
  },
  {
    id: 2,
    title: "Late DJ Set",
    start_date: "2026-03-10",
    start_time: "21:00",
    is_free: false,
    price_min: 15,
    category: "nightlife",
    genres: ["dj"],
    tags: ["dance"],
    source_id: 11,
    venue: { id: 101, neighborhood: "Downtown", venue_type: "nightclub" },
  },
  {
    id: 3,
    title: "Comedy at the Theater",
    start_date: "2026-03-12",
    start_time: "19:30",
    is_free: false,
    price_min: 20,
    category: "comedy",
    genres: null,
    tags: ["headline"],
    source_id: 12,
    venue: { id: 102, neighborhood: "Midtown", venue_type: "theater" },
  },
  {
    id: 4,
    title: "Gallery Opening",
    start_date: "2026-03-16",
    start_time: "18:00",
    is_free: true,
    price_min: null,
    category: "arts",
    genres: null,
    tags: ["opening"],
    source_id: 13,
    venue: { id: 103, neighborhood: "Westside", venue_type: "gallery" },
  },
];

describe("portal-auto-section", () => {
  it("filters and sorts nightlife-mode sections with tiered nightlife logic", () => {
    const result = selectPortalAutoSectionEvents({
      pool,
      filter: {
        nightlife_mode: true,
        sort_by: "date",
      },
      limit: 10,
      currentDate: new Date("2026-03-09T12:00:00Z"),
      rsvpCounts: {},
      resolveDateRange: () => ({ start: "2026-03-09", end: "2026-03-30" }),
    });

    expect(result.events.map((event) => event.id)).toEqual([2, 3, 1]);
    expect(result.fullFilteredPool?.map((event) => event.id)).toEqual([2, 3, 1]);
  });

  it("distributes larger sections across date buckets instead of monopolizing today", () => {
    const events = Array.from({ length: 9 }, (_, index) => ({
      id: index + 1,
      title: `Event ${index + 1}`,
      start_date:
        index < 6
          ? "2026-03-09"
          : index < 8
            ? "2026-03-12"
            : "2026-03-18",
      start_time: "18:00",
      is_free: true,
      price_min: null,
      category: "arts",
      venue: { id: index + 1, neighborhood: "Midtown", venue_type: "gallery" },
    }));

    const result = selectPortalAutoSectionEvents({
      pool: events,
      filter: {},
      limit: 8,
      currentDate: new Date("2026-03-09T12:00:00Z"),
      rsvpCounts: {},
      resolveDateRange: () => ({ start: "2026-03-09", end: "2026-03-30" }),
    });

    expect(result.events.map((event) => event.id)).toEqual([1, 2, 3, 4, 7, 8, 9, 5]);
  });

  it("merges curated mixed-section events first and de-dupes auto events", () => {
    expect(
      mergePortalMixedSectionEvents(pool.slice(0, 2), [pool[1], pool[2], pool[3]], 4).map(
        (event) => event.id,
      ),
    ).toEqual([1, 2, 3, 4]);
  });

  it("builds nightlife carousel metadata and activity labels", () => {
    expect(classifyPortalNightlifeActivity(pool[0])).toBe("trivia");
    expect(classifyPortalNightlifeActivity(pool[2])).toBe("comedy");

    const result = buildPortalNightlifeCarouselData([pool[0], pool[1], pool[2]]);
    expect(result.categories).toEqual([
      { id: "trivia", label: "Trivia", count: 1 },
      { id: "dj", label: "DJ Night", count: 1 },
      { id: "comedy", label: "Freakin Clowns", count: 1 },
    ]);
    expect(result.stampedEvents.map((event) => event.activity_type)).toEqual([
      "trivia",
      "dj",
      "comedy",
    ]);
  });

  it("applies popularity sorting using RSVP counts", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    try {
      const result = selectPortalAutoSectionEvents({
        pool,
        filter: { sort_by: "popularity" },
        limit: 3,
        currentDate: new Date("2026-03-09T12:00:00Z"),
        rsvpCounts: { 1: 2, 2: 10, 3: 5, 4: 1 },
        resolveDateRange: () => ({ start: "2026-03-09", end: "2026-03-30" }),
      });

      expect(result.events.map((event) => event.id)).toEqual([2, 3, 1]);
    } finally {
      randomSpy.mockRestore();
    }
  });
});
