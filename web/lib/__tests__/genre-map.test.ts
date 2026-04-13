import { describe, it, expect } from "vitest";
import {
  getGenreBuckets,
  getSubgenreLabels,
  formatSubgenreLabel,
  GENRE_BUCKETS,
} from "../genre-map";

describe("getGenreBuckets", () => {
  it("maps rock tags to Rock bucket", () => {
    expect(getGenreBuckets(["indie-rock", "post-punk"])).toEqual(["Rock"]);
  });

  it("maps multiple genre tags to distinct buckets", () => {
    const result = getGenreBuckets(["hip-hop", "jazz", "electronic"]);
    expect(result).toContain("Hip-Hop / R&B");
    expect(result).toContain("Jazz / Blues");
    expect(result).toContain("Electronic / DJ");
    expect(result).toHaveLength(3);
  });

  it("returns empty array for null or empty tags", () => {
    expect(getGenreBuckets(null)).toEqual([]);
    expect(getGenreBuckets([])).toEqual([]);
  });

  it("ignores unmapped tags", () => {
    expect(getGenreBuckets(["outdoor", "family-friendly", "rock"])).toEqual([
      "Rock",
    ]);
  });

  it("deduplicates when multiple tags map to same bucket", () => {
    expect(getGenreBuckets(["rock", "indie-rock", "alt-rock"])).toEqual([
      "Rock",
    ]);
  });
});

describe("getSubgenreLabels", () => {
  it("returns formatted labels for genre-mapped tags only", () => {
    expect(getSubgenreLabels(["indie-rock", "outdoor"])).toEqual([
      "Indie Rock",
    ]);
  });

  it("returns empty array for null", () => {
    expect(getSubgenreLabels(null)).toEqual([]);
  });

  it("returns multiple labels preserving order", () => {
    expect(getSubgenreLabels(["jazz", "hip-hop"])).toEqual([
      "Jazz",
      "Hip Hop",
    ]);
  });
});

describe("formatSubgenreLabel", () => {
  it("formats hyphenated tags to title case", () => {
    expect(formatSubgenreLabel("indie-rock")).toBe("Indie Rock");
    expect(formatSubgenreLabel("hip-hop")).toBe("Hip Hop");
  });

  it("capitalizes single-word tags", () => {
    expect(formatSubgenreLabel("rock")).toBe("Rock");
    expect(formatSubgenreLabel("jazz")).toBe("Jazz");
  });
});
