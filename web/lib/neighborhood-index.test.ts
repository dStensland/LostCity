import { describe, expect, it } from "vitest";
import { buildNeighborhoodIndexSections } from "@/lib/neighborhood-index";

describe("neighborhood-index", () => {
  it("drops empty neighborhoods and uses clearer section titles", () => {
    const sections = buildNeighborhoodIndexSections({
      Midtown: 9,
      Downtown: 3,
      "Virginia-Highland": 2,
      "Lake Claire": 1,
    });

    expect(sections.map((section) => section.title)).toEqual([
      "Popular",
      "More neighborhoods",
      "Up-and-coming",
    ]);
    expect(sections[0]?.neighborhoods.map((entry) => entry.neighborhood.name)).toEqual([
      "Midtown",
      "Downtown",
    ]);
    expect(sections[1]?.neighborhoods.map((entry) => entry.neighborhood.name)).toEqual([
      "Virginia-Highland",
    ]);
    expect(sections[2]?.neighborhoods.map((entry) => entry.neighborhood.name)).toEqual([
      "Lake Claire",
    ]);
  });

  it("omits empty sections entirely", () => {
    const sections = buildNeighborhoodIndexSections({
      Midtown: 4,
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ title: "Popular" });
  });
});
