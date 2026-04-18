import { describe, expect, it } from "vitest";
import { generateNeighborhoodsOverlay } from "@/lib/editorial-templates";

describe("generateNeighborhoodsOverlay", () => {
  it("renders alive_tonight when tonight count > 0", () => {
    const result = generateNeighborhoodsOverlay({
      tonightNeighborhoodCount: 14,
      weekNeighborhoodCount: 30,
    });
    expect(result).toEqual({
      kind: "alive_tonight",
      kicker: "ALIVE TONIGHT",
      headline: "14 neighborhoods have events starting soon",
    });
  });

  it("uses singular 'neighborhood has' for count of 1", () => {
    const result = generateNeighborhoodsOverlay({
      tonightNeighborhoodCount: 1,
      weekNeighborhoodCount: 5,
    });
    expect(result.headline).toBe("1 neighborhood has events starting soon");
  });

  it("falls back to week_scope when tonight is 0 but week > 0", () => {
    const result = generateNeighborhoodsOverlay({
      tonightNeighborhoodCount: 0,
      weekNeighborhoodCount: 22,
    });
    expect(result).toEqual({
      kind: "week_scope",
      kicker: "THIS WEEK",
      headline: "Across Atlanta",
    });
  });

  it("uses provided cityName in week_scope", () => {
    const result = generateNeighborhoodsOverlay({
      tonightNeighborhoodCount: 0,
      weekNeighborhoodCount: 10,
      cityName: "Decatur",
    });
    expect(result.headline).toBe("Across Decatur");
  });

  it("returns none (null copy) when both counts are 0", () => {
    const result = generateNeighborhoodsOverlay({
      tonightNeighborhoodCount: 0,
      weekNeighborhoodCount: 0,
    });
    expect(result).toEqual({
      kind: "none",
      kicker: null,
      headline: null,
    });
  });

  it("never renders a zero-state alive_tonight variant", () => {
    const result = generateNeighborhoodsOverlay({
      tonightNeighborhoodCount: 0,
      weekNeighborhoodCount: 0,
    });
    expect(result.kind).not.toBe("alive_tonight");
  });
});
