import { describe, expect, it } from "vitest";
import {
  daysBetween,
  mapFestivalRow,
  type FestivalHorizonRow,
} from "./festivals-horizon-loader";

function makeRow(overrides: Partial<FestivalHorizonRow> = {}): FestivalHorizonRow {
  return {
    id: "fest-1",
    slug: "music-midtown",
    name: "Music Midtown",
    announced_start: "2026-09-18",
    announced_end: "2026-09-20",
    image_url: "https://example.com/mm.jpg",
    tags: ["rock", "indie"],
    genres: [],
    description: "Atlanta's flagship rock and indie weekend in Piedmont Park.",
    neighborhood: "Midtown",
    location: "Piedmont Park",
    announced_2026: true,
    ...overrides,
  };
}

describe("daysBetween", () => {
  it("returns 0 for same day", () => {
    expect(daysBetween("2026-04-17", "2026-04-17")).toBe(0);
  });

  it("returns 1 for the next day", () => {
    expect(daysBetween("2026-04-17", "2026-04-18")).toBe(1);
  });

  it("returns 90 across a DST transition (spring forward)", () => {
    // 2026-04-17 to 2026-07-16 spans a DST boundary if any; noon anchoring
    // guarantees we don't off-by-one on DST hour shifts.
    expect(daysBetween("2026-04-17", "2026-07-16")).toBe(90);
  });

  it("returns negative for past dates", () => {
    expect(daysBetween("2026-04-17", "2026-04-10")).toBe(-7);
  });
});

describe("mapFestivalRow", () => {
  it("computes days_away correctly from todayStr", () => {
    const row = makeRow({ announced_start: "2026-05-01" });
    const mapped = mapFestivalRow(row, "2026-04-17");
    expect(mapped.days_away).toBe(14);
    expect(mapped.start_date).toBe("2026-05-01");
  });

  it("maps venue_name from location (no place join)", () => {
    const row = makeRow({ location: "Centennial Olympic Park" });
    const mapped = mapFestivalRow(row, "2026-04-17");
    expect(mapped.venue_name).toBe("Centennial Olympic Park");
  });

  it("falls back end_date to announced_start when announced_end is null", () => {
    const row = makeRow({
      announced_start: "2026-06-05",
      announced_end: null,
    });
    const mapped = mapFestivalRow(row, "2026-04-17");
    expect(mapped.end_date).toBe("2026-06-05");
  });

  it("truncates description to 80 chars with no ellipsis", () => {
    const long = "a".repeat(200);
    const mapped = mapFestivalRow(makeRow({ description: long }), "2026-04-17");
    expect(mapped.headliner_teaser).toBe("a".repeat(80));
    expect(mapped.headliner_teaser?.endsWith("...")).toBe(false);
  });

  it("returns null headliner_teaser when description is empty string", () => {
    const mapped = mapFestivalRow(makeRow({ description: "" }), "2026-04-17");
    expect(mapped.headliner_teaser).toBeNull();
  });

  it("returns null headliner_teaser when description is null", () => {
    const mapped = mapFestivalRow(makeRow({ description: null }), "2026-04-17");
    expect(mapped.headliner_teaser).toBeNull();
  });

  it("picks the first matching genre bucket from tags+genres", () => {
    const mapped = mapFestivalRow(
      makeRow({ tags: ["rock", "punk"], genres: ["techno"] }),
      "2026-04-17",
    );
    // MUSIC_GENRE_BUCKETS order puts Rock before Electronic, so Rock wins
    // even though `techno` was seen in the genres list.
    expect(mapped.genre_bucket).toBe("Rock");
  });

  it("returns null genre_bucket when no tags or genres map", () => {
    const mapped = mapFestivalRow(
      makeRow({ tags: ["street-food", "crafts"], genres: [] }),
      "2026-04-17",
    );
    expect(mapped.genre_bucket).toBeNull();
  });

  it("tolerates null tags and null genres", () => {
    const mapped = mapFestivalRow(
      makeRow({ tags: null, genres: null }),
      "2026-04-17",
    );
    expect(mapped.genre_bucket).toBeNull();
  });

  it("passes through image_url, name, slug, neighborhood", () => {
    const mapped = mapFestivalRow(makeRow(), "2026-04-17");
    expect(mapped.id).toBe("fest-1");
    expect(mapped.slug).toBe("music-midtown");
    expect(mapped.name).toBe("Music Midtown");
    expect(mapped.neighborhood).toBe("Midtown");
    expect(mapped.image_url).toBe("https://example.com/mm.jpg");
  });
});
