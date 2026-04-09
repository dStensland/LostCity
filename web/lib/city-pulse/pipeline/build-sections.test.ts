import { describe, expect, it } from "vitest";
import type { FeedEventData } from "@/components/EventCard";
import { buildSections } from "./build-sections";

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function makeHorizonEvent(id: number, overrides: Partial<FeedEventData> = {}): FeedEventData {
  return {
    id,
    title: `Event ${id}`,
    start_date: daysFromNow(14 + id),
    start_time: "19:00",
    end_date: daysFromNow(16 + id),
    end_time: null,
    is_all_day: false,
    is_free: false,
    price_min: null,
    price_max: null,
    category: "music",
    tags: ["festival"],
    genres: ["music"],
    image_url: `https://example.com/${id}.jpg`,
    description: "A major Atlanta event with enough detail to survive horizon quality gates.",
    venue: {
      id,
      name: `Venue ${id}`,
      slug: `venue-${id}`,
      neighborhood: "Midtown",
      image_url: `https://example.com/venue-${id}.jpg`,
    },
    importance: "flagship",
    ...overrides,
  } as FeedEventData;
}

describe("buildSections", () => {
  it("emits planning_horizon when the horizon pool contains valid canonical targets", () => {
    const tierA = makeHorizonEvent(1, {
      title: "SweetWater 420 Fest 2026",
      canonical_key: "sweetwater-420-fest",
      canonical_tier: "tier_a",
      entity_type: "event",
      is_tentpole: true,
    });
    const tierB = makeHorizonEvent(2, {
      title: "JapanFest Atlanta 2026",
      canonical_key: "japanfest-atlanta",
      canonical_tier: "tier_b",
      entity_type: "festival",
      festival_id: "japanfest-atlanta",
      importance: "major",
    });

    const result = buildSections(
      {
        canonicalSlug: "atlanta",
        userId: null,
        feedContext: {
          time_slot: "morning",
          day_of_week: "monday",
          quick_links: [],
          weather: null,
          active_holidays: [],
          active_festivals: [],
        },
        manifest: {
          contentPolicy: {
            suppressedSections: new Set(),
          },
        },
      } as never,
      {
        todayEvents: [],
        trendingEvents: [],
        horizonEvents: [tierA, tierB],
      },
      {
        activeSpecials: [],
        rawCuratedSections: [],
        weatherVenues: [],
        weatherFilter: null,
        userSignals: null,
      } as never,
      {
        socialCounts: new Map(),
        friendsGoingMap: {},
        newFromSpots: [],
        editorialMap: {},
      } as never,
      {},
      {},
    );

    const planningHorizon = result.sections.find((section) => section.type === "planning_horizon");
    expect(planningHorizon).toBeTruthy();
    expect(planningHorizon?.items).toHaveLength(2);
  });
});
