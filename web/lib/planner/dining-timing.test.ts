import { describe, expect, it } from "vitest";

import {
  calculatePreShowDiningTiming,
  inferServiceStyleFromVenueType,
  parseTimeToMinutes,
  resolveDiningTimingAssumptions,
} from "./dining-timing";

describe("dining timing", () => {
  it("parses HH:MM and HH:MM:SS values", () => {
    expect(parseTimeToMinutes("20:00")).toBe(1200);
    expect(parseTimeToMinutes("08:15:00")).toBe(495);
    expect(parseTimeToMinutes("25:00")).toBeNull();
  });

  it("infers service style from venue type", () => {
    expect(inferServiceStyleFromVenueType("food_hall")).toBe("quick_service");
    expect(inferServiceStyleFromVenueType("restaurant")).toBe("casual_dine_in");
    expect(inferServiceStyleFromVenueType("unknown_type")).toBeNull();
  });

  it("calculates conservative latest seat/leave windows", () => {
    const result = calculatePreShowDiningTiming({
      eventStartTime: "20:00",
      travelToVenueMinutes: 15,
      venueEntryBufferMinutes: 20,
      nowTime: "16:30",
      profile: {
        service_style: "full_service",
      },
    });

    expect(result.canEstimate).toBe(true);
    expect(result.requiredLeadMaxMinutes).toBe(185);
    expect(result.latestSeatByTime).toBe("16:55");
    expect(result.latestLeaveRestaurantByTime).toBe("19:25");
    expect(result.onTimeConfidence).toBe("safe");
  });

  it("removes walk-in wait when reservation is provided", () => {
    const assumptions = resolveDiningTimingAssumptions(
      {
        service_style: "casual_dine_in",
        walk_in_wait_minutes: 20,
      },
      true
    );

    expect(assumptions.walkInWaitMinutes).toBe(0);
  });

  it("classifies tight and risky windows from current time", () => {
    const tight = calculatePreShowDiningTiming({
      eventStartTime: "20:00",
      nowTime: "16:45",
      profile: { service_style: "full_service" },
    });
    const risky = calculatePreShowDiningTiming({
      eventStartTime: "20:00",
      nowTime: "17:20",
      profile: { service_style: "full_service" },
    });

    expect(tight.slackFromNowMinutes).toBe(10);
    expect(tight.onTimeConfidence).toBe("tight");
    expect(risky.slackFromNowMinutes).toBeLessThan(0);
    expect(risky.onTimeConfidence).toBe("risky");
  });

  it("returns unknown confidence when nowTime is omitted", () => {
    const result = calculatePreShowDiningTiming({
      eventStartTime: "20:00",
      profile: { service_style: "quick_service" },
    });

    expect(result.onTimeConfidence).toBe("unknown");
    expect(result.minutesUntilShowFromNow).toBeNull();
  });
});
