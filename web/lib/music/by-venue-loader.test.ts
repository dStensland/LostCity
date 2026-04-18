import { describe, it, expect } from "vitest";
import {
  groupShowsByVenue,
  partitionGroupsByTier,
  type VenueGroup,
} from "./by-venue-loader";
import type {
  MusicDisplayTier,
  MusicShowPayload,
  MusicVenuePayload,
} from "./types";

function makeVenue(
  overrides: Partial<MusicVenuePayload> & {
    id: number;
    slug: string;
    display_tier: MusicDisplayTier;
  },
): MusicVenuePayload {
  return {
    name: overrides.slug,
    neighborhood: null,
    image_url: null,
    hero_image_url: null,
    music_programming_style: null,
    music_venue_formats: [],
    capacity: null,
    editorial_line: null,
    capacity_band: null,
    ...overrides,
  };
}

function makeShow(
  venue: MusicVenuePayload,
  overrides: Partial<MusicShowPayload> = {},
): MusicShowPayload {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? "Show",
    start_date: "2026-04-20",
    start_time: "20:00",
    doors_time: null,
    image_url: null,
    is_free: false,
    is_curator_pick: false,
    is_tentpole: false,
    importance: null,
    festival_id: null,
    ticket_status: null,
    ticket_url: null,
    age_policy: null,
    featured_blurb: null,
    tags: [],
    genres: [],
    genre_buckets: [],
    venue,
    artists: [],
    ...overrides,
  };
}

function makeGroup(
  slug: string,
  tier: MusicDisplayTier,
  id = 1,
): VenueGroup {
  const v = makeVenue({ id, slug, display_tier: tier });
  return { venue: v, shows: [makeShow(v)] };
}

describe("partitionGroupsByTier", () => {
  it("routes pinned slug to my_venues regardless of display tier", () => {
    const g = makeGroup("eddies-attic", "additional", 1);
    const out = partitionGroupsByTier([g], ["eddies-attic"], true);
    expect(out.my_venues).toHaveLength(1);
    expect(out.my_venues[0].venue.slug).toBe("eddies-attic");
    expect(out.additional).toHaveLength(0);
    expect(out.editorial).toHaveLength(0);
    expect(out.marquee).toHaveLength(0);
  });

  it("routes editorial-tier venue (unpinned) to editorial bucket", () => {
    const g = makeGroup("the-earl", "editorial", 2);
    const out = partitionGroupsByTier([g], [], true);
    expect(out.editorial).toHaveLength(1);
    expect(out.editorial[0].venue.slug).toBe("the-earl");
    expect(out.my_venues).toHaveLength(0);
    expect(out.marquee).toHaveLength(0);
  });

  it("routes marquee-tier venue (unpinned) to marquee bucket", () => {
    const g = makeGroup("tabernacle", "marquee", 3);
    const out = partitionGroupsByTier([g], [], true);
    expect(out.marquee).toHaveLength(1);
    expect(out.marquee[0].venue.slug).toBe("tabernacle");
    expect(out.editorial).toHaveLength(0);
  });

  it("routes additional-tier venue to additional when include_additional=true", () => {
    const g = makeGroup("bar-x", "additional", 4);
    const out = partitionGroupsByTier([g], [], true);
    expect(out.additional).toHaveLength(1);
    expect(out.additional[0].venue.slug).toBe("bar-x");
  });

  it("drops additional-tier venue when include_additional=false", () => {
    const g = makeGroup("bar-x", "additional", 4);
    const out = partitionGroupsByTier([g], [], false);
    expect(out.additional).toHaveLength(0);
    expect(out.editorial).toHaveLength(0);
    expect(out.marquee).toHaveLength(0);
    expect(out.my_venues).toHaveLength(0);
  });

  it("partitions a mixed list correctly", () => {
    const groups = [
      makeGroup("eddies-attic", "additional", 1), // pinned
      makeGroup("the-earl", "editorial", 2),
      makeGroup("tabernacle", "marquee", 3),
      makeGroup("random-bar", "additional", 4),
    ];
    const out = partitionGroupsByTier(groups, ["eddies-attic"], true);
    expect(out.my_venues.map((g) => g.venue.slug)).toEqual(["eddies-attic"]);
    expect(out.editorial.map((g) => g.venue.slug)).toEqual(["the-earl"]);
    expect(out.marquee.map((g) => g.venue.slug)).toEqual(["tabernacle"]);
    expect(out.additional.map((g) => g.venue.slug)).toEqual(["random-bar"]);
  });

  it("pin wins over tier for an editorial venue too", () => {
    const g = makeGroup("the-earl", "editorial", 2);
    const out = partitionGroupsByTier([g], ["the-earl"], true);
    expect(out.my_venues).toHaveLength(1);
    expect(out.editorial).toHaveLength(0);
  });
});

describe("groupShowsByVenue", () => {
  it("groups multiple shows at the same venue and sorts by effective start ascending", () => {
    const venue = makeVenue({ id: 1, slug: "v1", display_tier: "editorial" });
    const late = makeShow(venue, { id: 10, start_time: "22:00" });
    const early = makeShow(venue, {
      id: 11,
      doors_time: "18:00",
      start_time: "20:00",
    });
    const middle = makeShow(venue, { id: 12, start_time: "21:00" });

    const groups = groupShowsByVenue([late, early, middle]);
    expect(groups).toHaveLength(1);
    expect(groups[0].shows.map((s) => s.id)).toEqual([11, 12, 10]);
  });

  it("uses doors_time over start_time when sorting", () => {
    const venue = makeVenue({ id: 1, slug: "v1", display_tier: "marquee" });
    // Show A: doors 18:00, start 23:00 — effective 18:00
    // Show B: doors null, start 19:00 — effective 19:00
    const a = makeShow(venue, {
      id: 1,
      doors_time: "18:00",
      start_time: "23:00",
    });
    const b = makeShow(venue, { id: 2, doors_time: null, start_time: "19:00" });
    const groups = groupShowsByVenue([b, a]);
    expect(groups[0].shows.map((s) => s.id)).toEqual([1, 2]);
  });

  it("puts shows at different venues into separate groups", () => {
    const v1 = makeVenue({ id: 1, slug: "v1", display_tier: "editorial" });
    const v2 = makeVenue({ id: 2, slug: "v2", display_tier: "marquee" });
    const groups = groupShowsByVenue([
      makeShow(v1, { id: 1 }),
      makeShow(v2, { id: 2 }),
    ]);
    expect(groups).toHaveLength(2);
    const slugs = groups.map((g) => g.venue.slug).sort();
    expect(slugs).toEqual(["v1", "v2"]);
  });
});
