import { describe, it, expect } from "vitest";
import { normalizeSearchQuery } from "@/lib/search/normalize";

describe("normalizeSearchQuery", () => {
  it("collapses whitespace", () => {
    expect(normalizeSearchQuery("  jazz    brunch  ")).toBe("jazz brunch");
  });

  it("preserves case", () => {
    expect(normalizeSearchQuery("JAZZ")).toBe("JAZZ");
  });

  it("strips control characters", () => {
    expect(normalizeSearchQuery("a\u0000b\u001Fc")).toBe("a b c");
  });

  it("strips zero-width and BOM", () => {
    expect(normalizeSearchQuery("a\u200Bb\uFEFFc")).toBe("abc");
  });

  it("normalizes fullwidth to ASCII via NFKC", () => {
    expect(normalizeSearchQuery("ｊａｚｚ")).toBe("jazz");
  });

  it("clamps to 120 chars", () => {
    const long = "a".repeat(500);
    expect(normalizeSearchQuery(long).length).toBe(120);
  });

  it("handles empty string", () => {
    expect(normalizeSearchQuery("")).toBe("");
  });

  it("handles whitespace-only", () => {
    expect(normalizeSearchQuery("   ")).toBe("");
  });
});
