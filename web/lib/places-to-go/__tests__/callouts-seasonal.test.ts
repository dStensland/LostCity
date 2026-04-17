import { describe, expect, it } from "vitest";
import { buildCallouts } from "../callouts";
import type { PlaceContext } from "../types";

function baseCtx(overrides: Partial<PlaceContext>): PlaceContext {
  return {
    weatherMatchIndoor: false,
    weatherMatchOutdoor: true,
    weatherMatch: true,
    timeOfDayMatch: false,
    seasonMatch: false,
    eventsToday: 0,
    eventsThisWeek: 0,
    hasImage: true,
    hasDescription: true,
    isFeatured: false,
    occasions: null,
    vibes: null,
    cuisine: null,
    neighborhood: "Fairburn",
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
    indoorOutdoor: "outdoor",
    createdDaysAgo: null,
    hasNewEventsThisWeek: false,
    todayEventTitle: null,
    seasonalExhibition: null,
    seasonState: null,
    ...overrides,
  };
}

describe("seasonal callouts", () => {
  it("emits cadence and 'Running through' during active season", () => {
    const ctx = baseCtx({
      seasonalExhibition: {
        id: "1",
        place_id: 1,
        exhibition_type: "seasonal",
        opening_date: "2026-04-11",
        closing_date: "2026-06-08",
        operating_schedule: {
          days: {
            saturday: { open: "10:30", close: "18:00" },
            sunday: { open: "10:30", close: "18:00" },
          },
        },
        title: "Ren Fest",
      },
      seasonState: { status: "active", daysToOpen: null, activeCount: 1 },
    });
    const callouts = buildCallouts("seasonal", ctx);
    expect(callouts[0]).toBe("Sat–Sun 10:30–6");
    expect(callouts[1]).toBe("Running through June 8");
  });

  it("emits 'Final weekend' during last 7 days", () => {
    const ctx = baseCtx({
      seasonalExhibition: {
        id: "1",
        place_id: 1,
        exhibition_type: "seasonal",
        opening_date: "2026-04-11",
        closing_date: "2026-06-08",
        operating_schedule: {
          days: {
            saturday: { open: "10:30", close: "18:00" },
            sunday: { open: "10:30", close: "18:00" },
          },
        },
        title: "Ren Fest",
      },
      seasonState: { status: "active", daysToOpen: null, activeCount: 1 },
    });
    // Mock current date = 2026-06-05 (3 days before closing)
    const callouts = buildCallouts("seasonal", ctx, new Date("2026-06-05"));
    expect(callouts[1]).toBe("Final weekend");
  });

  it("emits 'Opens X' during pre-open window", () => {
    const ctx = baseCtx({
      seasonalExhibition: {
        id: "1",
        place_id: 1,
        exhibition_type: "seasonal",
        opening_date: "2026-04-11",
        closing_date: "2026-06-08",
        operating_schedule: {
          days: {
            saturday: { open: "10:30", close: "18:00" },
            sunday: { open: "10:30", close: "18:00" },
          },
        },
        title: "Ren Fest",
      },
      seasonState: { status: "pre-open", daysToOpen: 22, activeCount: 0 },
    });
    const callouts = buildCallouts("seasonal", ctx, new Date("2026-03-20"));
    expect(callouts[0]).toBe("Sat–Sun 10:30–6");
    expect(callouts[1]).toBe("Opens April 11");
  });

  it("emits '2 seasons running' when activeCount >= 2 (Yule Forest overlap)", () => {
    const ctx = baseCtx({
      seasonalExhibition: {
        id: "xmas",
        place_id: 1,
        exhibition_type: "seasonal",
        opening_date: "2026-11-05",
        closing_date: "2026-12-24",
        operating_schedule: {
          days: {
            friday: { open: "10:00", close: "18:00" },
            saturday: { open: "10:00", close: "18:00" },
            sunday: { open: "10:00", close: "18:00" },
          },
        },
        title: "Christmas Tree",
      },
      seasonState: { status: "active", daysToOpen: null, activeCount: 2 },
    });
    const callouts = buildCallouts("seasonal", ctx, new Date("2026-11-08"));
    // Third callout signals multi-season
    expect(callouts[2]).toBe("+1 more season running");
  });
});
