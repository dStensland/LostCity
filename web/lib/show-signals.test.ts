import { describe, expect, it } from "vitest";
import { deriveShowSignals } from "@/lib/show-signals";

describe("deriveShowSignals", () => {
  it("extracts doors/show times and ticket state from text", () => {
    const signals = deriveShowSignals({
      title: "ALLEYCVT w/ Steller",
      description: "Doors 7:30 PM. Show at 8:30pm. Limited tickets remain.",
      ticket_url: "https://tickets.example.com",
      start_time: "20:30:00",
      tags: ["ticketed"],
    });

    expect(signals.doorsTime).toBe("7:30pm");
    expect(signals.showTime).toBe("8:30pm");
    expect(signals.ticketStatus).toBe("Low tickets");
  });

  it("prefers explicit age restrictions over all-ages noise", () => {
    const signals = deriveShowSignals({
      description: "This event is 21+ only. Valid ID required.",
      tags: ["all-ages", "21+"],
    });

    expect(signals.agePolicy).toBe("21+");
  });

  it("detects sold-out and re-entry policy", () => {
    const signals = deriveShowSignals({
      description: "Sold out. No re-entry after entry.",
      tags: ["ticketed"],
    });

    expect(signals.ticketStatus).toBe("Sold out");
    expect(signals.reentryPolicy).toBe("No re-entry");
  });

  it("falls back to structured start/end times when no text hints exist", () => {
    const signals = deriveShowSignals({
      start_time: "19:00:00",
      end_time: "22:00:00",
      is_free: true,
    });

    expect(signals.showTime).toBe("7:00pm");
    expect(signals.endTime).toBe("10:00pm");
    expect(signals.ticketStatus).toBe("Free");
  });

  it("prefers first-class DB fields when present", () => {
    const signals = deriveShowSignals({
      description: "Doors 8:00 PM. Sold out.",
      doors_time: "17:45:00",
      age_policy: "all-ages",
      ticket_status: "tickets-available",
      reentry_policy: "reentry-allowed",
      set_times_mentioned: true,
      start_time: "20:00:00",
    });

    expect(signals.doorsTime).toBe("5:45pm");
    expect(signals.agePolicy).toBe("All ages");
    expect(signals.ticketStatus).toBe("Tickets available");
    expect(signals.reentryPolicy).toBe("Re-entry allowed");
    expect(signals.hasSetTimesMention).toBe(true);
  });
});
