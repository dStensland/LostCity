import { describe, it, expect } from "vitest";
import { SearchInputSchema, parseSearchInput } from "@/lib/search/input-schema";

describe("SearchInputSchema", () => {
  it("accepts minimal valid input", () => {
    const result = SearchInputSchema.parse({ q: "jazz" });
    expect(result.q).toBe("jazz");
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it("rejects empty query", () => {
    expect(() => SearchInputSchema.parse({ q: "" })).toThrow();
  });

  it("rejects query over 120 chars", () => {
    expect(() => SearchInputSchema.parse({ q: "a".repeat(121) })).toThrow();
  });

  it("rejects limit > 50", () => {
    expect(() => SearchInputSchema.parse({ q: "x", limit: 51 })).toThrow();
  });

  it("rejects offset > 500", () => {
    expect(() => SearchInputSchema.parse({ q: "x", offset: 501 })).toThrow();
  });

  it("rejects invalid facet slug", () => {
    expect(() => SearchInputSchema.parse({ q: "x", categories: ["bad slug!"] })).toThrow();
  });

  it("rejects too many facets", () => {
    const many = Array.from({ length: 21 }, (_, i) => `c_${i}`);
    expect(() => SearchInputSchema.parse({ q: "x", categories: many })).toThrow();
  });

  it("accepts valid locale", () => {
    expect(SearchInputSchema.parse({ q: "x", locale: "en" }).locale).toBe("en");
    expect(SearchInputSchema.parse({ q: "x", locale: "en-US" }).locale).toBe("en-US");
  });

  it("rejects malformed locale", () => {
    expect(() => SearchInputSchema.parse({ q: "x", locale: "english" })).toThrow();
  });

  it("accepts valid date window enum", () => {
    for (const d of ["today", "tomorrow", "weekend", "week"]) {
      expect(SearchInputSchema.parse({ q: "x", date: d }).date).toBe(d);
    }
  });

  it("rejects bogus date window", () => {
    expect(() => SearchInputSchema.parse({ q: "x", date: "next_year" })).toThrow();
  });

  it("accepts price tier 1-4", () => {
    expect(SearchInputSchema.parse({ q: "x", price: 2 }).price).toBe(2);
  });

  it("rejects price > 4", () => {
    expect(() => SearchInputSchema.parse({ q: "x", price: 5 })).toThrow();
  });

  it("coerces string 'true' to boolean free=true", () => {
    const r = SearchInputSchema.parse({ q: "x", free: "true" });
    expect(r.free).toBe(true);
  });

  it("does NOT accept portal_id", () => {
    // portal_id must come from route segment, never query string
    const result = SearchInputSchema.parse({ q: "x", portal_id: "some-uuid" });
    // Zod strips unknown fields by default; portal_id should not appear in the parsed result
    expect((result as Record<string, unknown>).portal_id).toBeUndefined();
  });
});

describe("parseSearchInput", () => {
  it("parses URL params with comma-separated arrays", () => {
    const sp = new URLSearchParams("q=jazz&categories=music,comedy");
    const input = parseSearchInput(sp);
    expect(input.q).toBe("jazz");
    expect(input.categories).toEqual(["music", "comedy"]);
  });

  it("applies NFKC normalization to q", () => {
    const sp = new URLSearchParams();
    sp.set("q", "ｊａｚｚ"); // fullwidth
    const input = parseSearchInput(sp);
    expect(input.q).toBe("jazz");
  });

  it("strips control chars from q", () => {
    const sp = new URLSearchParams();
    sp.set("q", "a\u0000b");
    const input = parseSearchInput(sp);
    expect(input.q).toBe("a b");
  });

  it("parses limit and offset as numbers", () => {
    const sp = new URLSearchParams("q=jazz&limit=10&offset=20");
    const input = parseSearchInput(sp);
    expect(input.limit).toBe(10);
    expect(input.offset).toBe(20);
  });

  it("parses free=true as boolean", () => {
    const sp = new URLSearchParams("q=jazz&free=true");
    const input = parseSearchInput(sp);
    expect(input.free).toBe(true);
  });

  it("rejects oversized query via parseSearchInput", () => {
    const sp = new URLSearchParams();
    sp.set("q", "a".repeat(200));
    // parseSearchInput runs Zod first (which caps at 120) then normalizes
    // The Zod schema will reject before normalization
    expect(() => parseSearchInput(sp)).toThrow();
  });

  // E-3.4 order-of-operations guard. The invariant is: validate first,
  // normalize second. These tests pin that order so future refactors can't
  // silently let normalization mask malformed input.
  describe("validate-then-normalize order", () => {
    it("rejects raw oversized input BEFORE normalization could trim it", () => {
      // 121 chars of 'a' — Zod max is 120. If normalization ran first and
      // collapsed whitespace, the value would still be 121 and rejected,
      // but this test specifically pins the raw-input path.
      const sp = new URLSearchParams();
      sp.set("q", "a".repeat(121));
      expect(() => parseSearchInput(sp)).toThrow();
    });

    it("rejects post-normalization empty input via ZodError", () => {
      // "\u0000" passes z.string().min(1) but normalizes to "". The post-
      // normalize guard catches this and raises a ZodError matching the
      // custom 'query is empty after normalization' message.
      const sp = new URLSearchParams();
      sp.set("q", "\u0000");
      expect(() => parseSearchInput(sp)).toThrow(/empty after normalization/);
    });

    it("does NOT reject whitespace-padded raw input below the max boundary", () => {
      // "jazz" + 100 spaces = 104 chars — Zod accepts (104 ≤ 120).
      // Normalization collapses whitespace to "jazz". This works because
      // validate-first accepts 104 chars of whitespace as long as the
      // total is under 120.
      const sp = new URLSearchParams();
      sp.set("q", "jazz" + " ".repeat(100));
      const input = parseSearchInput(sp);
      expect(input.q).toBe("jazz");
    });
  });
});
