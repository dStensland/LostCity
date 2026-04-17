import { describe, expect, it } from "vitest";
import { isoWeekRange } from "./date-windows";

describe("isoWeekRange", () => {
  it("returns Mon-Sun when called on a Monday", () => {
    // 2026-04-13 is a Monday
    const { start, end } = isoWeekRange(new Date("2026-04-13T15:00:00-04:00"));
    expect(start).toBe("2026-04-13");
    expect(end).toBe("2026-04-19");
  });

  it("returns the previous Monday through current Sunday on Sunday evening ET", () => {
    // 2026-04-19 is a Sunday. 23:30 ET is the classic "Vercel flips to UTC-next-day" hazard.
    const { start, end } = isoWeekRange(new Date("2026-04-19T23:30:00-04:00"));
    expect(start).toBe("2026-04-13");
    expect(end).toBe("2026-04-19");
  });

  it("returns the containing Mon-Sun when called midweek on a Thursday", () => {
    // 2026-04-16 is a Thursday
    const { start, end } = isoWeekRange(new Date("2026-04-16T10:00:00-04:00"));
    expect(start).toBe("2026-04-13");
    expect(end).toBe("2026-04-19");
  });
});
