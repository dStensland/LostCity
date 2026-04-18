import { describe, expect, it } from "vitest";
import { deriveKicker } from "./derive-kicker";
import type { MusicShowPayload, MusicVenuePayload } from "./types";

function mkVenue(overrides: Partial<MusicVenuePayload> = {}): MusicVenuePayload {
  return {
    id: 1,
    name: "Aisle 5",
    slug: "aisle-5",
    neighborhood: "L5P",
    image_url: null,
    hero_image_url: null,
    music_programming_style: "curated_indie",
    music_venue_formats: [],
    capacity: 250,
    editorial_line: null,
    display_tier: "editorial",
    capacity_band: "club",
    ...overrides,
  };
}

function mkShow(overrides: Partial<MusicShowPayload> = {}): MusicShowPayload {
  return {
    id: 1,
    title: "Show",
    start_date: "2026-04-17",
    start_time: "20:00",
    doors_time: "19:00",
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
    venue: mkVenue(),
    artists: [],
    ...overrides,
  };
}

describe("deriveKicker", () => {
  it("returns null when no signals are present", () => {
    expect(deriveKicker({ venue: mkVenue(), shows: [mkShow()] })).toBeNull();
  });

  it("returns null when shows array is empty", () => {
    expect(deriveKicker({ venue: mkVenue(), shows: [] })).toBeNull();
  });

  it("returns SOLD OUT TONIGHT when every show is sold-out", () => {
    const shows = [
      mkShow({ id: 1, ticket_status: "sold-out" }),
      mkShow({ id: 2, ticket_status: "sold-out" }),
    ];
    expect(deriveKicker({ venue: mkVenue(), shows })).toEqual({
      label: "SOLD OUT TONIGHT",
      tone: "coral",
    });
  });

  it("does NOT return SOLD OUT when only some shows are sold-out", () => {
    const shows = [
      mkShow({ id: 1, ticket_status: "sold-out" }),
      mkShow({ id: 2, ticket_status: null }),
    ];
    expect(deriveKicker({ venue: mkVenue(), shows })).toBeNull();
  });

  it("returns FREE TONIGHT when every show is free", () => {
    const shows = [mkShow({ is_free: true }), mkShow({ id: 2, is_free: true })];
    expect(deriveKicker({ venue: mkVenue(), shows })).toEqual({
      label: "FREE TONIGHT",
      tone: "gold",
    });
  });

  it("returns LATE · AFTER 9 PM when earliest doors >= 21:00", () => {
    const show = mkShow({ doors_time: "21:30", start_time: "22:00" });
    expect(deriveKicker({ venue: mkVenue(), shows: [show] })).toEqual({
      label: "LATE · AFTER 9 PM",
      tone: "muted",
    });
  });

  it("does NOT return LATE when earliest show is before 21:00", () => {
    const shows = [
      mkShow({ id: 1, doors_time: "20:30" }),
      mkShow({ id: 2, doors_time: "22:00" }),
    ];
    expect(deriveKicker({ venue: mkVenue(), shows })).toBeNull();
  });

  it("returns RESIDENCY NIGHT when any show has a residency tag", () => {
    const shows = [mkShow({ tags: ["residency", "indie"] })];
    expect(deriveKicker({ venue: mkVenue(), shows })).toEqual({
      label: "RESIDENCY NIGHT",
      tone: "vibe",
    });
  });

  it("prioritizes SOLD OUT over RESIDENCY", () => {
    const shows = [mkShow({ ticket_status: "sold-out", tags: ["residency"] })];
    expect(deriveKicker({ venue: mkVenue(), shows })?.label).toBe("SOLD OUT TONIGHT");
  });

  it("prioritizes RESIDENCY over FREE", () => {
    const shows = [mkShow({ tags: ["residency"], is_free: true })];
    expect(deriveKicker({ venue: mkVenue(), shows })?.label).toBe("RESIDENCY NIGHT");
  });

  it("prioritizes FREE over LATE", () => {
    const shows = [mkShow({ is_free: true, doors_time: "22:00" })];
    expect(deriveKicker({ venue: mkVenue(), shows })?.label).toBe("FREE TONIGHT");
  });
});
