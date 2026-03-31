import { describe, it, expect } from "vitest";
import { buildCallouts, buildSummary } from "./callouts";
import type { PlaceContext } from "./types";

function makeContext(overrides: Partial<PlaceContext> = {}): PlaceContext {
  return {
    weatherMatchIndoor: false,
    weatherMatchOutdoor: false,
    weatherMatch: false,
    timeOfDayMatch: false,
    seasonMatch: false,
    eventsToday: 0,
    eventsThisWeek: 0,
    hasImage: false,
    hasDescription: false,
    isFeatured: false,
    occasions: null,
    vibes: null,
    cuisine: null,
    neighborhood: null,
    nearestMarta: null,
    difficulty: null,
    driveTimeMinutes: null,
    bestSeasons: null,
    weatherFitTags: null,
    shortDescription: null,
    libraryPass: null,
    isNew: false,
    hasActiveSpecial: false,
    specialTitle: null,
    specialTimeEnd: null,
    indoorOutdoor: null,
    createdDaysAgo: null,
    hasNewEventsThisWeek: false,
    todayEventTitle: null,
    ...overrides,
  };
}

describe("buildCallouts", () => {
  it("returns time-sensitive callout first for parks when weatherMatch=true", () => {
    const ctx = makeContext({ weatherMatch: true });
    const result = buildCallouts("parks_gardens", ctx);
    expect(result[0]).toBe("Great weather today");
  });

  it("falls through to activity when no time-sensitive match (eventsThisWeek=3)", () => {
    const ctx = makeContext({ weatherMatch: false, eventsThisWeek: 3 });
    const result = buildCallouts("parks_gardens", ctx);
    expect(result).toContain("3 events this week");
  });

  it("falls through to static when no time-sensitive or activity match (dog_friendly)", () => {
    const ctx = makeContext({ occasions: ["dog_friendly"] });
    const result = buildCallouts("parks_gardens", ctx);
    expect(result).toContain("Dog-friendly");
  });

  it("returns at most 2 callouts", () => {
    // weatherMatch (time-sensitive) + eventsThisWeek (activity) + dog_friendly (static)
    const ctx = makeContext({
      weatherMatch: true,
      eventsThisWeek: 5,
      occasions: ["dog_friendly"],
    });
    const result = buildCallouts("parks_gardens", ctx);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("returns tonight event title for theaters when eventsToday=1 and todayEventTitle set", () => {
    const ctx = makeContext({ eventsToday: 1, todayEventTitle: "Hamilton" });
    const result = buildCallouts("theaters_stage", ctx);
    expect(result[0]).toBe("Tonight: Hamilton");
  });

  it("truncates long tonight titles to 30 chars", () => {
    const ctx = makeContext({
      eventsToday: 1,
      todayEventTitle: "A Very Long Show Title That Should Be Truncated Here",
    });
    const result = buildCallouts("theaters_stage", ctx);
    expect(result[0]).toMatch(/^Tonight: .{1,30}$/);
  });

  it("returns capitalized vibe for music venues", () => {
    const ctx = makeContext({ vibes: ["divey", "intimate"] });
    const result = buildCallouts("music_venues", ctx);
    expect(result).toContain("Divey");
  });

  it("returns capitalized first cuisine for restaurants", () => {
    const ctx = makeContext({ cuisine: "southern,bbq" });
    const result = buildCallouts("restaurants", ctx);
    expect(result).toContain("Southern");
  });

  it("returns difficulty and drive time for trails", () => {
    const ctx = makeContext({ difficulty: "moderate", driveTimeMinutes: 45 });
    const result = buildCallouts("trails_nature", ctx);
    expect(result).toContain("Moderate");
    expect(result).toContain("45 min drive");
  });

  it("every category key works without throwing", () => {
    const categories = [
      "parks_gardens",
      "trails_nature",
      "museums",
      "galleries_studios",
      "theaters_stage",
      "music_venues",
      "restaurants",
      "bars_nightlife",
      "markets_local",
      "libraries_learning",
      "fun_games",
      "historic_sites",
    ];
    const ctx = makeContext();
    for (const cat of categories) {
      expect(() => buildCallouts(cat, ctx)).not.toThrow();
    }
  });

  it("returns empty array for unknown category key", () => {
    const ctx = makeContext();
    const result = buildCallouts("nonexistent_category", ctx);
    expect(result).toEqual([]);
  });
});

describe("buildSummary", () => {
  it("returns weather-match summary for parks when weatherMatchCount > 0", () => {
    const result = buildSummary("parks_gardens", { weatherMatchCount: 8, totalCount: 20 });
    expect(result).toBe("8 match today's weather");
  });

  it("falls back to activity stat when no weather match", () => {
    const result = buildSummary("parks_gardens", {
      weatherMatchCount: 0,
      eventsThisWeekCount: 4,
      totalCount: 20,
    });
    expect(result).toBe("4 with events this week");
  });

  it("falls back to static (dog-friendly count) when no weather or activity", () => {
    const result = buildSummary("parks_gardens", {
      weatherMatchCount: 0,
      eventsThisWeekCount: 0,
      dogFriendlyCount: 6,
      totalCount: 20,
    });
    expect(result).toBe("6 dog-friendly");
  });

  it("falls back to totalCount when no stat matches", () => {
    const result = buildSummary("parks_gardens", { totalCount: 12 });
    expect(result).toBe("12 places");
  });

  it("returns acts tonight for music venues when actsTonight > 0", () => {
    const result = buildSummary("music_venues", { actsTonight: 5, totalCount: 30 });
    expect(result).toBe("5 acts tonight");
  });

  it("returns happy hour now for restaurants", () => {
    const result = buildSummary("restaurants", { happyHourNow: 3, totalCount: 50 });
    expect(result).toBe("3 with happy hour now");
  });

  it("returns programs this week for libraries_learning", () => {
    const result = buildSummary("libraries_learning", {
      programsThisWeek: 7,
      totalCount: 10,
    });
    expect(result).toBe("7 free programs this week");
  });

  it("returns family-friendly fallback for fun_games when eventsThisWeek=0", () => {
    const result = buildSummary("fun_games", { eventsThisWeek: 0, familyCount: 4, totalCount: 10 });
    expect(result).toBe("Family-friendly: 4");
  });

  it("every category key works without throwing", () => {
    const categories = [
      "parks_gardens",
      "trails_nature",
      "museums",
      "galleries_studios",
      "theaters_stage",
      "music_venues",
      "restaurants",
      "bars_nightlife",
      "markets_local",
      "libraries_learning",
      "fun_games",
      "historic_sites",
    ];
    for (const cat of categories) {
      expect(() => buildSummary(cat, { totalCount: 5 })).not.toThrow();
      expect(typeof buildSummary(cat, { totalCount: 5 })).toBe("string");
    }
  });

  it("handles unknown category key with generic fallback", () => {
    const result = buildSummary("nonexistent_category", { totalCount: 3 });
    expect(typeof result).toBe("string");
  });
});
