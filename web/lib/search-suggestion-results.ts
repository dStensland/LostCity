import type { SearchResult } from "@/lib/unified-search";
import type { SearchSuggestion } from "@/lib/search-suggestions";
import type { FindType } from "@/lib/find-filter-schema";
import { buildExploreUrl } from "@/lib/find-url";

export type SearchSuggestionResultMode = "instant" | "preview";

type SearchSuggestionNavigationContext = {
  findType?: FindType | null;
};

function buildFindSearchHref(
  portalSlug: string,
  findType: "events" | "classes" | "destinations",
  query: string,
): string {
  if (findType === "destinations") {
    return buildExploreUrl({ portalSlug, lane: "places", search: query });
  }
  return buildExploreUrl({
    portalSlug,
    lane: findType === "classes" ? "classes" : "events",
    search: query,
  });
}

function shouldIncludeSuggestionType(
  suggestionType: SearchSuggestion["type"],
  findType?: FindType | null,
): boolean {
  if (!findType || findType === "events") {
    // Programs don't belong in default event search
    return suggestionType !== "program";
  }

  if (findType === "classes") {
    // In classes mode, show both events and programs
    return suggestionType === "event" || suggestionType === "program";
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
        subtitle: navigationContext.findType === "classes" ? "Class" : "Event",
        href: eventSearchHref,
        score: baseScore,
      };
    case "venue":
      return {
        id: syntheticId,
        type: "venue",
        title: suggestion.text,
        subtitle: "Place",
        href: destinationSearchHref,
        score: baseScore - 20,
      };
    case "festival":
      return {
        id: syntheticId,
        type: mode === "preview" ? "event" : "festival",
        title: suggestion.text,
        subtitle: "Festival",
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
            ? buildExploreUrl({
                portalSlug,
                lane: "places",
                extraParams: { neighborhoods: suggestion.text },
              })
            : buildExploreUrl({
                portalSlug,
                lane: "events",
                extraParams: { neighborhoods: suggestion.text },
              }),
        score: baseScore - 40,
      };
    case "category":
      return {
        id: syntheticId,
        type: mode === "preview" ? "event" : "category",
        title: suggestion.text,
        subtitle: mode === "preview" ? "Category" : undefined,
        href: buildExploreUrl({
          portalSlug,
          lane: "events",
          categories: suggestion.text,
        }),
        score: baseScore - 50,
      };
    case "tag":
      return {
        id: syntheticId,
        type: mode === "preview" ? "event" : "category",
        title: suggestion.text,
        subtitle: mode === "preview" ? "Tag" : "Tag",
        href: buildExploreUrl({
          portalSlug,
          lane: "events",
          tags: suggestion.text,
        }),
        score: baseScore - 55,
      };
    case "vibe":
      return {
        id: syntheticId,
        type: "venue",
        title: suggestion.text,
        subtitle: "Vibe",
        href: buildExploreUrl({
          portalSlug,
          lane: "places",
          vibes: suggestion.text,
        }),
        score: baseScore - 60,
      };
    case "program":
      // Programs link to the family portal programs page.
      // These suggestions only appear in classes findType context.
      return {
        id: syntheticId,
        type: "program",
        title: suggestion.text,
        subtitle: "Program",
        href: `/family?view=programs&search=${encoded}`,
        score: baseScore - 10,
      };
    case "exhibition":
      return {
        id: syntheticId,
        type: "exhibition",
        title: suggestion.text,
        subtitle: "Exhibition",
        href: `/arts/exhibitions?search=${encoded}`,
        score: baseScore - 25,
      };
    case "organizer":
      return null;
    default:
      return null;
  }
}
