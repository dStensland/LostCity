import { describe, it, expect } from "vitest";
import { tokenize } from "@/lib/search/understanding/tokenize";

describe("tokenize", () => {
  it("splits on whitespace", () => {
    const tokens = tokenize("jazz brunch midtown");
    expect(tokens).toHaveLength(3);
    expect(tokens[0].text).toBe("jazz");
    expect(tokens[1].text).toBe("brunch");
    expect(tokens[2].text).toBe("midtown");
  });

  it("records positional offsets", () => {
    const tokens = tokenize("a bc def");
    expect(tokens[0]).toMatchObject({ start: 0, end: 1 });
    expect(tokens[1]).toMatchObject({ start: 2, end: 4 });
    expect(tokens[2]).toMatchObject({ start: 5, end: 8 });
  });

  it("marks common stopwords", () => {
    const tokens = tokenize("the jazz in midtown");
    expect(tokens.find(t => t.text === "the")?.stop).toBe(true);
    expect(tokens.find(t => t.text === "in")?.stop).toBe(true);
    expect(tokens.find(t => t.text === "jazz")?.stop).toBe(false);
  });

  it("normalizes to lowercase + unaccented", () => {
    const tokens = tokenize("Café");
    expect(tokens[0].normalized).toBe("cafe");
  });

  it("handles empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
});
