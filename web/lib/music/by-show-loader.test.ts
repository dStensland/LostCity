import { describe, it, expect } from "vitest";
import { dayLabel, groupShowsByDate } from "./by-show-loader";
import { buildShowPayload } from "./build-show-payload";
import { makeRawEventRow } from "./__fixtures__/raw-event";

describe("dayLabel", () => {
  it('labels the anchor date as "TONIGHT"', () => {
    expect(dayLabel("2026-04-17", "2026-04-17")).toBe("TONIGHT");
  });

  it('labels the day after the anchor as "TOMORROW"', () => {
    expect(dayLabel("2026-04-18", "2026-04-17")).toBe("TOMORROW");
  });

  it("labels further-out dates as uppercase weekday + short month + day", () => {
    // 2026-04-25 is a Saturday.
    expect(dayLabel("2026-04-25", "2026-04-17")).toBe("SATURDAY, APR 25");
  });

  it("does not drift across UTC midnight (fixed-date smoke check)", () => {
    // Noon-local pin means the weekday is stable regardless of server TZ.
    expect(dayLabel("2026-01-01", "2025-12-30")).toBe("THURSDAY, JAN 1");
  });
});

describe("groupShowsByDate", () => {
  it("groups shows by start_date, sorts groups ascending, sorts shows by effective start", () => {
    const shows = [
      buildShowPayload(
        makeRawEventRow({
          id: 1,
          start_date: "2026-04-20",
          start_time: "21:00",
          doors_time: null,
        }),
      ),
      buildShowPayload(
        makeRawEventRow({
          id: 2,
          start_date: "2026-04-18",
          start_time: "20:00",
          doors_time: null,
        }),
      ),
      buildShowPayload(
        makeRawEventRow({
          id: 3,
          start_date: "2026-04-20",
          start_time: "22:00",
          // Doors before the 21:00 show → should sort first within the day.
          doors_time: "19:30",
        }),
      ),
    ];

    const groups = groupShowsByDate(shows);

    expect(groups.map((g) => g.date)).toEqual(["2026-04-18", "2026-04-20"]);
    expect(groups[1].shows.map((s) => s.id)).toEqual([3, 1]);
  });

  it("returns an empty array when given no shows", () => {
    expect(groupShowsByDate([])).toEqual([]);
  });
});
