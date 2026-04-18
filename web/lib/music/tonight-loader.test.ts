import { describe, it, expect } from "vitest";
import {
  effectiveStart,
  isLateNight,
  LATE_NIGHT_THRESHOLD,
} from "./tonight-loader";
import { makeRawEventRow } from "./__fixtures__/raw-event";

describe("effectiveStart", () => {
  it("prefers doors_time over start_time", () => {
    expect(effectiveStart("19:00", "20:00")).toBe("19:00");
  });

  it("falls back to start_time when doors_time is null", () => {
    expect(effectiveStart(null, "20:00")).toBe("20:00");
  });

  it("falls back to 00:00 when both are null", () => {
    expect(effectiveStart(null, null)).toBe("00:00");
  });
});

describe("isLateNight", () => {
  it("threshold is 21:00", () => {
    expect(LATE_NIGHT_THRESHOLD).toBe("21:00");
  });

  it("doors at 18:00 is NOT late-night (tonight bucket)", () => {
    expect(isLateNight("18:00", "20:00")).toBe(false);
  });

  it("doors at 22:00 IS late-night", () => {
    expect(isLateNight("22:00", "21:00")).toBe(true);
  });

  it("doors null, start_time 21:00 is late-night (>= threshold)", () => {
    expect(isLateNight(null, "21:00")).toBe(true);
  });

  it("doors null, start_time 20:59 is NOT late-night", () => {
    expect(isLateNight(null, "20:59")).toBe(false);
  });

  it("both null falls back to 00:00 (tonight)", () => {
    expect(isLateNight(null, null)).toBe(false);
  });
});

describe("isLateNight with RawEventRow fixture", () => {
  it("row with doors 18:00 lands in tonight bucket", () => {
    const row = makeRawEventRow({ doors_time: "18:00", start_time: "20:00" });
    expect(isLateNight(row.doors_time, row.start_time)).toBe(false);
  });

  it("row with doors 22:00 lands in late-night bucket", () => {
    const row = makeRawEventRow({ doors_time: "22:00", start_time: "23:00" });
    expect(isLateNight(row.doors_time, row.start_time)).toBe(true);
  });
});
