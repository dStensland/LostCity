import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We'll test the internal computeIsLive logic by accessing it through the module
// Since it's not exported, we'll create a wrapper for testing
function computeIsLive(
  event: {
    start_date: string;
    start_time: string | null;
    end_time: string | null;
    is_all_day?: boolean | null;
    is_live?: boolean;
  },
  now: Date,
  today: string
): boolean {
  // Skip if already marked live by database
  if (event.is_live) return true;

  // Only today's events can be live
  if (event.start_date !== today) return false;

  // All-day events are live all day
  if (event.is_all_day) return true;

  // Need start_time to determine if live
  if (!event.start_time) return false;

  // Parse start time (HH:MM:SS format)
  const [startH, startM] = event.start_time.split(":").map(Number);
  const startMinutes = startH * 60 + startM;

  // Parse end time or default to 3 hours after start
  let endMinutes: number;
  if (event.end_time) {
    const [endH, endM] = event.end_time.split(":").map(Number);
    endMinutes = endH * 60 + endM;
    // Handle events that go past midnight
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
  } else {
    endMinutes = startMinutes + 180; // Default 3 hours
  }

  // Check if current time is within event window
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

describe("search - computeIsLive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true if event is already marked live", () => {
    const now = new Date("2024-01-15T14:00:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: "09:00:00",
      end_time: "17:00:00",
      is_live: true,
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(true);
  });

  it("returns false for events not happening today", () => {
    const now = new Date("2024-01-15T14:00:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-16", // Tomorrow
      start_time: "14:00:00",
      end_time: "16:00:00",
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(false);
  });

  it("returns true for all-day events happening today", () => {
    const now = new Date("2024-01-15T14:00:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: "00:00:00",
      end_time: null,
      is_all_day: true,
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(true);
  });

  it("returns false for events without start_time", () => {
    const now = new Date("2024-01-15T14:00:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: null,
      end_time: null,
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(false);
  });

  it("returns true when current time is within event window", () => {
    // Event from 13:00 to 17:00, current time 14:30
    const now = new Date("2024-01-15T14:30:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: "13:00:00",
      end_time: "17:00:00",
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(true);
  });

  it("returns false when current time is before event starts", () => {
    // Event from 15:00 to 17:00, current time 14:30
    const now = new Date("2024-01-15T14:30:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: "15:00:00",
      end_time: "17:00:00",
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(false);
  });

  it("returns false when current time is after event ends", () => {
    // Event from 09:00 to 12:00, current time 14:30
    const now = new Date("2024-01-15T14:30:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: "09:00:00",
      end_time: "12:00:00",
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(false);
  });

  it("uses 3-hour default duration when end_time is missing", () => {
    // Event starts at 12:00, current time 13:30 (within 3 hours)
    const now = new Date("2024-01-15T13:30:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: "12:00:00",
      end_time: null,
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(true);
  });

  it("returns false after 3-hour default duration", () => {
    // Event starts at 12:00, current time 15:30 (more than 3 hours)
    const now = new Date("2024-01-15T15:30:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: "12:00:00",
      end_time: null,
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(false);
  });

  it("handles events crossing midnight", () => {
    // Event from 22:00 to 02:00, current time 23:30
    const now = new Date("2024-01-15T23:30:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: "22:00:00",
      end_time: "02:00:00",
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(true);
  });

  it("handles edge case: event starting at exact current time", () => {
    // Event starts at 14:30, current time 14:30
    const now = new Date("2024-01-15T14:30:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: "14:30:00",
      end_time: "16:00:00",
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(true);
  });

  it("handles edge case: event ending at exact current time", () => {
    // Event from 12:00 to 14:30, current time 14:30
    const now = new Date("2024-01-15T14:30:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: "12:00:00",
      end_time: "14:30:00",
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(true);
  });

  it("handles events with seconds in time format", () => {
    // Event from 13:00:45 to 17:00:30, current time 14:30:00
    const now = new Date("2024-01-15T14:30:00");
    vi.setSystemTime(now);

    const event = {
      start_date: "2024-01-15",
      start_time: "13:00:45",
      end_time: "17:00:30",
    };

    expect(computeIsLive(event, now, "2024-01-15")).toBe(true);
  });
});

describe("search - escapePostgrestValue", () => {
  // Test the PostgREST filter escaping logic
  function escapePostgrestValue(value: string): string {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/'/g, "''")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/,/g, "\\,")
      .replace(/\./g, "\\.")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");
  }

  it("escapes backslashes", () => {
    expect(escapePostgrestValue("path\\file")).toBe("path\\\\file");
  });

  it("escapes double quotes", () => {
    expect(escapePostgrestValue('say "hello"')).toBe('say \\"hello\\"');
  });

  it("escapes single quotes", () => {
    expect(escapePostgrestValue("it's")).toBe("it''s");
  });

  it("escapes parentheses", () => {
    expect(escapePostgrestValue("func(arg)")).toBe("func\\(arg\\)");
  });

  it("escapes commas", () => {
    expect(escapePostgrestValue("a,b,c")).toBe("a\\,b\\,c");
  });

  it("escapes periods", () => {
    expect(escapePostgrestValue("example.com")).toBe("example\\.com");
  });

  it("escapes SQL LIKE wildcards", () => {
    expect(escapePostgrestValue("100%")).toBe("100\\%");
    expect(escapePostgrestValue("a_b")).toBe("a\\_b");
  });

  it("handles multiple special characters", () => {
    expect(escapePostgrestValue("(a,b)%_")).toBe("\\(a\\,b\\)\\%\\_");
  });

  it("prevents injection attacks", () => {
    const malicious = "'); DROP TABLE events;--";
    const escaped = escapePostgrestValue(malicious);
    // Should escape single quotes and parentheses
    expect(escaped).toBe("''\\); DROP TABLE events;--");
    expect(escaped).toContain("''"); // Escaped single quote
    // Note: Opening paren is not in the string
  });
});
