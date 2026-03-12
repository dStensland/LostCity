import { describe, expect, it } from "vitest";
import type { FeedEventData } from "@/components/EventCard";
import { matchActivityType } from "./section-builders";

function makeEvent(overrides: Partial<FeedEventData> = {}): FeedEventData {
  return {
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
  };
}

describe("matchActivityType", () => {
  it("classifies pickup and open-play sports as sports instead of generic fitness", () => {
    expect(matchActivityType(makeEvent({
      category: "fitness",
      tags: ["pickup", "pickleball"],
      title: "Friday Pickleball Open Play",
    }))).toBe("sports");
  });

  it("uses title fallback for rec league style sports with sparse metadata", () => {
    expect(matchActivityType(makeEvent({
      category: "fitness",
      title: "Wednesday Rec League Softball",
    }))).toBe("sports");
  });

  it("keeps non-sports fitness events in fitness", () => {
    expect(matchActivityType(makeEvent({
      category: "fitness",
      tags: ["yoga"],
      title: "Sunrise Yoga in the Park",
    }))).toBe("fitness");
  });
});
