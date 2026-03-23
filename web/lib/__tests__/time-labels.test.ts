import { describe, expect, it } from "vitest";
import { getContextualTimeLabel } from "../time-labels";
import { getRaritySignal } from "../rarity-signals";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Date for a given offset from a fixed "now" anchor.
 * Using a fixed anchor keeps tests deterministic regardless of when they run.
 */

// Anchor: Wednesday 2026-03-25 14:00:00 local time
const ANCHOR = new Date(2026, 2, 25, 14, 0, 0); // month is 0-indexed

function minutesFromAnchor(offset: number): Date {
  return new Date(ANCHOR.getTime() + offset * 60 * 1000);
}

function dateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeString(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}:00`;
}

// ---------------------------------------------------------------------------
// getContextualTimeLabel
// ---------------------------------------------------------------------------

describe("getContextualTimeLabel", () => {
  it("returns 'Starts in X min' for an event starting in 30 minutes", () => {
    const startDt = minutesFromAnchor(30);
    const result = getContextualTimeLabel(
      dateString(startDt),
      timeString(startDt),
      null,
      false,
      ANCHOR
    );
    expect(result).toBe("Starts in 30 min");
  });

  it("returns 'Starts in 1 min' for an event starting in exactly 1 minute", () => {
    const startDt = minutesFromAnchor(1);
    const result = getContextualTimeLabel(
      dateString(startDt),
      timeString(startDt),
      null,
      false,
      ANCHOR
    );
    expect(result).toBe("Starts in 1 min");
  });

  it("returns 'Starts in 2 hours' for an event starting in 2 hours", () => {
    const startDt = minutesFromAnchor(120);
    const result = getContextualTimeLabel(
      dateString(startDt),
      timeString(startDt),
      null,
      false,
      ANCHOR
    );
    expect(result).toBe("Starts in 2 hours");
  });

  it("returns '' for an event starting in 5 hours (beyond 4-hour window)", () => {
    const startDt = minutesFromAnchor(300);
    const result = getContextualTimeLabel(
      dateString(startDt),
      timeString(startDt),
      null,
      false,
      ANCHOR
    );
    expect(result).toBe("");
  });

  it("returns 'All day today' for an all-day event starting today", () => {
    const result = getContextualTimeLabel(
      dateString(ANCHOR),
      null,
      null,
      true,
      ANCHOR
    );
    expect(result).toBe("All day today");
  });

  it("returns 'Tomorrow at 8 PM' for a timed event tomorrow at 20:00", () => {
    const tomorrow = new Date(ANCHOR);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 0, 0, 0);
    const result = getContextualTimeLabel(
      dateString(tomorrow),
      "20:00:00",
      null,
      false,
      ANCHOR
    );
    expect(result).toBe("Tomorrow at 8 PM");
  });

  it("returns 'Tomorrow' for an all-day event tomorrow", () => {
    const tomorrow = new Date(ANCHOR);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const result = getContextualTimeLabel(
      dateString(tomorrow),
      null,
      null,
      true,
      ANCHOR
    );
    // isTomorrow + no time → "Tomorrow"
    expect(result).toBe("Tomorrow");
  });

  it("returns 'Closes [day name]' for an exhibition closing in 2 days", () => {
    // End date is 2 days from anchor — daysUntilClose ≈ 2
    const closingDate = new Date(ANCHOR);
    closingDate.setDate(closingDate.getDate() + 2);
    const pastStart = new Date(ANCHOR);
    pastStart.setDate(pastStart.getDate() - 10);
    const result = getContextualTimeLabel(
      dateString(pastStart),
      null,
      dateString(closingDate),
      false,
      ANCHOR
    );
    // "EEEE" format of 2 days from 2026-03-25 (Wed) = Friday
    expect(result).toBe("Closes Friday");
  });

  it("returns 'Last day' for an exhibition closing today", () => {
    const pastStart = new Date(ANCHOR);
    pastStart.setDate(pastStart.getDate() - 30);
    const result = getContextualTimeLabel(
      dateString(pastStart),
      null,
      dateString(ANCHOR),
      false,
      ANCHOR
    );
    expect(result).toBe("Last day");
  });

  it("returns 'Happening now' for an event that started 30 minutes ago", () => {
    const startDt = minutesFromAnchor(-30);
    const result = getContextualTimeLabel(
      dateString(startDt),
      timeString(startDt),
      null,
      false,
      ANCHOR
    );
    expect(result).toBe("Happening now");
  });

  it("returns '' for an event that ended (started > 2 hours ago, no endDate)", () => {
    const startDt = minutesFromAnchor(-130);
    const result = getContextualTimeLabel(
      dateString(startDt),
      timeString(startDt),
      null,
      false,
      ANCHOR
    );
    expect(result).toBe("");
  });

  it("returns 'Happening now' when event started 90 min ago and endDate is still open", () => {
    const startDt = minutesFromAnchor(-90);
    const closingDate = new Date(ANCHOR);
    closingDate.setDate(closingDate.getDate() + 5);
    const result = getContextualTimeLabel(
      dateString(startDt),
      timeString(startDt),
      dateString(closingDate),
      false,
      ANCHOR
    );
    expect(result).toBe("Happening now");
  });
});

// ---------------------------------------------------------------------------
// getRaritySignal
// ---------------------------------------------------------------------------

describe("getRaritySignal", () => {
  it("returns 'One Night Only' for a single event with no series and no end_date", () => {
    const result = getRaritySignal(
      { start_date: "2026-04-01" },
      ANCHOR
    );
    expect(result).toEqual({ type: "one_night_only", label: "One Night Only" });
  });

  it("returns 'One Night Only' when end_date equals start_date", () => {
    const result = getRaritySignal(
      { start_date: "2026-04-01", end_date: "2026-04-01" },
      ANCHOR
    );
    expect(result).toEqual({ type: "one_night_only", label: "One Night Only" });
  });

  it("returns null for a recurring event", () => {
    const result = getRaritySignal(
      { start_date: "2026-04-01", is_recurring: true },
      ANCHOR
    );
    expect(result).toBeNull();
  });

  it("returns null for an event with a series_id", () => {
    const result = getRaritySignal(
      { start_date: "2026-04-01", series_id: 42 },
      ANCHOR
    );
    expect(result).toBeNull();
  });

  it("returns 'Closes [day]' for an exhibition closing in 2 days", () => {
    const closingDate = new Date(ANCHOR);
    closingDate.setDate(closingDate.getDate() + 2);
    const result = getRaritySignal(
      {
        start_date: "2026-03-01",
        end_date: dateString(closingDate),
        series_id: null,
        is_recurring: false,
      },
      ANCHOR
    );
    expect(result).toEqual({
      type: "closing_soon",
      label: "Closes Friday",
    });
  });

  it("returns 'Last Day' for an exhibition closing today", () => {
    const result = getRaritySignal(
      {
        start_date: "2026-03-01",
        end_date: dateString(ANCHOR),
        series_id: null,
        is_recurring: false,
      },
      ANCHOR
    );
    expect(result).toEqual({ type: "closing_soon", label: "Last Day" });
  });

  it("returns null for an event far in the future with no series", () => {
    // A single-night event in the future still gets "One Night Only"
    // A multi-day event far in the future returns null
    const farDate = new Date(ANCHOR);
    farDate.setDate(farDate.getDate() + 30);
    const result = getRaritySignal(
      {
        start_date: "2026-04-01",
        end_date: dateString(farDate),
        series_id: null,
        is_recurring: false,
      },
      ANCHOR
    );
    expect(result).toBeNull();
  });

  it("returns closing_soon for a recurring multi-day event ending in 1 day", () => {
    // is_recurring blocks one_night_only; closing_soon still applies to multi-day spans
    const closingDate = new Date(ANCHOR);
    closingDate.setDate(closingDate.getDate() + 1);
    const result = getRaritySignal(
      {
        start_date: "2026-03-01",
        end_date: dateString(closingDate),
        is_recurring: true,
      },
      ANCHOR
    );
    expect(result).toEqual({
      type: "closing_soon",
      label: "Closes Thursday",
    });
  });
});
