import { describe, expect, it } from "vitest";
import { matchSubscribedChannelsToEvents, type MatchableEvent } from "./interest-channel-matches";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeChannel(id: string, slug: string) {
  return {
    id,
    portal_id: "portal-1",
    slug,
    name: slug,
    channel_type: "topic",
    sort_order: 10,
    is_active: true,
  };
}

function makeRule(channelId: string, type: string, payload: Record<string, unknown>) {
  return { channel_id: channelId, rule_type: type, rule_payload: payload, priority: 10, is_active: true };
}

describe("matchSubscribedChannelsToEvents", () => {
  it("matches source and tag rules to events", () => {
    const events: MatchableEvent[] = [
      {
        id: 101,
        source_id: 17,
        organization_id: null,
        category: "community",
        tags: ["public-meeting"],
        venue: null,
      },
      {
        id: 102,
        source_id: 99,
        organization_id: null,
        category: "community",
        tags: ["Volunteer", "local"],
        venue: null,
      },
    ];

    const channels = [
      {
        id: "c-1",
        portal_id: "portal-1",
        slug: "atlanta-city-government",
        name: "City of Atlanta Government",
        channel_type: "jurisdiction",
        sort_order: 10,
        is_active: true,
      },
      {
        id: "c-2",
        portal_id: "portal-1",
        slug: "volunteer-opportunities-atl",
        name: "Volunteer Opportunities",
        channel_type: "topic",
        sort_order: 20,
        is_active: true,
      },
    ];

    const rules = [
      {
        channel_id: "c-1",
        rule_type: "source",
        rule_payload: { source_id: 17 },
        priority: 10,
        is_active: true,
      },
      {
        channel_id: "c-2",
        rule_type: "tag",
        rule_payload: { tag: "volunteer" },
        priority: 30,
        is_active: true,
      },
    ];

    const matches = matchSubscribedChannelsToEvents(events, channels, rules);

    expect(matches.get(101)?.map((m) => m.channel_slug)).toEqual([
      "atlanta-city-government",
    ]);
    expect(matches.get(102)?.map((m) => m.channel_slug)).toEqual([
      "volunteer-opportunities-atl",
    ]);
  });

  it("supports plural payload keys for source/category/organization/venue", () => {
    const events: MatchableEvent[] = [
      {
        id: 201,
        source_id: 3,
        organization_id: null,
        category: "learning",
        tags: [],
        venue_id: null,
        venue: null,
      },
      {
        id: 202,
        source_id: null,
        organization_id: "org-abc",
        category: "community",
        tags: [],
        venue_id: 9001,
        venue: null,
      },
    ];

    const channels = [
      {
        id: "c-3",
        portal_id: "portal-1",
        slug: "category-watch",
        name: "Category Watch",
        channel_type: "topic",
        sort_order: 10,
        is_active: true,
      },
    ];

    const rules = [
      {
        channel_id: "c-3",
        rule_type: "source",
        rule_payload: { source_ids: [1, 3, 7] },
        priority: 10,
        is_active: true,
      },
      {
        channel_id: "c-3",
        rule_type: "category",
        rule_payload: { category_ids: ["learning", "community"] },
        priority: 20,
        is_active: true,
      },
      {
        channel_id: "c-3",
        rule_type: "organization",
        rule_payload: { organization_ids: ["org-abc"] },
        priority: 30,
        is_active: true,
      },
      {
        channel_id: "c-3",
        rule_type: "venue",
        rule_payload: { venue_ids: [9001] },
        priority: 40,
        is_active: true,
      },
    ];

    const matches = matchSubscribedChannelsToEvents(events, channels, rules);
    expect(matches.get(201)?.[0]?.channel_id).toBe("c-3");
    expect(matches.get(202)?.[0]?.channel_id).toBe("c-3");
  });
});

// ─── geo rule type ───────────────────────────────────────────────────────────

describe("geo rule type", () => {
  const channel = makeChannel("c-geo", "geo-channel");

  function match(event: MatchableEvent, payload: Record<string, unknown>) {
    const rule = makeRule("c-geo", "geo", payload);
    return matchSubscribedChannelsToEvents([event], [channel], [rule]);
  }

  function baseEvent(overrides: Partial<MatchableEvent> = {}): MatchableEvent {
    return {
      id: 1,
      source_id: null,
      organization_id: null,
      category: null,
      tags: [],
      ...overrides,
    };
  }

  // ── city ──────────────────────────────────────────────────────────────────

  it("city: matches when venue_city is in the cities list (case-insensitive)", () => {
    const event = baseEvent({ venue_city: "Atlanta" });
    const result = match(event, { type: "city", cities: ["atlanta", "decatur"] });
    expect(result.has(1)).toBe(true);
  });

  it("city: matches with different casing in the event field", () => {
    const event = baseEvent({ venue_city: "ATLANTA" });
    const result = match(event, { type: "city", cities: ["atlanta"] });
    expect(result.has(1)).toBe(true);
  });

  it("city: does not match a city outside the list", () => {
    const event = baseEvent({ venue_city: "Nashville" });
    const result = match(event, { type: "city", cities: ["atlanta", "decatur"] });
    expect(result.has(1)).toBe(false);
  });

  it("city: returns false when venue_city is null", () => {
    const event = baseEvent({ venue_city: null });
    const result = match(event, { type: "city", cities: ["atlanta"] });
    expect(result.has(1)).toBe(false);
  });

  // ── state ─────────────────────────────────────────────────────────────────

  it("state: matches when venue_state is in the states list (case-insensitive)", () => {
    const event = baseEvent({ venue_state: "GA" });
    const result = match(event, { type: "state", states: ["ga"] });
    expect(result.has(1)).toBe(true);
  });

  it("state: does not match a state outside the list", () => {
    const event = baseEvent({ venue_state: "TN" });
    const result = match(event, { type: "state", states: ["ga"] });
    expect(result.has(1)).toBe(false);
  });

  it("state: returns false when venue_state is null", () => {
    const event = baseEvent({ venue_state: null });
    const result = match(event, { type: "state", states: ["GA"] });
    expect(result.has(1)).toBe(false);
  });

  // ── radius ────────────────────────────────────────────────────────────────

  // Downtown Atlanta ~ 33.749, -84.388. Decatur is ~5 miles east.
  const ATLANTA_LAT = 33.749;
  const ATLANTA_LNG = -84.388;
  const DECATUR_LAT = 33.7748;
  const DECATUR_LNG = -84.2963;

  it("radius: matches an event within the radius", () => {
    // Decatur is ~5 miles from downtown Atlanta — within 30 miles
    const event = baseEvent({ venue_lat: DECATUR_LAT, venue_lng: DECATUR_LNG });
    const result = match(event, {
      type: "radius",
      center_lat: ATLANTA_LAT,
      center_lng: ATLANTA_LNG,
      radius_miles: 30,
    });
    expect(result.has(1)).toBe(true);
  });

  it("radius: does not match an event outside the radius", () => {
    // Nashville is ~250 miles from Atlanta — outside 30 miles
    const event = baseEvent({ venue_lat: 36.1627, venue_lng: -86.7816 });
    const result = match(event, {
      type: "radius",
      center_lat: ATLANTA_LAT,
      center_lng: ATLANTA_LNG,
      radius_miles: 30,
    });
    expect(result.has(1)).toBe(false);
  });

  it("radius: returns false when venue_lat/lng is null", () => {
    const event = baseEvent({ venue_lat: null, venue_lng: null });
    const result = match(event, {
      type: "radius",
      center_lat: ATLANTA_LAT,
      center_lng: ATLANTA_LNG,
      radius_miles: 30,
    });
    expect(result.has(1)).toBe(false);
  });

  it("radius: returns false when center coords are missing from payload", () => {
    const event = baseEvent({ venue_lat: DECATUR_LAT, venue_lng: DECATUR_LNG });
    const result = match(event, { type: "radius", radius_miles: 30 });
    expect(result.has(1)).toBe(false);
  });

  // ── neighborhood ──────────────────────────────────────────────────────────

  it("neighborhood: matches when venue_neighborhood is in the list (case-insensitive)", () => {
    const event = baseEvent({ venue_neighborhood: "Midtown" });
    const result = match(event, {
      type: "neighborhood",
      neighborhoods: ["midtown", "buckhead", "old fourth ward"],
    });
    expect(result.has(1)).toBe(true);
  });

  it("neighborhood: does not match a neighborhood outside the list", () => {
    const event = baseEvent({ venue_neighborhood: "Cabbagetown" });
    const result = match(event, {
      type: "neighborhood",
      neighborhoods: ["midtown", "buckhead"],
    });
    expect(result.has(1)).toBe(false);
  });

  it("neighborhood: returns false when venue_neighborhood is null", () => {
    const event = baseEvent({ venue_neighborhood: null });
    const result = match(event, {
      type: "neighborhood",
      neighborhoods: ["midtown"],
    });
    expect(result.has(1)).toBe(false);
  });

  // ── null venue data ───────────────────────────────────────────────────────

  it("returns false for all geo subtypes when event has no venue geo data", () => {
    const event = baseEvent({
      venue_city: null,
      venue_state: null,
      venue_lat: null,
      venue_lng: null,
      venue_neighborhood: null,
    });

    expect(match(event, { type: "city", cities: ["atlanta"] }).has(1)).toBe(false);
    expect(match(event, { type: "state", states: ["GA"] }).has(1)).toBe(false);
    expect(
      match(event, {
        type: "radius",
        center_lat: ATLANTA_LAT,
        center_lng: ATLANTA_LNG,
        radius_miles: 50,
      }).has(1),
    ).toBe(false);
    expect(match(event, { type: "neighborhood", neighborhoods: ["midtown"] }).has(1)).toBe(false);
  });

  // ── unknown geo subtype ───────────────────────────────────────────────────

  it("returns false for an unknown geo subtype", () => {
    const event = baseEvent({ venue_city: "Atlanta" });
    const result = match(event, { type: "country", countries: ["US"] });
    expect(result.has(1)).toBe(false);
  });

  // ── existing rules unaffected ─────────────────────────────────────────────

  it("does not affect non-geo rules — source/tag still work alongside geo", () => {
    const geoChannel = makeChannel("c-geo2", "geo-only");
    const sourceChannel = makeChannel("c-src", "source-only");

    const events: MatchableEvent[] = [
      baseEvent({ id: 10, source_id: 42, venue_city: "Nashville" }),
      baseEvent({ id: 11, source_id: 99, venue_city: "Atlanta" }),
    ];

    const rules = [
      makeRule("c-src", "source", { source_id: 42 }),
      makeRule("c-geo2", "geo", { type: "city", cities: ["atlanta"] }),
    ];

    const result = matchSubscribedChannelsToEvents(events, [geoChannel, sourceChannel], rules);

    // Event 10: matches source rule (source_id 42) but NOT geo (Nashville)
    expect(result.get(10)?.map((m) => m.channel_slug)).toEqual(["source-only"]);
    // Event 11: matches geo rule (Atlanta) but NOT source (source_id 99)
    expect(result.get(11)?.map((m) => m.channel_slug)).toEqual(["geo-only"]);
  });
});
