import { describe, it, expect } from "vitest";
import { scorePlaceForCategory, passesQualityGate } from "./scoring";
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

describe("scorePlaceForCategory", () => {
  it("base quality score: image (8) + description (5) = 13", () => {
    const ctx = makeContext({ hasImage: true, hasDescription: true });
    expect(scorePlaceForCategory(ctx)).toBe(13);
  });

  it("weather match adds 20: base 13 + 20 = 33", () => {
    const ctx = makeContext({ hasImage: true, hasDescription: true, weatherMatch: true });
    expect(scorePlaceForCategory(ctx)).toBe(33);
  });

  it("events today caps at 30: eventsToday=5 gives 75 uncapped → capped to 30, total = 43", () => {
    const ctx = makeContext({ hasImage: true, hasDescription: true, eventsToday: 5 });
    expect(scorePlaceForCategory(ctx)).toBe(43);
  });

  it("events this week caps at 20: eventsThisWeek=10 gives 50 uncapped → within 30 activity cap → total = 33", () => {
    const ctx = makeContext({ hasImage: true, hasDescription: true, eventsThisWeek: 10 });
    expect(scorePlaceForCategory(ctx)).toBe(33);
  });

  it("active specials adds 10: base 13 + 10 = 23", () => {
    const ctx = makeContext({ hasImage: true, hasDescription: true, hasActiveSpecial: true });
    expect(scorePlaceForCategory(ctx)).toBe(23);
  });

  it("featured flag adds 5: base 13 + 5 = 18", () => {
    const ctx = makeContext({ hasImage: true, hasDescription: true, isFeatured: true });
    expect(scorePlaceForCategory(ctx)).toBe(18);
  });

  it("occasion count >= 3 adds 2: base 13 + 2 = 15", () => {
    const ctx = makeContext({
      hasImage: true,
      hasDescription: true,
      occasions: ["brunch", "date_night", "birthday"],
    });
    expect(scorePlaceForCategory(ctx)).toBe(15);
  });

  it("new place (< 30 days) adds 10: base 13 + 10 = 23", () => {
    const ctx = makeContext({
      hasImage: true,
      hasDescription: true,
      isNew: true,
      createdDaysAgo: 15,
    });
    expect(scorePlaceForCategory(ctx)).toBe(23);
  });

  it("30-90 day old place adds 5: base 13 + 5 = 18", () => {
    const ctx = makeContext({
      hasImage: true,
      hasDescription: true,
      isNew: false,
      createdDaysAgo: 60,
    });
    expect(scorePlaceForCategory(ctx)).toBe(18);
  });

  it("combines all dimensions for a total of 100", () => {
    // Contextual: weatherMatch(20) + timeOfDayMatch(10) + seasonMatch(10) = 40
    // Activity: eventsToday(1)*15 + eventsThisWeek(2)*5 + hasActiveSpecial(10) = 15+10+10=35, capped at 30
    // Quality: hasImage(8) + hasDescription(5) + isFeatured(5) + 3 occasions(2) = 20
    // Recency: isNew(10) + hasNewEventsThisWeek(3) = 13, capped at 10
    // Total: 40 + 30 + 20 + 10 = 100
    const ctx = makeContext({
      weatherMatch: true,
      timeOfDayMatch: true,
      seasonMatch: true,
      eventsToday: 1,
      eventsThisWeek: 2,
      hasActiveSpecial: true,
      hasImage: true,
      hasDescription: true,
      isFeatured: true,
      occasions: ["brunch", "date_night", "birthday"],
      isNew: true,
      createdDaysAgo: 10,
      hasNewEventsThisWeek: true,
    });
    expect(scorePlaceForCategory(ctx)).toBe(100);
  });
});

describe("passesQualityGate", () => {
  it("passes with image only (no description)", () => {
    const ctx = makeContext({ hasImage: true, hasDescription: false });
    expect(passesQualityGate(ctx)).toBe(true);
  });

  it("passes with description only (no image)", () => {
    const ctx = makeContext({ hasImage: false, hasDescription: true });
    expect(passesQualityGate(ctx)).toBe(true);
  });

  it("fails with neither image nor description", () => {
    const ctx = makeContext({ hasImage: false, hasDescription: false });
    expect(passesQualityGate(ctx)).toBe(false);
  });
});
