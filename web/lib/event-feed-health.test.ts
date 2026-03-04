import { describe, expect, it } from "vitest";

import {
  dedupeEventsById,
  dedupeSectionEventsById,
  filterOutInactiveVenueEvents,
} from "@/lib/event-feed-health";

describe("event-feed-health", () => {
  it("filters out events whose venue is explicitly inactive", () => {
    const events = [
      { id: 1, venue: { active: true } },
      { id: 2, venue: { active: false } },
      { id: 3, venue: { active: null } },
      { id: 4, venue: null },
      { id: 5 },
    ];

    const filtered = filterOutInactiveVenueEvents(events);
    expect(filtered.map((event) => event.id)).toEqual([1, 3, 4, 5]);
  });

  it("dedupes events by id and keeps first occurrence", () => {
    const events = [
      { id: 101, label: "first" },
      { id: 102, label: "second" },
      { id: 101, label: "duplicate-first" },
      { id: 103, label: "third" },
      { id: 102, label: "duplicate-second" },
    ];

    const deduped = dedupeEventsById(events);
    expect(deduped).toEqual([
      { id: 101, label: "first" },
      { id: 102, label: "second" },
      { id: 103, label: "third" },
    ]);
  });

  it("dedupes cross-section events globally while preserving section order", () => {
    const sections = [
      {
        id: "lineup",
        events: [
          { id: 1, title: "A" },
          { id: 2, title: "B" },
        ],
      },
      {
        id: "regular-hangs",
        events: [
          { id: 2, title: "B duplicate in section 2" },
          { id: 3, title: "C" },
        ],
      },
      {
        id: "big-events",
        events: [
          { id: 1, title: "A duplicate in section 3" },
          { id: 4, title: "D" },
        ],
      },
    ];

    const deduped = dedupeSectionEventsById(sections);
    expect(deduped).toEqual([
      {
        id: "lineup",
        events: [
          { id: 1, title: "A" },
          { id: 2, title: "B" },
        ],
      },
      {
        id: "regular-hangs",
        events: [{ id: 3, title: "C" }],
      },
      {
        id: "big-events",
        events: [{ id: 4, title: "D" }],
      },
    ]);
  });
});
