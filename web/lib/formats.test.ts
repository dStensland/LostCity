import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatTime,
  formatTimeSplit,
  formatTimeRange,
  formatDuration,
  formatPrice,
  formatPriceDetailed,
  formatSmartDate,
  getLocalDateString,
  getLocalDateStringOffset,
} from "./formats";

describe("formats", () => {
  describe("formatTime", () => {
    it("formats morning times correctly", () => {
      expect(formatTime("09:00")).toBe("9:00am");
      expect(formatTime("06:30")).toBe("6:30am");
      expect(formatTime("00:00")).toBe("12:00am"); // Midnight
    });

    it("formats afternoon/evening times correctly", () => {
      expect(formatTime("13:00")).toBe("1:00pm");
      expect(formatTime("19:30")).toBe("7:30pm");
      expect(formatTime("23:59")).toBe("11:59pm");
      expect(formatTime("12:00")).toBe("12:00pm"); // Noon
    });

    it("handles all-day events", () => {
      expect(formatTime("09:00", true)).toBe("All Day");
      expect(formatTime(null, true)).toBe("All Day");
    });

    it("handles missing time", () => {
      expect(formatTime(null)).toBe("TBA");
      expect(formatTime(null, false)).toBe("TBA");
    });
  });

  describe("formatTimeSplit", () => {
    it("splits time and period", () => {
      expect(formatTimeSplit("19:30")).toEqual({ time: "7:30", period: "pm" });
      expect(formatTimeSplit("09:00")).toEqual({ time: "9:00", period: "am" });
    });

    it("handles all-day events", () => {
      expect(formatTimeSplit("09:00", true)).toEqual({ time: "ALL", period: "DAY" });
    });

    it("handles missing time", () => {
      expect(formatTimeSplit(null)).toEqual({ time: "TBA", period: "" });
    });
  });

  describe("formatTimeRange", () => {
    it("formats time range with start and end", () => {
      expect(formatTimeRange("19:00", "22:00")).toBe("7:00pm → 10:00pm");
      expect(formatTimeRange("09:00", "17:00")).toBe("9:00am → 5:00pm");
    });

    it("formats single time when no end", () => {
      expect(formatTimeRange("19:00", null)).toBe("7:00pm");
    });

    it("handles all-day events", () => {
      expect(formatTimeRange("09:00", "17:00", true)).toBe("All Day");
    });

    it("handles missing start time", () => {
      expect(formatTimeRange(null, "17:00")).toBe("TBA");
    });
  });

  describe("formatDuration", () => {
    it("calculates whole hour durations", () => {
      expect(formatDuration("19:00", "22:00")).toBe("3 hours");
      expect(formatDuration("09:00", "10:00")).toBe("1 hour");
      expect(formatDuration("20:00", "23:00")).toBe("3 hours");
    });

    it("calculates fractional hour durations", () => {
      expect(formatDuration("19:00", "20:30")).toBe("1.5 hours");
      expect(formatDuration("09:00", "11:15")).toBe("2.3 hours");
    });

    it("handles events crossing midnight", () => {
      expect(formatDuration("22:00", "02:00")).toBe("4 hours");
      expect(formatDuration("23:00", "01:00")).toBe("2 hours");
    });

    it("returns null for missing times", () => {
      expect(formatDuration(null, "22:00")).toBe(null);
      expect(formatDuration("19:00", null)).toBe(null);
      expect(formatDuration(null, null)).toBe(null);
    });
  });

  describe("formatPrice", () => {
    it("formats free events", () => {
      expect(formatPrice({ is_free: true })).toBe("Free");
      expect(formatPrice({ is_free: true, price_min: 0 })).toBe("Free");
    });

    it("formats single price", () => {
      // When only price_min is set, price_max may be null/undefined
      expect(formatPrice({ price_min: 25, price_max: null })).toBe("$25");
      expect(formatPrice({ price_min: 25, price_max: 25 })).toBe("$25");
    });

    it("formats price range", () => {
      expect(formatPrice({ price_min: 25, price_max: 50 })).toBe("$25–50");
      expect(formatPrice({ price_min: 10, price_max: 100 })).toBe("$10–100");
    });

    it("formats estimated venue price", () => {
      expect(formatPrice({
        venue: { typical_price_min: 20, typical_price_max: 30 }
      })).toBe("~$20–30");
    });

    it("formats estimated single venue price", () => {
      expect(formatPrice({
        venue: { typical_price_min: 15, typical_price_max: 15 }
      })).toBe("~$15");
    });

    it("returns empty for unknown price", () => {
      expect(formatPrice({})).toBe("");
    });
  });

  describe("formatPriceDetailed", () => {
    it("returns detailed info for free events", () => {
      const result = formatPriceDetailed({ is_free: true });
      expect(result.text).toBe("Free");
      expect(result.isFree).toBe(true);
      expect(result.isEstimate).toBe(false);
    });

    it("returns detailed info for explicit price", () => {
      const result = formatPriceDetailed({ price_min: 25, price_max: 50 });
      expect(result.text).toBe("$25–50");
      expect(result.isFree).toBe(false);
      expect(result.isEstimate).toBe(false);
    });

    it("marks venue price as estimate", () => {
      const result = formatPriceDetailed({
        venue: { typical_price_min: 20 }
      });
      expect(result.text).toBe("~$20");
      expect(result.isEstimate).toBe(true);
    });

    it("marks free venue as estimate", () => {
      const result = formatPriceDetailed({
        venue: { typical_price_min: 0, typical_price_max: 0 }
      });
      expect(result.text).toBe("Free");
      expect(result.isFree).toBe(true);
      expect(result.isEstimate).toBe(true);
    });
  });

  describe("formatSmartDate", () => {
    let mockDate: Date;

    beforeEach(() => {
      // Mock current date to a known value: January 15, 2024
      mockDate = new Date("2024-01-15T12:00:00");
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns Today for current date", () => {
      const result = formatSmartDate("2024-01-15");
      expect(result.label).toBe("Today");
      expect(result.isHighlight).toBe(true);
    });

    it("returns day name with highlight for tomorrow", () => {
      const result = formatSmartDate("2024-01-16");
      // Jan 16, 2024 is a Tuesday
      expect(result.label).toBe("Tue");
      expect(result.isHighlight).toBe(true);
    });

    it("returns day name for dates within a week", () => {
      // Jan 20, 2024 is a Saturday (5 days from Jan 15)
      const result = formatSmartDate("2024-01-20");
      expect(result.label).toBe("Sat");
      expect(result.isHighlight).toBe(false);
    });

    it("returns M/D format for dates beyond a week", () => {
      const result = formatSmartDate("2024-01-28");
      expect(result.label).toBe("1/28");
      expect(result.isHighlight).toBe(false);
    });
  });

  describe("getLocalDateString", () => {
    it("formats date in YYYY-MM-DD format", () => {
      const date = new Date(2024, 0, 15); // January 15, 2024
      expect(getLocalDateString(date)).toBe("2024-01-15");
    });

    it("pads single digit months and days", () => {
      const date = new Date(2024, 2, 5); // March 5, 2024
      expect(getLocalDateString(date)).toBe("2024-03-05");
    });

    it("uses current date when no argument", () => {
      const result = getLocalDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("getLocalDateStringOffset", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-15T12:00:00"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns offset date string", () => {
      expect(getLocalDateStringOffset(0)).toBe("2024-01-15");
      expect(getLocalDateStringOffset(1)).toBe("2024-01-16");
      expect(getLocalDateStringOffset(7)).toBe("2024-01-22");
    });

    it("handles month boundary", () => {
      expect(getLocalDateStringOffset(20)).toBe("2024-02-04");
    });

    it("handles negative offset", () => {
      expect(getLocalDateStringOffset(-1)).toBe("2024-01-14");
      expect(getLocalDateStringOffset(-15)).toBe("2023-12-31");
    });
  });
});
