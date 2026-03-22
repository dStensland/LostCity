import { describe, expect, it } from "vitest";

import { mapSuggestionToSearchResult } from "@/lib/search-suggestion-results";

describe("mapSuggestionToSearchResult", () => {
  it("routes event suggestions to classes search in classes mode", () => {
    const result = mapSuggestionToSearchResult(
      {
        text: "Ceramics",
        type: "event",
        frequency: 12,
      },
      "atlanta",
      "instant",
      { findType: "classes" },
    );

    expect(result).toMatchObject({
      type: "event",
      subtitle: "Class",
      href: "/atlanta?view=happening&search=Ceramics",
    });
  });

  it("drops venue suggestions in classes mode", () => {
    const result = mapSuggestionToSearchResult(
      {
        text: "Callanwolde",
        type: "venue",
        frequency: 8,
      },
      "atlanta",
      "instant",
      { findType: "classes" },
    );

    expect(result).toBeNull();
  });

  it("keeps destination suggestion routing in destinations mode", () => {
    const result = mapSuggestionToSearchResult(
      {
        text: "Rooftop",
        type: "vibe",
        frequency: 18,
      },
      "atlanta",
      "instant",
      { findType: "destinations" },
    );

    expect(result).toMatchObject({
      type: "venue",
      href: "/atlanta?view=places&vibes=Rooftop",
    });
  });
});
