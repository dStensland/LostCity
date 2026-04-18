import { describe, expect, it } from "vitest";
import { bucketEvents } from "@/lib/neighborhoods/bucket-events";

const TZ = "America/New_York";

function ev(
  start_date: string,
  start_time: string | null = null,
  is_all_day = false,
) {
  return { start_date, start_time, is_all_day };
}

describe("bucketEvents", () => {
  describe("today: tonight vs later", () => {
    // Thursday 2026-04-16 at 8pm ET
    const now = new Date("2026-04-16T20:00:00-04:00");

    it("puts today 9am into later (not tonight)", () => {
      const result = bucketEvents([ev("2026-04-16", "09:00")], now, TZ);
      expect(result.tonight).toHaveLength(0);
      expect(result.later).toHaveLength(1);
    });

    it("puts today 5:00pm into tonight (at the cutoff)", () => {
      const result = bucketEvents([ev("2026-04-16", "17:00")], now, TZ);
      expect(result.tonight).toHaveLength(1);
      expect(result.later).toHaveLength(0);
    });

    it("puts today 4:59pm into later (below cutoff)", () => {
      const result = bucketEvents([ev("2026-04-16", "16:59")], now, TZ);
      expect(result.tonight).toHaveLength(0);
      expect(result.later).toHaveLength(1);
    });

    it("puts today all-day into tonight", () => {
      const result = bucketEvents([ev("2026-04-16", null, true)], now, TZ);
      expect(result.tonight).toHaveLength(1);
    });

    it("puts today null-time non-all-day into later", () => {
      const result = bucketEvents([ev("2026-04-16", null, false)], now, TZ);
      expect(result.tonight).toHaveLength(0);
      expect(result.later).toHaveLength(1);
    });

    it("normalizes start_time with seconds (19:00:00 → evening)", () => {
      const result = bucketEvents([ev("2026-04-16", "19:00:00")], now, TZ);
      expect(result.tonight).toHaveLength(1);
    });
  });

  describe("weekend boundary (Thursday → Friday eve → Sat → Sun)", () => {
    // Thursday 2026-04-16 at 10am ET
    const now = new Date("2026-04-16T10:00:00-04:00");

    it("puts Friday 6am into later (Fri morning is workweek, not weekend)", () => {
      const result = bucketEvents([ev("2026-04-17", "06:00")], now, TZ);
      expect(result.weekend).toHaveLength(0);
      expect(result.later).toHaveLength(1);
    });

    it("puts Friday 5pm into weekend (Fri evening cutoff)", () => {
      const result = bucketEvents([ev("2026-04-17", "17:00")], now, TZ);
      expect(result.weekend).toHaveLength(1);
    });

    it("puts Friday all-day into weekend", () => {
      const result = bucketEvents([ev("2026-04-17", null, true)], now, TZ);
      expect(result.weekend).toHaveLength(1);
    });

    it("puts Saturday noon into weekend", () => {
      const result = bucketEvents([ev("2026-04-18", "12:00")], now, TZ);
      expect(result.weekend).toHaveLength(1);
    });

    it("puts Sunday 8pm into weekend", () => {
      const result = bucketEvents([ev("2026-04-19", "20:00")], now, TZ);
      expect(result.weekend).toHaveLength(1);
    });

    it("puts next Monday into nextWeek", () => {
      const result = bucketEvents([ev("2026-04-20", "18:00")], now, TZ);
      expect(result.nextWeek).toHaveLength(1);
    });

    it("puts next Sunday (+10 days) into nextWeek", () => {
      const result = bucketEvents([ev("2026-04-26", "15:00")], now, TZ);
      expect(result.nextWeek).toHaveLength(1);
    });

    it("puts +11 days (week-after-next Monday) into later", () => {
      const result = bucketEvents([ev("2026-04-27", "18:00")], now, TZ);
      expect(result.later).toHaveLength(1);
    });
  });

  describe("week rollover from Sunday", () => {
    // Sunday 2026-04-19 at 10pm ET
    const now = new Date("2026-04-19T22:00:00-04:00");

    it("treats today Sunday 11pm as tonight", () => {
      const result = bucketEvents([ev("2026-04-19", "23:00")], now, TZ);
      expect(result.tonight).toHaveLength(1);
    });

    it("treats tomorrow Monday as nextWeek (not weekend or later)", () => {
      const result = bucketEvents([ev("2026-04-20", "09:00")], now, TZ);
      expect(result.nextWeek).toHaveLength(1);
      expect(result.weekend).toHaveLength(0);
    });

    it("treats next Sunday as nextWeek", () => {
      const result = bucketEvents([ev("2026-04-26", "15:00")], now, TZ);
      expect(result.nextWeek).toHaveLength(1);
    });

    it("treats week-after-next Monday as later", () => {
      const result = bucketEvents([ev("2026-04-27", "15:00")], now, TZ);
      expect(result.later).toHaveLength(1);
    });
  });

  describe("Saturday midday context", () => {
    // Saturday 2026-04-18 at 1pm ET
    const now = new Date("2026-04-18T13:00:00-04:00");

    it("today Saturday 3pm → tonight (afternoon not evening, but today-all-day logic)", () => {
      // Today = Sat. Afternoon event today. By rule: today + time < 17:00 → later.
      // This is intentional — Sat 3pm is NOT "tonight" semantically.
      const result = bucketEvents([ev("2026-04-18", "15:00")], now, TZ);
      expect(result.later).toHaveLength(1);
      expect(result.tonight).toHaveLength(0);
    });

    it("today Saturday 7pm → tonight", () => {
      const result = bucketEvents([ev("2026-04-18", "19:00")], now, TZ);
      expect(result.tonight).toHaveLength(1);
    });

    it("tomorrow Sunday → weekend (not tonight)", () => {
      const result = bucketEvents([ev("2026-04-19", "14:00")], now, TZ);
      expect(result.weekend).toHaveLength(1);
    });
  });

  describe("DST transitions", () => {
    it("spring-forward: Sunday 2026-03-08 (DST starts), events bucket correctly", () => {
      // Saturday 2026-03-07 at 10pm ET (day before spring-forward)
      const now = new Date("2026-03-07T22:00:00-05:00");
      const result = bucketEvents(
        [
          ev("2026-03-07", "22:30"), // tonight
          ev("2026-03-08", "10:00"), // Sunday — weekend (today is Sat, weekend ends Sun)
          ev("2026-03-09", "09:00"), // Mon — nextWeek
        ],
        now,
        TZ,
      );
      expect(result.tonight).toHaveLength(1);
      expect(result.weekend).toHaveLength(1);
      expect(result.nextWeek).toHaveLength(1);
    });

    it("fall-back: Sunday 2026-11-01 (DST ends), events bucket correctly", () => {
      // Saturday 2026-10-31 at 10pm ET (day before fall-back)
      const now = new Date("2026-10-31T22:00:00-04:00");
      const result = bucketEvents(
        [
          ev("2026-10-31", "22:30"), // tonight
          ev("2026-11-01", "10:00"), // Sunday — weekend
          ev("2026-11-02", "09:00"), // Mon — nextWeek
        ],
        now,
        TZ,
      );
      expect(result.tonight).toHaveLength(1);
      expect(result.weekend).toHaveLength(1);
      expect(result.nextWeek).toHaveLength(1);
    });
  });

  describe("empty and edge-case inputs", () => {
    const now = new Date("2026-04-16T20:00:00-04:00");

    it("empty list returns all empty buckets", () => {
      const result = bucketEvents([], now, TZ);
      expect(result.tonight).toEqual([]);
      expect(result.weekend).toEqual([]);
      expect(result.nextWeek).toEqual([]);
      expect(result.later).toEqual([]);
    });

    it("far-future event goes to later", () => {
      const result = bucketEvents([ev("2026-12-25", "10:00")], now, TZ);
      expect(result.later).toHaveLength(1);
    });

    it("preserves original event object identity in buckets", () => {
      const e = ev("2026-04-16", "19:00");
      const result = bucketEvents([e], now, TZ);
      expect(result.tonight[0]).toBe(e);
    });

    it("preserves relative order within a bucket", () => {
      const e1 = { ...ev("2026-04-17", "19:00"), id: 1 };
      const e2 = { ...ev("2026-04-18", "12:00"), id: 2 };
      const e3 = { ...ev("2026-04-19", "20:00"), id: 3 };
      const result = bucketEvents([e1, e2, e3], now, TZ);
      expect(result.weekend.map((e) => e.id)).toEqual([1, 2, 3]);
    });
  });

  describe("timezone parameter respected (not hardcoded)", () => {
    it("PST caller sees different 'today' than ET caller for same instant", () => {
      // 2026-04-16 11:30pm ET = 2026-04-16 8:30pm PT = still the 16th in PT
      // But: 2026-04-17 02:30 UTC → 2026-04-16 7:30pm PT → still the 16th.
      // Better test: instant that's on the day-edge in one zone but not the other.
      // 2026-04-17 02:30 ET = 2026-04-16 11:30pm PT (same calendar day PT, next day ET).
      const instant = new Date("2026-04-17T02:30:00-04:00");
      // In ET: today = 2026-04-17 (Friday)
      const etResult = bucketEvents([ev("2026-04-17", "22:00")], instant, "America/New_York");
      // Friday 10pm, today = Friday in ET → tonight
      expect(etResult.tonight).toHaveLength(1);

      // In PT: today = 2026-04-16 (Thursday)
      const ptResult = bucketEvents([ev("2026-04-17", "22:00")], instant, "America/Los_Angeles");
      // Fri 10pm event when today is Thu → weekend (Fri eve)
      expect(ptResult.weekend).toHaveLength(1);
      expect(ptResult.tonight).toHaveLength(0);
    });
  });
});
