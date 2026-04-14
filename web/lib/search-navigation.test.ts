import { describe, expect, it } from "vitest";
import { buildSearchResultHref } from "@/lib/search-navigation";
import type { SearchResult } from "@/lib/search/legacy-result-types";

describe("buildSearchResultHref", () => {
  it("preserves explicit hrefs for synthetic search suggestions", () => {
    const result: SearchResult = {
      id: "search:event:music",
      type: "event",
      title: "music",
      href: "/atlanta?view=find&lane=events&search=music",
      score: 700,
    };

    expect(buildSearchResultHref(result, { portalSlug: "atlanta" })).toBe(
      "/atlanta?view=find&lane=events&search=music",
    );
  });
});
