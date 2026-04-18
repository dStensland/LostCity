import { describe, it, expect } from "vitest";
import { slugify } from "../goblin-slug";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics with dashes", () => {
    expect(slugify("Sword & Sorcery")).toBe("sword-sorcery");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("  Sword & Sorcery  ")).toBe("sword-sorcery");
    expect(slugify("!!!Movies!!!")).toBe("movies");
  });

  it("collapses runs of non-alphanumerics into a single dash", () => {
    expect(slugify("A — B — C")).toBe("a-b-c");
  });

  it("preserves digits", () => {
    expect(slugify("Top 10 of 2024")).toBe("top-10-of-2024");
  });

  it("falls back to 'group' for empty-after-normalize inputs", () => {
    expect(slugify("")).toBe("group");
    expect(slugify("!!!")).toBe("group");
    expect(slugify("   ")).toBe("group");
  });

  it("handles unicode by stripping it", () => {
    expect(slugify("Café Noir")).toBe("caf-noir");
  });
});
