import { describe, expect, it } from "vitest";
import type { FeedEvent } from "@/lib/forth-types";
import { buildQuickAddPayload, toItineraryStartTime } from "@/lib/concierge/quick-itinerary";

function event(overrides: Partial<FeedEvent> = {}): FeedEvent {
  return {
    id: "123",
    title: "Sample Event",
    start_date: "2026-02-19",
    start_time: "19:30:00",
    image_url: null,
    description: null,
    venue_name: "Sample Venue",
    category: "music",
    is_free: false,
    price_min: 25,
    distance_km: null,
    ...overrides,
  };
}

describe("quick itinerary payloads", () => {
  it("builds event payload when event id is strictly numeric", () => {
    const payload = buildQuickAddPayload(event({ id: "987" }));
    expect(payload).toMatchObject({
      item_type: "event",
      event_id: 987,
      start_time: "19:30",
    });
  });

  it("falls back to custom payload when event id is not strictly numeric", () => {
    const payload = buildQuickAddPayload(event({ id: "event_987" }));
    expect(payload).toMatchObject({
      item_type: "custom",
      custom_title: "Sample Event",
      custom_address: "Sample Venue",
      start_time: "19:30",
    });
  });

  it("normalizes HH:MM:SS times to HH:MM", () => {
    expect(toItineraryStartTime("08:05:59")).toBe("08:05");
    expect(toItineraryStartTime("invalid")).toBeUndefined();
    expect(toItineraryStartTime(null)).toBeUndefined();
  });
});
