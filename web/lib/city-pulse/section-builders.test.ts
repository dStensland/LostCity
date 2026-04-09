import { describe, expect, it } from "vitest";
import type { FeedEventData } from "@/components/EventCard";
import { buildPlanningHorizonSection, matchActivityType } from "./section-builders";

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function makeEvent(overrides: Partial<FeedEventData> = {}): FeedEventData {
  return {
    id: 1,
    title: "Event",
    start_date: daysFromNow(10),
    start_time: "18:00",
    end_date: null,
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

describe("buildPlanningHorizonSection", () => {
  it("includes festival-like events without festival_id when the title and timing support it", () => {
    const festivalLike = makeEvent({
      id: 101,
      title: "Atlanta Jazz Festival",
      category: "music",
      start_date: daysFromNow(21),
      end_date: daysFromNow(23),
      image_url: null,
      venue: {
        id: 1,
        name: "Piedmont Park",
        slug: "piedmont-park",
        neighborhood: "Midtown",
        image_url: "https://example.com/piedmont.jpg",
      },
    });
    const companion = makeEvent({
      id: 102,
      title: "Shaky Knees Music Festival",
      category: "music",
      start_date: daysFromNow(35),
      end_date: daysFromNow(37),
      image_url: "https://example.com/shaky.jpg",
    });

    const section = buildPlanningHorizonSection([festivalLike, companion]);

    expect(section).not.toBeNull();
    const events = section?.items
      .filter((item) => item.item_type === "event")
      .map((item) => item.event) ?? [];
    const restoredImageEvent = events.find((event) => event.id === 101);
    expect(events.map((event) => event.id)).toContain(101);
    expect(restoredImageEvent?.image_url).toBe("https://example.com/piedmont.jpg");
  });

  it("keeps far-future explicit festivals even when the feed row has no description", () => {
    const dragonCon = makeEvent({
      id: 201,
      title: "Dragon Con",
      category: "other",
      start_date: daysFromNow(140),
      end_date: daysFromNow(144),
      festival_id: "dragon-con",
      image_url: "https://example.com/dragon-con.jpg",
      description: null,
      featured_blurb: null,
    });
    const pride = makeEvent({
      id: 202,
      title: "Atlanta Pride Festival",
      category: "other",
      start_date: daysFromNow(155),
      end_date: daysFromNow(157),
      festival_id: "atlanta-pride",
      image_url: "https://example.com/pride.jpg",
      description: null,
      featured_blurb: null,
    });

    const section = buildPlanningHorizonSection([dragonCon, pride]);

    expect(section).not.toBeNull();
    const eventIds = section?.items
      .filter((item) => item.item_type === "event")
      .map((item) => item.event.id) ?? [];
    expect(eventIds).toContain(201);
    expect(eventIds).toContain(202);
  });

  it("prioritizes canonical tiered targets ahead of generic fallback noise", () => {
    const genericFest = makeEvent({
      id: 301,
      title: "Bug Fest 2026",
      start_date: daysFromNow(14),
      end_date: daysFromNow(14),
      image_url: "https://example.com/bugfest.jpg",
      description: "A generic fair-like title that should not outrank canonical targets.",
      importance: "major",
    });
    const tierB = makeEvent({
      id: 302,
      title: "JapanFest Atlanta",
      start_date: daysFromNow(40),
      end_date: daysFromNow(41),
      image_url: "https://example.com/japanfest.jpg",
      canonical_key: "japanfest-atlanta",
      canonical_tier: "tier_b",
      entity_type: "festival",
      importance: "major",
      festival_id: "japanfest-atlanta",
    });
    const tierA = makeEvent({
      id: 303,
      title: "MomoCon 2026 Convention Schedule",
      start_date: daysFromNow(55),
      end_date: daysFromNow(58),
      image_url: "https://example.com/momocon.jpg",
      canonical_key: "momocon",
      canonical_tier: "tier_a",
      entity_type: "event",
      importance: "flagship",
    });

    const section = buildPlanningHorizonSection([genericFest, tierB, tierA]);

    const orderedIds = section?.items
      .filter((item) => item.item_type === "event")
      .map((item) => item.event.id) ?? [];
    expect(orderedIds.slice(0, 3)).toEqual([303, 302, 301]);
  });

  it("dedupes canonical festival targets before title and festival heuristics", () => {
    const festivalContainer = makeEvent({
      id: 401,
      title: "Atlanta Film Festival 2026",
      start_date: daysFromNow(25),
      end_date: daysFromNow(35),
      image_url: "https://example.com/atlff.jpg",
      festival_id: "atlanta-film-festival",
      canonical_key: "atlanta-film-festival",
      canonical_tier: "tier_a",
      entity_type: "festival",
      importance: "flagship",
    });
    const scheduleRow = makeEvent({
      id: 402,
      title: "Atlanta Film Festival 2026 Schedule",
      start_date: daysFromNow(25),
      end_date: daysFromNow(35),
      image_url: "https://example.com/atlff-schedule.jpg",
      canonical_key: "atlanta-film-festival",
      canonical_tier: "tier_a",
      entity_type: "event",
      importance: "flagship",
    });
    const companion = makeEvent({
      id: 403,
      title: "Atlanta Jazz Festival",
      start_date: daysFromNow(45),
      end_date: daysFromNow(47),
      image_url: "https://example.com/jazzfest.jpg",
      canonical_key: "atlanta-jazz-festival",
      canonical_tier: "tier_a",
      entity_type: "festival",
      festival_id: "atlanta-jazz-festival",
      importance: "flagship",
    });

    const section = buildPlanningHorizonSection([festivalContainer, scheduleRow, companion]);

    const eventIds = section?.items
      .filter((item) => item.item_type === "event")
      .map((item) => item.event.id) ?? [];
    expect(eventIds).toContain(402);
    expect(eventIds).not.toContain(401);
    expect(eventIds).toContain(403);
  });

  it("prefers the richer canonical event row over a synthetic festival duplicate", () => {
    const syntheticFestival = makeEvent({
      id: 501,
      title: "SweetWater 420 Fest 2026",
      start_date: daysFromNow(20),
      end_date: daysFromNow(22),
      image_url: "https://example.com/sweetwater-festival.jpg",
      canonical_key: "sweetwater-420-fest",
      canonical_tier: "tier_a",
      entity_type: "festival",
      importance: "flagship",
    });
    const canonicalEvent = makeEvent({
      id: 502,
      title: "SweetWater 420 Fest 2026",
      start_date: daysFromNow(21),
      end_date: daysFromNow(23),
      image_url: "https://example.com/sweetwater-event.jpg",
      description: "The official annual container row with the richer event copy and routing metadata.",
      canonical_key: "sweetwater-420-fest",
      canonical_tier: "tier_a",
      entity_type: "event",
      importance: "flagship",
      is_tentpole: true,
    });
    const companion = makeEvent({
      id: 503,
      title: "Atlanta Jazz Festival",
      start_date: daysFromNow(45),
      end_date: daysFromNow(47),
      image_url: "https://example.com/jazzfest.jpg",
      canonical_key: "atlanta-jazz-festival",
      canonical_tier: "tier_a",
      entity_type: "festival",
      festival_id: "atlanta-jazz-festival",
      importance: "flagship",
    });

    const section = buildPlanningHorizonSection([syntheticFestival, canonicalEvent, companion]);

    const eventIds = section?.items
      .filter((item) => item.item_type === "event")
      .map((item) => item.event.id) ?? [];
    expect(eventIds).toContain(502);
    expect(eventIds).not.toContain(501);
  });
});
