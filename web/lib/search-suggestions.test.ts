import { describe, expect, it } from "vitest";

import {
  buildSuggestionQueryVariants,
  mergeExpandedSuggestions,
  rerankSuggestionsForQuery,
  type SearchSuggestion,
} from "@/lib/search-suggestions";

describe("buildSuggestionQueryVariants", () => {
  it("expands time-and-category queries into cleaner canonical variants", () => {
    const variants = buildSuggestionQueryVariants("live music tonight");

    expect(variants).toEqual([
      expect.objectContaining({ query: "live music tonight", source: "direct" }),
      expect.objectContaining({ query: "live music", source: "intent" }),
      expect.objectContaining({ query: "music", source: "category" }),
    ]);
  });

  it("normalizes neighborhood aliases into canonical variants", () => {
    const variants = buildSuggestionQueryVariants("o4w brunch");

    expect(variants).toContainEqual(
      expect.objectContaining({
        query: "old fourth ward brunch",
        source: "alias",
      }),
    );
  });
});

describe("mergeExpandedSuggestions", () => {
  it("prefers entity suggestions from expanded variants over taxonomy from the direct query", () => {
    const merged = mergeExpandedSuggestions(
      [
        {
          variant: { query: "live music tonight", source: "direct", priority: 1 },
          suggestions: [
            { text: "music", type: "category", frequency: 40, similarity: 0.9 },
            { text: "live-music", type: "tag", frequency: 20, similarity: 0.8 },
          ] satisfies SearchSuggestion[],
        },
        {
          variant: { query: "music", source: "category", priority: 0.88 },
          suggestions: [
            { text: "Live Music Saturday", type: "event", frequency: 8, similarity: 0.5 },
            { text: "St. James Live", type: "venue", frequency: 5, similarity: 0.42 },
          ] satisfies SearchSuggestion[],
        },
      ],
      4,
    );

    expect(merged.slice(0, 2)).toEqual([
      expect.objectContaining({ text: "Live Music Saturday", type: "event" }),
      expect.objectContaining({ text: "St. James Live", type: "venue" }),
    ]);
  });

  it("keeps location expansions focused on neighborhoods and venues over raw tags", () => {
    const merged = mergeExpandedSuggestions(
      [
        {
          variant: { query: "l5p", source: "direct", priority: 1 },
          suggestions: [
            { text: "l5p", type: "tag", frequency: 28, similarity: 1 },
            { text: "Little Five Points", type: "neighborhood", frequency: 3, similarity: 0.35 },
          ] satisfies SearchSuggestion[],
        },
        {
          variant: { query: "little five points", source: "alias", priority: 0.84 },
          suggestions: [
            { text: "little-five-points", type: "tag", frequency: 120, similarity: 0.7 },
            { text: "Little Five Points", type: "venue", frequency: 2, similarity: 0.65 },
          ] satisfies SearchSuggestion[],
        },
      ],
      4,
    );

    expect(merged.slice(0, 2)).toEqual([
      expect.objectContaining({ text: "Little Five Points", type: "neighborhood" }),
      expect.objectContaining({ text: "Little Five Points", type: "venue" }),
    ]);
  });
});

describe("rerankSuggestionsForQuery", () => {
  it("prioritizes canonical neighborhood suggestions over raw tags for shorthand location queries", () => {
    const ranked = rerankSuggestionsForQuery("l5p", [
      { text: "l5p", type: "tag", frequency: 28, similarity: 1 },
      { text: "Little Five Points", type: "neighborhood", frequency: 3, similarity: 0.35 },
    ]);

    expect(ranked[0]).toMatchObject({
      text: "Little Five Points",
      type: "neighborhood",
    });
  });

  it("demotes generic taxonomy for multi-word event intent queries", () => {
    const ranked = rerankSuggestionsForQuery("live music tonight", [
      { text: "music", type: "category", frequency: 2608, similarity: 0.63 },
      { text: "live-music", type: "tag", frequency: 1584, similarity: 0.57 },
      { text: "Live Music: DJ Night", type: "event", frequency: 5, similarity: 0.72 },
      { text: "live-music", type: "vibe", frequency: 250, similarity: 0.57 },
    ]);

    expect(ranked[0]).toMatchObject({
      text: "Live Music: DJ Night",
      type: "event",
    });
    expect(ranked.at(-1)).toMatchObject({
      text: "live-music",
      type: "tag",
    });
  });

  it("treats leading-article venue names like exact matches for short proper nouns", () => {
    const ranked = rerankSuggestionsForQuery("earl", [
      { text: "Earl Smith Strand Theatre", type: "venue", frequency: 10, similarity: 0.92 },
      { text: "The Earl", type: "venue", frequency: 8, similarity: 0.52 },
      { text: "Earl and Rachel Smith Strand Theatre", type: "venue", frequency: 5, similarity: 0.87 },
    ]);

    expect(ranked[0]).toMatchObject({
      text: "The Earl",
      type: "venue",
    });
  });

  it("prefers the canonical venue over room variants for venue-family proper nouns", () => {
    const ranked = rerankSuggestionsForQuery("masquerade", [
      { text: "The Masquerade - Hell", type: "venue", frequency: 9, similarity: 0.93 },
      { text: "The Masquerade", type: "venue", frequency: 6, similarity: 0.61 },
      { text: "The Masquerade Music Park", type: "venue", frequency: 8, similarity: 0.82 },
    ]);

    expect(ranked[0]).toMatchObject({
      text: "The Masquerade",
      type: "venue",
    });
  });
});
