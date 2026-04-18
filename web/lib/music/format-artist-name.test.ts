import { describe, expect, it } from "vitest";
import { formatArtistName } from "./format-artist-name";

describe("formatArtistName", () => {
  it("leaves already-mixed-case names alone", () => {
    expect(formatArtistName("Cardi B")).toBe("Cardi B");
  });

  it("title-cases an all-caps two-word name", () => {
    expect(formatArtistName("JACKIE VENSON")).toBe("Jackie Venson");
  });

  it("title-cases an all-caps three-word name", () => {
    expect(formatArtistName("ALICE PHOEBE LOU")).toBe("Alice Phoebe Lou");
  });

  it("title-cases a longer all-caps phrase", () => {
    expect(formatArtistName("MAINLINE ATL PRESENTS")).toBe("Mainline Atl Presents");
  });

  it("title-cases names with leading numbers", () => {
    expect(formatArtistName("1D NIGHT")).toBe("1D Night");
  });

  it("preserves DJ token in already-mixed names", () => {
    expect(formatArtistName("DJ Shadow")).toBe("DJ Shadow");
  });

  it("leaves short acronyms unchanged (under 4-letter threshold)", () => {
    expect(formatArtistName("AJR")).toBe("AJR");
  });

  it("leaves very short names unchanged", () => {
    expect(formatArtistName("U2")).toBe("U2");
  });

  it("returns empty string unchanged", () => {
    expect(formatArtistName("")).toBe("");
  });
});
