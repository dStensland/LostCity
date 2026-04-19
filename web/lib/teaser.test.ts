import { describe, it, expect } from "vitest";
import { extractTeaser } from "./teaser";

describe("extractTeaser", () => {
  it("returns null for null input", () => {
    expect(extractTeaser(null)).toBeNull();
  });

  it("returns null for too-short input", () => {
    expect(extractTeaser("Short.")).toBeNull();
  });

  it("returns the first sentence when it fits 30-180 chars", () => {
    const desc = "A four-day rock festival anchored at Piedmont Park. Additional details follow here.";
    expect(extractTeaser(desc)).toBe("A four-day rock festival anchored at Piedmont Park.");
  });

  it("truncates at a word boundary with ellipsis if first sentence is too long", () => {
    const desc = "This is a very long first sentence that exceeds the 180-character limit and just keeps going and going with lots of filler words to make sure we actually hit the cap before finding a period somewhere";
    const result = extractTeaser(desc);
    expect(result).toMatch(/…$/);
    expect(result!.length).toBeLessThanOrEqual(161);
    expect(result).not.toMatch(/\w…$/);
  });

  it("returns null when input contains markdown fences", () => {
    expect(extractTeaser("A festival. ```json\n{stuff}\n```")).toBeNull();
  });

  it("returns null when input looks like a URL", () => {
    expect(extractTeaser("https://example.com/very-long-url-that-is-not-a-description")).toBeNull();
  });

  it("returns null for input between 1 and 29 chars", () => {
    expect(extractTeaser("A party.")).toBeNull();
  });
});
