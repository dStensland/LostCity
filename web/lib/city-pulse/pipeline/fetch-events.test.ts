import { describe, expect, it } from "vitest";
import type { FeedEventData } from "@/components/EventCard";
import { applySourceDiversity } from "./fetch-events";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let nextId = 1;

function makeEvent(sourceId: number | null, overrides: Partial<FeedEventData> = {}): FeedEventData {
  const id = nextId++;
  return {
    id,
    title: `Event ${id}`,
    start_date: "2026-03-21",
    start_time: "18:00",
    is_all_day: false,
    is_free: false,
    price_min: null,
    price_max: null,
    category: "community",
    tags: [],
    genres: [],
    image_url: null,
    description: null,
    venue: null,
    // source_id is present at runtime but not in FeedEventData type
    ...({ source_id: sourceId } as Record<string, unknown>),
    ...overrides,
  } as FeedEventData;
}

// ---------------------------------------------------------------------------
// applySourceDiversity
// ---------------------------------------------------------------------------

describe("applySourceDiversity", () => {
  it("returns input unchanged when pool has fewer than minItems", () => {
    // 8 events all from one source — below the 10-item threshold
    const events = Array.from({ length: 8 }, () => makeEvent(1));
    const result = applySourceDiversity(events);
    expect(result).toEqual(events);
    expect(result.length).toBe(8);
  });

  it("returns input unchanged when no single source exceeds the cap", () => {
    // 10 events spread across 4 sources — no source dominates
    const events = [
      ...Array.from({ length: 3 }, () => makeEvent(1)),
      ...Array.from({ length: 3 }, () => makeEvent(2)),
      ...Array.from({ length: 2 }, () => makeEvent(3)),
      ...Array.from({ length: 2 }, () => makeEvent(4)),
    ];
    const result = applySourceDiversity(events);
    expect(result).toEqual(events);
  });

  it("caps an over-represented source at 40% and moves excess to end", () => {
    // 20 events: source 1 has 16 (80%), sources 2 and 3 have 2 each
    // 40% cap = floor(20 * 0.4) = 8
    const source1Events = Array.from({ length: 16 }, () => makeEvent(1));
    const source2Events = Array.from({ length: 2 }, () => makeEvent(2));
    const source3Events = Array.from({ length: 2 }, () => makeEvent(3));
    const events = [...source1Events, ...source2Events, ...source3Events];

    const result = applySourceDiversity(events);

    expect(result.length).toBe(20); // Nothing dropped

    // First 8 from source1, then the 4 minority events, then the 8 overflow from source1
    const source1Ids = new Set(source1Events.map((e) => e.id));
    const minorityIds = new Set([...source2Events, ...source3Events].map((e) => e.id));

    // Count source1 events in the primary block (first 12 = 8 primary + 4 minority)
    const primaryBlock = result.slice(0, 12);
    const primarySource1Count = primaryBlock.filter((e) => source1Ids.has(e.id)).length;
    expect(primarySource1Count).toBe(8); // Exactly at cap

    // All minority events are in the primary block
    const primaryMinorityCount = primaryBlock.filter((e) => minorityIds.has(e.id)).length;
    expect(primaryMinorityCount).toBe(4);

    // Overflow block (last 8) is all source1
    const overflowBlock = result.slice(12);
    expect(overflowBlock).toHaveLength(8);
    expect(overflowBlock.every((e) => source1Ids.has(e.id))).toBe(true);
  });

  it("preserves original ordering within each source group", () => {
    // Source 1 dominates. Verify the primary events from source1 are the
    // first 8 in their original input order, and overflow is in input order too.
    const source1Events = Array.from({ length: 12 }, (_, i) => makeEvent(1, {
      title: `HOA Event ${i + 1}`,
    }));
    const source2Events = Array.from({ length: 3 }, () => makeEvent(2));
    const events = [...source1Events, ...source2Events];
    // Total = 15, cap = floor(15 * 0.4) = 6

    const result = applySourceDiversity(events);

    // Extract source1 events from result in order
    const resultSource1 = result.filter(
      (e) => source1Events.some((s) => s.id === e.id),
    );
    // Primary 6 should match the first 6 of source1Events
    expect(resultSource1.slice(0, 6).map((e) => e.id)).toEqual(
      source1Events.slice(0, 6).map((e) => e.id),
    );
    // Overflow 6 should match the last 6 of source1Events
    expect(resultSource1.slice(6).map((e) => e.id)).toEqual(
      source1Events.slice(6).map((e) => e.id),
    );
  });

  it("handles multiple over-represented sources simultaneously", () => {
    // 20 events: source1=10, source2=10 — both exceed 40% cap (8)
    const source1Events = Array.from({ length: 10 }, () => makeEvent(1));
    const source2Events = Array.from({ length: 10 }, () => makeEvent(2));
    const events = [...source1Events, ...source2Events];
    // cap = floor(20 * 0.4) = 8

    const result = applySourceDiversity(events);

    expect(result.length).toBe(20);

    const resultSource1 = result.filter((e) => source1Events.some((s) => s.id === e.id));
    const resultSource2 = result.filter((e) => source2Events.some((s) => s.id === e.id));

    // Each source should have 8 in primary, 2 in overflow
    const primarySource1 = resultSource1.slice(0, 8);
    const primarySource2 = resultSource2.slice(0, 8);
    expect(primarySource1).toHaveLength(8);
    expect(primarySource2).toHaveLength(8);
  });

  it("treats null source_id as its own group", () => {
    // 20 events: 16 with null source_id, 4 with source 1
    const nullSourceEvents = Array.from({ length: 16 }, () => makeEvent(null));
    const source1Events = Array.from({ length: 4 }, () => makeEvent(1));
    const events = [...nullSourceEvents, ...source1Events];
    // cap = floor(20 * 0.4) = 8

    const result = applySourceDiversity(events);

    expect(result.length).toBe(20);

    // The 8 excess null-source events should be at the end
    const nullSourceIds = new Set(nullSourceEvents.map((e) => e.id));
    const overflowCount = result.slice(12).filter((e) => nullSourceIds.has(e.id)).length;
    expect(overflowCount).toBe(8);
  });

  it("respects custom maxSourceFraction", () => {
    // 10 events: source1=8, source2=2. With 25% cap → cap = 2
    const source1Events = Array.from({ length: 8 }, () => makeEvent(1));
    const source2Events = Array.from({ length: 2 }, () => makeEvent(2));
    const events = [...source1Events, ...source2Events];

    const result = applySourceDiversity(events, 0.25);

    expect(result.length).toBe(10);
    // Primary block: 2 from source1 + 2 from source2 = 4
    // Overflow: 6 from source1
    const source1Ids = new Set(source1Events.map((e) => e.id));
    const primarySource1Count = result.slice(0, 4).filter((e) => source1Ids.has(e.id)).length;
    expect(primarySource1Count).toBe(2);
  });

  it("respects custom minItems — does not rebalance below threshold", () => {
    // 15 events all from source 1, but custom minItems=20 → no rebalancing
    const events = Array.from({ length: 15 }, () => makeEvent(1));
    const result = applySourceDiversity(events, 0.4, 20);
    expect(result).toEqual(events);
  });
});
