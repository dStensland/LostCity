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
