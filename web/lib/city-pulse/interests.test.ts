import { describe, expect, it } from "vitest";
import type { FeedEventData } from "@/components/EventCard";
import type { CityPulseEventItem } from "./types";
import { INTEREST_MAP, getInterestQueryConfig, getServerChipCount } from "./interests";
import { SPECTATOR_SPORTS_GENRES } from "./sports-signals";

function makeEvent(
  overrides: Partial<FeedEventData> = {},
): CityPulseEventItem {
  return {
    item_type: "event",
    event: {
      id: 1,
      title: "Event",
      start_date: "2026-03-09",
      start_time: "18:00",
      is_all_day: false,
      is_free: true,
      price_min: null,
      price_max: null,
      category: "community",
      tags: [],
      genres: [],
      image_url: null,
      description: null,
      venue: null,
      ...overrides,
    },
  };
}

describe("sports interest chip", () => {
  it("matches spectator sports genres (watch party, viewing party, pro sports)", () => {
    const sportsChip = INTEREST_MAP.get("sports");

    expect(sportsChip?.match(
      makeEvent({
        category: "sports",
        genres: ["watch-party"],
        title: "Sunday Watch Party at the Bar",
      }),
    )).toBe(true);

    expect(sportsChip?.match(
      makeEvent({
        category: "nightlife",
        genres: ["viewing-party"],
        title: "NFL Viewing Party",
      }),
    )).toBe(true);
  });

  it("does not match participatory sports (pickup/pickleball belong to recreation chip)", () => {
    const sportsChip = INTEREST_MAP.get("sports");

    expect(sportsChip?.match(
      makeEvent({
        category: "recreation",
        tags: ["pickup", "pickleball"],
        title: "Friday Pickleball Open Play",
      }),
    )).toBe(false);
  });

  it("uses an or-filter query so sports pulls spectator genre coverage", () => {
    const query = getInterestQueryConfig("sports");

    expect(query).toMatchObject({ type: "or_filter" });
    if (!query || query.type !== "or_filter") {
      throw new Error("Expected sports query config");
    }

    expect(query.filter).toContain("tags.ov.{");
    // Spectator genres are present
    expect(query.filter).toContain("watch-party");
    expect(query.filter).toContain("viewing-party");
    // pickup is a recreation signal, not in the sports or-filter
    expect(SPECTATOR_SPORTS_GENRES).not.toContain("pickup");
  });

  it("sums sports signal counts from spectator genres only", () => {
    expect(getServerChipCount("sports", {
      "tag:watch-party": 3,
      "genre:viewing-party": 4,
      "genre:football": 5,
    })).toBe(12);
  });
});

describe("recreation interest chip", () => {
  it("matches pickup and pickleball tags via recreation signal genres", () => {
    const recreationChip = INTEREST_MAP.get("recreation");

    expect(recreationChip?.match(
      makeEvent({
        category: "recreation",
        tags: ["pickup", "pickleball"],
        title: "Friday Pickleball Open Play",
      }),
    )).toBe(true);
  });

  it("matches open-gym via recreation signal genres", () => {
    const recreationChip = INTEREST_MAP.get("recreation");

    expect(recreationChip?.match(
      makeEvent({
        category: "sports",
        tags: ["open-gym", "basketball"],
        title: "Rec Center Open Gym",
      }),
    )).toBe(true);
  });
});

describe("exercise interest chip", () => {
  it("matches event with category exercise", () => {
    const exerciseChip = INTEREST_MAP.get("exercise");

    expect(exerciseChip?.match(
      makeEvent({
        category: "exercise",
        title: "Morning Yoga Flow",
      }),
    )).toBe(true);
  });

  it("backward compat: category fitness also matches exercise chip", () => {
    const exerciseChip = INTEREST_MAP.get("exercise");

    expect(exerciseChip?.match(
      makeEvent({
        category: "fitness",
        title: "Sunrise Yoga in the Park",
      }),
    )).toBe(true);
  });
});

describe("derived interest chips", () => {
  it("matches dance from live genres instead of a dead category", () => {
    const danceChip = INTEREST_MAP.get("dance");

    expect(danceChip?.match(
      makeEvent({
        category: "nightlife",
        genres: ["salsa-night"],
        title: "Friday Salsa Social",
      }),
    )).toBe(true);
  });

  it("matches markets from market-like genres instead of a dead category", () => {
    const marketsChip = INTEREST_MAP.get("markets");

    expect(marketsChip?.match(
      makeEvent({
        category: "community",
        genres: ["farmers-market"],
        title: "Sunday Farmers Market",
      }),
    )).toBe(true);
  });

  it("matches gaming from live genres instead of a dead category", () => {
    const gamingChip = INTEREST_MAP.get("gaming");

    expect(gamingChip?.match(
      makeEvent({
        category: "community",
        tags: ["board-games"],
        title: "Board Game Night",
      }),
    )).toBe(true);
  });

  it("builds OR-filter queries for derived chips", () => {
    const danceQuery = getInterestQueryConfig("dance");
    const marketsQuery = getInterestQueryConfig("markets");
    const gamingQuery = getInterestQueryConfig("gaming");

    expect(danceQuery).toMatchObject({ type: "or_filter" });
    expect(marketsQuery).toMatchObject({ type: "or_filter" });
    expect(gamingQuery).toMatchObject({ type: "or_filter" });
  });

  it("sums derived chip counts from tags and genres", () => {
    expect(getServerChipCount("dance", {
      "tag:dance-party": 2,
      "genre:salsa-night": 3,
    })).toBe(5);

    expect(getServerChipCount("markets", {
      "tag:market": 1,
      "genre:farmers-market": 4,
    })).toBe(5);

    expect(getServerChipCount("gaming", {
      "tag:board-games": 2,
      "genre:arcade": 3,
    })).toBe(5);
  });
});
