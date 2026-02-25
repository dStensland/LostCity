import { describe, it, expect } from "vitest";
import { isNaturalLanguageQuery } from "./nl-detect";
import { convertToSearchOptions, type ParsedNLFilters } from "./nl-search";

// ============================================
// Detection Heuristic
// ============================================

describe("isNaturalLanguageQuery", () => {
  describe("returns false for simple keyword queries", () => {
    it.each([
      "comedy",
      "jazz",
      "The Earl",
      "live music",
      "free events",
      "rooftop bars",
      "ab",
      "",
      "comedy tonight",
    ])("'%s' → false", (query) => {
      expect(isNaturalLanguageQuery(query)).toBe(false);
    });
  });

  describe("returns true for natural language queries", () => {
    it.each([
      "outdoor jazz near midtown this weekend",
      "something fun for a date tonight",
      "where can I find live music in Decatur",
      "show me free events this weekend",
      "looking for comedy near buckhead",
      "anything happening tonight in East Atlanta Village",
      "jazz events under $30 this weekend",
      "find me something chill and outdoor",
      "i want to see live music this weekend in midtown",
      "what's happening tonight near me",
    ])("'%s' → true", (query) => {
      expect(isNaturalLanguageQuery(query)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("rejects queries shorter than 8 characters", () => {
      expect(isNaturalLanguageQuery("near me")).toBe(false);
    });

    it("rejects queries with fewer than 3 words", () => {
      expect(isNaturalLanguageQuery("something fun")).toBe(false);
    });

    it("detects price patterns as strong NL signal", () => {
      expect(isNaturalLanguageQuery("events under $50 tonight")).toBe(true);
      expect(isNaturalLanguageQuery("less than $20 comedy shows")).toBe(true);
    });

    it("detects complex time references", () => {
      expect(isNaturalLanguageQuery("live music this weekend outdoors")).toBe(true);
      expect(isNaturalLanguageQuery("events next friday near downtown")).toBe(true);
    });

    it("handles conversational openers", () => {
      expect(isNaturalLanguageQuery("recommend something fun tonight")).toBe(true);
      expect(isNaturalLanguageQuery("suggest a good date night spot")).toBe(true);
    });
  });
});

// ============================================
// Filter → SearchOptions Conversion
// ============================================

describe("convertToSearchOptions", () => {
  it("maps basic filters to SearchOptions", () => {
    const parsed: ParsedNLFilters = {
      searchTerms: "jazz",
      categories: ["music"],
      neighborhoods: ["Midtown"],
      dateFilter: "weekend",
      explanation: "Jazz in Midtown this weekend",
    };

    const options = convertToSearchOptions(parsed);

    expect(options.query).toBe("jazz");
    expect(options.categories).toEqual(["music"]);
    expect(options.neighborhoods).toEqual(["Midtown"]);
    expect(options.dateFilter).toBe("weekend");
    expect(options.useIntentAnalysis).toBe(true);
    expect(options.includeFacets).toBe(true);
  });

  it("merges vibes into tags", () => {
    const parsed: ParsedNLFilters = {
      searchTerms: "",
      tags: ["outdoor"],
      vibes: ["date-night", "chill"],
      explanation: "Outdoor date night",
    };

    const options = convertToSearchOptions(parsed);

    expect(options.tags).toEqual(["outdoor", "date-night", "chill"]);
  });

  it("deduplicates tags and vibes", () => {
    const parsed: ParsedNLFilters = {
      searchTerms: "",
      tags: ["outdoor", "free"],
      vibes: ["chill"],
      explanation: "test",
    };

    const options = convertToSearchOptions(parsed);

    // No duplicates
    expect(options.tags).toEqual(["outdoor", "free", "chill"]);
    expect(new Set(options.tags).size).toBe(options.tags!.length);
  });

  it("passes through portalId and types", () => {
    const parsed: ParsedNLFilters = {
      searchTerms: "comedy",
      explanation: "comedy",
    };

    const options = convertToSearchOptions(parsed, {
      portalId: "portal-123",
      types: ["event", "venue"],
    });

    expect(options.portalId).toBe("portal-123");
    expect(options.types).toEqual(["event", "venue"]);
  });

  it("sets isFree when parsed", () => {
    const parsed: ParsedNLFilters = {
      searchTerms: "",
      isFree: true,
      dateFilter: "tonight",
      explanation: "Free events tonight",
    };

    const options = convertToSearchOptions(parsed);

    expect(options.isFree).toBe(true);
    expect(options.dateFilter).toBe("tonight");
  });

  it("sets limit=20 for filter-only queries (no search terms)", () => {
    const parsed: ParsedNLFilters = {
      searchTerms: "",
      categories: ["music"],
      dateFilter: "weekend",
      explanation: "Music this weekend",
    };

    const options = convertToSearchOptions(parsed);

    expect(options.query).toBe("");
    expect(options.limit).toBe(20);
  });

  it("does not set limit when search terms are present", () => {
    const parsed: ParsedNLFilters = {
      searchTerms: "jazz",
      explanation: "jazz",
    };

    const options = convertToSearchOptions(parsed);

    expect(options.limit).toBeUndefined();
  });

  it("omits undefined filter arrays from options", () => {
    const parsed: ParsedNLFilters = {
      searchTerms: "comedy",
      explanation: "comedy",
    };

    const options = convertToSearchOptions(parsed);

    expect(options.categories).toBeUndefined();
    expect(options.genres).toBeUndefined();
    expect(options.neighborhoods).toBeUndefined();
    expect(options.tags).toBeUndefined();
    expect(options.dateFilter).toBeUndefined();
    expect(options.isFree).toBeUndefined();
  });
});
