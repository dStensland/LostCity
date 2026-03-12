import type { SearchResult } from "@/lib/unified-search";
import type { SearchSuggestion } from "@/lib/search-suggestions";

export type SearchSuggestionResultMode = "instant" | "preview";

export function mapSuggestionToSearchResult(
  suggestion: SearchSuggestion,
  portalSlug: string,
  mode: SearchSuggestionResultMode,
): SearchResult | null {
  const encoded = encodeURIComponent(suggestion.text);
  const syntheticId = `search:${suggestion.type}:${suggestion.text.toLowerCase()}`;
  const baseScore = 600 + Math.min(suggestion.frequency, 200);

  switch (suggestion.type) {
    case "event":
      return {
        id: syntheticId,
        type: "event",
        title: suggestion.text,
        subtitle: "Search events",
        href: `/${portalSlug}?view=find&type=events&search=${encoded}`,
        score: baseScore,
      };
    case "venue":
      return {
        id: syntheticId,
        type: "venue",
        title: suggestion.text,
        subtitle: "Search destinations",
        href: `/${portalSlug}?view=find&type=destinations&search=${encoded}`,
        score: baseScore - 20,
      };
    case "festival":
      return {
        id: syntheticId,
        type: mode === "preview" ? "event" : "festival",
        title: suggestion.text,
        subtitle: "Search festivals",
        href: `/${portalSlug}?view=find&type=events&search=${encoded}`,
        score: baseScore - 30,
      };
    case "neighborhood":
      return {
        id: syntheticId,
        type: mode === "preview" ? "venue" : "neighborhood",
        title: suggestion.text,
        subtitle: mode === "preview" ? "Neighborhood" : undefined,
        href: `/${portalSlug}?view=find&type=events&neighborhoods=${encoded}`,
        score: baseScore - 40,
      };
    case "category":
      return {
        id: syntheticId,
        type: mode === "preview" ? "event" : "category",
        title: suggestion.text,
        subtitle: mode === "preview" ? "Category" : undefined,
        href: `/${portalSlug}?view=find&type=events&categories=${encoded}`,
        score: baseScore - 50,
      };
    case "tag":
      return {
        id: syntheticId,
        type: mode === "preview" ? "event" : "category",
        title: suggestion.text,
        subtitle: mode === "preview" ? "Tag" : "Tag",
        href: `/${portalSlug}?view=find&type=events&tags=${encoded}`,
        score: baseScore - 55,
      };
    case "vibe":
      return {
        id: syntheticId,
        type: "venue",
        title: suggestion.text,
        subtitle: "Vibe",
        href: `/${portalSlug}?view=find&type=destinations&vibes=${encoded}`,
        score: baseScore - 60,
      };
    case "organizer":
      return null;
    default:
      return null;
  }
}
