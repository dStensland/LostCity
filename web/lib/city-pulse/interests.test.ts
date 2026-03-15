import { describe, expect, it } from "vitest";
import type { FeedEventData } from "@/components/EventCard";
import type { CityPulseEventItem } from "./types";
import { INTEREST_MAP, getInterestQueryConfig, getServerChipCount } from "./interests";

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
  it("matches participatory sports even when they are categorized as fitness", () => {
    const sportsChip = INTEREST_MAP.get("sports");

    expect(sportsChip?.match(
      makeEvent({
        category: "fitness",
        tags: ["pickup", "pickleball"],
        title: "Friday Pickleball Open Play",
      }),
    )).toBe(true);
  });

  it("uses an or-filter query so sports pulls pickup and watch-party coverage", () => {
    const query = getInterestQueryConfig("sports");

    expect(query).toMatchObject({ type: "or_filter" });
    if (!query || query.type !== "or_filter") {
      throw new Error("Expected sports query config");
    }

    expect(query.filter).toContain("tags.ov.{");
    expect(query.filter).toContain("pickup");
    expect(query.filter).toContain("watch-party");
  });

  it("sums sports signal counts from tags and genres", () => {
    expect(getServerChipCount("sports", {
      "tag:pickup": 2,
      "tag:watch-party": 3,
      "genre:pickleball": 4,
    })).toBe(9);
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
