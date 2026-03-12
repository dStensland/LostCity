import { describe, expect, it } from "vitest";
import { getEditorialSourceLabel } from "./AccoladesSection";

describe("getEditorialSourceLabel", () => {
  it("returns artifact guide labels for new Yonder sources", () => {
    expect(getEditorialSourceLabel("atlas_obscura")).toBe("Atlas Obscura");
    expect(getEditorialSourceLabel("atlanta_trails")).toBe(
      "Atlanta Trails",
    );
    expect(getEditorialSourceLabel("explore_georgia")).toBe(
      "Explore Georgia",
    );
  });

  it("falls back to the raw key for unknown sources", () => {
    expect(getEditorialSourceLabel("unknown_source")).toBe("unknown_source");
  });
});
