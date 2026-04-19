import { describe, it, expect } from "vitest";
import { getBigStuffType } from "./type-derivation";
import type { RawBigStuffItem } from "./types";

const mk = (partial: Partial<RawBigStuffItem>): RawBigStuffItem => ({
  kind: "festival",
  title: "Item",
  festivalType: null,
  category: null,
  ...partial,
});

describe("getBigStuffType", () => {
  it("maps festival_type=festival to 'festival'", () => {
    expect(getBigStuffType(mk({ kind: "festival", festivalType: "festival" }))).toBe("festival");
  });

  it("maps festival_type=convention to 'convention'", () => {
    expect(getBigStuffType(mk({ kind: "festival", festivalType: "convention" }))).toBe("convention");
  });

  it("maps festival_type=conference to 'convention'", () => {
    expect(getBigStuffType(mk({ kind: "festival", festivalType: "conference" }))).toBe("convention");
  });

  it("maps festival_type=community to 'community'", () => {
    expect(getBigStuffType(mk({ kind: "festival", festivalType: "community" }))).toBe("community");
  });

  it("falls back from unknown festival_type to 'festival'", () => {
    expect(getBigStuffType(mk({ kind: "festival", festivalType: null }))).toBe("festival");
  });

  it("tentpole: FIFA World Cup match → 'sports'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "FIFA World Cup 26™ - Spain vs. Cabo Verde" }))).toBe("sports");
  });

  it("tentpole: AJC Peachtree Road Race → 'sports'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "AJC Peachtree Road Race 2026" }))).toBe("sports");
  });

  it("tentpole: NASCAR at Atlanta Motor Speedway → 'sports'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "NASCAR at Atlanta Motor Speedway" }))).toBe("sports");
  });

  it("tentpole: DragonCon → 'convention'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "Dragon Con" }))).toBe("convention");
  });

  it("tentpole: MomoCon → 'convention'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "MomoCon" }))).toBe("convention");
  });

  it("tentpole: Juneteenth Atlanta Parade → 'community'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "Juneteenth Atlanta Parade & Music Festival" }))).toBe("community");
  });

  it("tentpole: Atlanta Streets Alive → 'community'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "Atlanta Streets Alive" }))).toBe("community");
  });

  it("tentpole: music festival title → 'festival'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "Atlanta Jazz Festival", category: "music" }))).toBe("festival");
  });

  it("tentpole: no match → 'other'", () => {
    expect(getBigStuffType(mk({ kind: "tentpole", title: "Some Random Event" }))).toBe("other");
  });
});
