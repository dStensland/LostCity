import { describe, expect, it } from "vitest";
import { MUSIC_GENRE_BUCKETS, mapTagsToBuckets, tagToBucket } from "./genre-map";

describe("music genre map", () => {
  it("maps specific tags to broad buckets", () => {
    expect(tagToBucket("indie-rock")).toBe("Rock");
    expect(tagToBucket("post-punk")).toBe("Rock");
    expect(tagToBucket("hip-hop")).toBe("Hip-Hop/R&B");
    expect(tagToBucket("house")).toBe("Electronic");
    expect(tagToBucket("bluegrass")).toBe("Country");
  });

  it("returns null for unmapped tags", () => {
    expect(tagToBucket("madrigal")).toBeNull();
    expect(tagToBucket("")).toBeNull();
  });

  it("mapTagsToBuckets dedupes buckets and drops unmapped", () => {
    expect(mapTagsToBuckets(["indie-rock", "post-punk", "jazz"])).toEqual(["Rock", "Jazz/Blues"]);
    expect(mapTagsToBuckets(["madrigal", "chamber"])).toEqual([]);
  });

  it("exposes the 7 buckets in canonical order", () => {
    expect(MUSIC_GENRE_BUCKETS).toEqual([
      "Rock",
      "Hip-Hop/R&B",
      "Electronic",
      "Jazz/Blues",
      "Country",
      "Latin",
      "Pop/Singer-Songwriter",
    ]);
  });

  it("normalizes tag whitespace, case, and underscores", () => {
    expect(tagToBucket("Indie Rock")).toBe("Rock");
    expect(tagToBucket("hip_hop")).toBe("Hip-Hop/R&B");
    expect(tagToBucket("  JAZZ  ")).toBe("Jazz/Blues");
  });

  it("filters out comedy/non-music tags that bleed into genres (stand-up, puppet, karaoke)", () => {
    // These appear in events.genres due to data contamination; the map must not absorb them.
    expect(tagToBucket("stand-up")).toBeNull();
    expect(tagToBucket("puppet")).toBeNull();
    expect(tagToBucket("karaoke")).toBeNull();
    expect(tagToBucket("improv")).toBeNull();
  });
});
