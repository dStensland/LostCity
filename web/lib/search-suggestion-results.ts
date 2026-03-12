import type { SearchResult } from "@/lib/unified-search";
import type { SearchSuggestion } from "@/lib/search-suggestions";
import type { FindType } from "@/lib/find-filter-schema";

export type SearchSuggestionResultMode = "instant" | "preview";

type SearchSuggestionNavigationContext = {
  findType?: FindType | null;
};

function buildFindSearchHref(
  portalSlug: string,
  findType: "events" | "classes" | "destinations",
  query: string,
): string {
  return `/${portalSlug}?view=find&type=${findType}&search=${encodeURIComponent(query)}`;
}

function shouldIncludeSuggestionType(
  suggestionType: SearchSuggestion["type"],
  findType?: FindType | null,
): boolean {
  if (!findType || findType === "events") {
    return true;
  }

  if (findType === "classes") {
    return suggestionType === "event";
  }

  if (findType === "destinations") {
    return (
      suggestionType === "venue" ||
      suggestionType === "neighborhood" ||
      suggestionType === "vibe"
    );
  }

  return true;
}

export function mapSuggestionToSearchResult(
  suggestion: SearchSuggestion,
  portalSlug: string,
  mode: SearchSuggestionResultMode,
  navigationContext: SearchSuggestionNavigationContext = {},
): SearchResult | null {
  if (!shouldIncludeSuggestionType(suggestion.type, navigationContext.findType)) {
    return null;
  }

  const encoded = encodeURIComponent(suggestion.text);
  const syntheticId = `search:${suggestion.type}:${suggestion.text.toLowerCase()}`;
  const baseScore = 600 + Math.min(suggestion.frequency, 200);
  const eventSearchHref = buildFindSearchHref(
    portalSlug,
    navigationContext.findType === "classes" ? "classes" : "events",
    suggestion.text,
  );
  const destinationSearchHref = buildFindSearchHref(
    portalSlug,
    "destinations",
    suggestion.text,
  );

  switch (suggestion.type) {
    case "event":
      return {
        id: syntheticId,
        type: "event",
        title: suggestion.text,
        subtitle:
          navigationContext.findType === "classes"
            ? "Search classes"
            : "Search events",
        href: eventSearchHref,
        score: baseScore,
      };
    case "venue":
      return {
        id: syntheticId,
        type: "venue",
        title: suggestion.text,
        subtitle: "Search places",
        href: destinationSearchHref,
        score: baseScore - 20,
      };
    case "festival":
      return {
        id: syntheticId,
        type: mode === "preview" ? "event" : "festival",
        title: suggestion.text,
        subtitle: "Search festivals",
        href: eventSearchHref,
        score: baseScore - 30,
      };
    case "neighborhood":
      return {
        id: syntheticId,
        type: mode === "preview" ? "venue" : "neighborhood",
        title: suggestion.text,
        subtitle: mode === "preview" ? "Neighborhood" : undefined,
        href:
          navigationContext.findType === "destinations"
            ? `/${portalSlug}?view=find&type=destinations&neighborhoods=${encoded}`
            : `/${portalSlug}?view=find&type=events&neighborhoods=${encoded}`,
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
