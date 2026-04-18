import { describe, expect, it } from "vitest";
import { getNeighborhoodHeroStyle } from "@/components/neighborhoods/NeighborhoodHeroStyle";

describe("getNeighborhoodHeroStyle", () => {
  it("returns a gradient composition keyed to the provided color", () => {
    const style = getNeighborhoodHeroStyle("#00D4E8");
    const bg = style.gradient.background as string;
    // RGB of #00D4E8 = 0, 212, 232
    expect(bg).toContain("rgba(0, 212, 232, 0.35)");
    expect(bg).toContain("rgba(0, 212, 232, 0.14)");
    expect(bg).toContain("#0F0F14"); // base dark layer
  });

  it("produces distinct gradients for distinct colors", () => {
    const cyan = getNeighborhoodHeroStyle("#00D4E8").gradient.background;
    const coral = getNeighborhoodHeroStyle("#FF6B7A").gradient.background;
    expect(cyan).not.toEqual(coral);
  });

  it("passes heroImage through to imageSrc when provided", () => {
    const style = getNeighborhoodHeroStyle("#FF6B7A", "/hoods/midtown.jpg");
    expect(style.imageSrc).toBe("/hoods/midtown.jpg");
  });

  it("returns undefined imageSrc when heroImage is absent", () => {
    const style = getNeighborhoodHeroStyle("#FF6B7A");
    expect(style.imageSrc).toBeUndefined();
  });

  it("still returns a valid gradient when no image is provided (designed base)", () => {
    const style = getNeighborhoodHeroStyle("#FF6B7A");
    expect(style.gradient.background).toBeTruthy();
  });
});
