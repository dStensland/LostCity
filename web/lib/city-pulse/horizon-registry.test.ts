import { describe, expect, it } from "vitest";
import type { FeedEventData } from "@/components/EventCard";
import {
  annotateCanonicalHorizonEvent,
  buildSyntheticFestivalHorizonEvent,
  resolveCanonicalHorizonTarget,
  type HorizonFestivalRow,
} from "./horizon-registry";

function makeEvent(overrides: Partial<FeedEventData> = {}): FeedEventData {
  return {
    id: 1,
    title: "Event",
    start_date: "2026-05-10",
    start_time: "18:00",
    end_date: null,
    end_time: null,
    is_all_day: false,
    is_free: false,
    price_min: null,
    price_max: null,
    category: "other",
    image_url: "https://example.com/event.jpg",
    venue: null,
    ...overrides,
  };
}

describe("horizon registry matching", () => {
  it("matches explicit festival ids before other signals", () => {
    const target = resolveCanonicalHorizonTarget(
      {
        festival_id: "japanfest-atlanta",
        title: "Completely Different Title",
        source_slug: null,
      },
      "atlanta",
    );

    expect(target?.canonical_key).toBe("japanfest-atlanta");
  });

  it("matches canonical sources when the title is not festival-like", () => {
    const event = annotateCanonicalHorizonEvent(
      makeEvent({
        title: "MomoCon 2026 Convention Schedule",
        source_slug: "momocon",
        importance: "standard",
      }),
      "atlanta",
    );

    expect(event.canonical_key).toBe("momocon");
    expect(event.canonical_tier).toBe("tier_a");
    expect(event.importance).toBe("flagship");
    expect(event.is_tentpole).toBe(true);
  });

  it("matches aliases from the title when no festival or source slug is present", () => {
    const target = resolveCanonicalHorizonTarget(
      {
        festival_id: null,
        title: "National Black Arts Festival 2026",
        source_slug: null,
      },
      "atlanta",
    );

    expect(target?.canonical_key).toBe("national-black-arts-festival");
  });
});

describe("synthetic festival horizon events", () => {
  it("normalizes a festival row into an event-shaped horizon candidate", () => {
    const festival: HorizonFestivalRow = {
      id: "japanfest-atlanta",
      name: "JapanFest Atlanta",
      slug: "japanfest-atlanta",
      description: "A major Japanese cultural festival in metro Atlanta.",
      image_url: "https://example.com/japanfest.jpg",
      website: "https://www.japanfest.org",
      announced_start: "2026-09-19",
      announced_end: "2026-09-20",
      pending_start: null,
      pending_end: null,
      free: false,
      primary_type: "community",
      categories: ["community", "festival"],
      genres: ["cultural"],
      neighborhood: "Duluth",
      location: "Gas South Convention Center",
    };

    const event = buildSyntheticFestivalHorizonEvent(festival, "atlanta");

    expect(event).not.toBeNull();
    expect(event?.festival_id).toBe("japanfest-atlanta");
    expect(event?.entity_type).toBe("festival");
    expect(event?.canonical_key).toBe("japanfest-atlanta");
    expect(event?.canonical_tier).toBe("tier_b");
    expect(event?.importance).toBe("major");
    expect(event?.venue?.name).toBe("Gas South Convention Center");
  });
});
