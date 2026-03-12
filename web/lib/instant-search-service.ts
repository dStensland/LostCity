import type { ViewMode, FindType } from "@/lib/search-context";
import {
  type SearchContext,
  rankResults,
  detectQuickActions,
  groupResultsByType,
  getGroupDisplayOrder,
} from "@/lib/search-ranking";
import {
  buildDirectQueryFallbackResults,
  type PreviewSearchType,
} from "@/lib/search-preview";
import { analyzeQueryIntent } from "@/lib/query-intent";
import {
  getSearchSuggestionsWithFallback,
} from "@/lib/search-suggestions";
import { instantSearch, type SearchResult } from "@/lib/unified-search";
import { mapSuggestionToSearchResult } from "@/lib/search-suggestion-results";

export type InstantSearchEntityType =
  | "event"
  | "venue"
  | "organizer"
  | "series"
  | "list"
  | "festival";

export type InstantSearchPayload = {
  suggestions: SearchResult[];
  topResults: SearchResult[];
  quickActions: ReturnType<typeof detectQuickActions>;
  groupedResults: Record<string, SearchResult[]>;
  groupOrder: string[];
  facets: { type: string; count: number }[];
  intent?: {
    type: string;
    confidence: number;
    dateFilter?: string;
  };
};

type TimingRecorder = {
  measure<T>(name: string, fn: () => Promise<T> | T, desc?: string): Promise<T>;
};

function dedupeSearchResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const result of results) {
    const key = `${result.type}:${String(result.id)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}

function isTaxonomyResult(result: SearchResult): boolean {
  return result.type === "category" || result.type === "neighborhood";
}

function isEntityResult(result: SearchResult): boolean {
  return !isTaxonomyResult(result);
}

function isGenericVenueSuggestion(result: SearchResult): boolean {
  return result.type === "venue" && result.subtitle === "Vibe";
}

function tuneFastPathSuggestionScores(
  query: string,
  findType: FindType,
  results: SearchResult[],
): SearchResult[] {
  const intent = analyzeQueryIntent(query);
  const hasMultipleWords = /\s/.test(query.trim());
  const isLocationFilterQuery =
    findType === "events" &&
    intent.intent === "location" &&
    results.some((result) => result.type === "neighborhood");
  const isEventIntent =
    findType === "events" &&
    hasMultipleWords &&
    (intent.intent === "time" ||
      intent.intent === "category" ||
      intent.intent === "series" ||
      intent.intent === "general");

  if (isLocationFilterQuery) {
    return results.map((result) => {
      if (result.type === "neighborhood") {
        return {
          ...result,
          score: Math.max(result.score, 820),
        };
      }

      if (result.type === "venue") {
        return {
          ...result,
          score: Math.max(result.score, 720),
        };
      }

      if (result.type === "event") {
        return {
          ...result,
          score: Math.min(result.score, 760),
        };
      }

      return result;
    });
  }

  if (!isEventIntent) {
    return results;
  }

  return results.map((result) => {
    if (result.type === "event") {
      return {
        ...result,
        score: Math.max(result.score, 760),
      };
    }

    if (result.type === "category") {
      return {
        ...result,
        score: Math.max(Math.min(result.score, 540), 420),
      };
    }

    if (isGenericVenueSuggestion(result)) {
      return {
        ...result,
        score: Math.min(result.score, 260),
      };
    }

    return result;
  });
}

function boostDirectQueryFallbackResults(
  results: SearchResult[],
  query: string,
  findType: FindType,
): SearchResult[] {
  if (findType !== "events" || !/\s/.test(query.trim())) {
    return results;
  }

  return results.map((result) => {
    if (typeof result.id !== "string" || !result.id.startsWith("search:query:")) {
      return result;
    }

    if (result.type === "event") {
      return {
        ...result,
        score: Math.max(result.score, 900),
      };
    }

    if (result.type === "venue") {
      return {
        ...result,
        score: Math.max(result.score, 680),
      };
    }

    return result;
  });
}

function composeFastPathResults(params: {
  query: string;
  limit: number;
  findType: FindType;
  mappedResults: SearchResult[];
  directQueryFallbackResults: SearchResult[];
}): SearchResult[] {
  const {
    query,
    limit,
    findType,
    mappedResults,
    directQueryFallbackResults,
  } = params;

  const intent = analyzeQueryIntent(query);
  const hasMultipleWords = /\s/.test(query.trim());
  const directEventResult = directQueryFallbackResults.find((result) => result.type === "event");
  const directVenueResult = directQueryFallbackResults.find((result) => result.type === "venue");
  const entityResults = mappedResults.filter(isEntityResult);
  const taxonomyResults = mappedResults.filter(isTaxonomyResult);

  if (findType === "events") {
    const prominentEntityResults = entityResults.filter((result) => !isGenericVenueSuggestion(result));
    const genericVenueSuggestions = entityResults.filter(isGenericVenueSuggestion);
    const neighborhoodResults = taxonomyResults.filter((result) => result.type === "neighborhood");
    const otherTaxonomyResults = taxonomyResults.filter((result) => result.type !== "neighborhood");
    const shouldLeadWithLocationFilter =
      intent.intent === "location" &&
      neighborhoodResults.length > 0 &&
      (mappedResults[0]?.type === "neighborhood" || !hasMultipleWords);
    const shouldLeadWithDirectEvent =
      Boolean(directEventResult) &&
      !shouldLeadWithLocationFilter &&
      (
        hasMultipleWords ||
        intent.intent === "time" ||
        intent.intent === "category" ||
        entityResults.length === 0
      );

    if (shouldLeadWithLocationFilter) {
      return dedupeSearchResults([
        ...neighborhoodResults.slice(0, 1),
        ...prominentEntityResults,
        ...otherTaxonomyResults.slice(0, 1),
        ...(genericVenueSuggestions.length > 0 ? genericVenueSuggestions.slice(0, 1) : []),
        ...(directEventResult ? [directEventResult] : []),
        ...(entityResults.length === 0 && directVenueResult ? [directVenueResult] : []),
      ]).slice(0, limit);
    }

    const orderedResults = dedupeSearchResults([
      ...(shouldLeadWithDirectEvent && directEventResult ? [directEventResult] : []),
      ...prominentEntityResults,
      ...taxonomyResults.slice(0, hasMultipleWords ? 1 : 2),
      ...(hasMultipleWords ? genericVenueSuggestions.slice(0, 1) : genericVenueSuggestions),
      ...(!shouldLeadWithDirectEvent && directEventResult ? [directEventResult] : []),
      ...(entityResults.length === 0 && directVenueResult ? [directVenueResult] : []),
    ]);

    return orderedResults.slice(0, limit);
  }

  if (findType === "classes") {
    return dedupeSearchResults([
      ...(directEventResult ? [directEventResult] : []),
      ...entityResults,
    ]).slice(0, limit);
  }

  if (findType === "destinations") {
    return dedupeSearchResults([
      ...entityResults,
      ...taxonomyResults,
      ...(entityResults.length === 0 && directVenueResult ? [directVenueResult] : []),
    ]).slice(0, limit);
  }

  return dedupeSearchResults([
    ...entityResults,
    ...taxonomyResults,
    ...directQueryFallbackResults,
  ]).slice(0, limit);
}

function getDefaultInstantTypes(params: {
  requestedTypes?: InstantSearchEntityType[];
  includeOrganizers: boolean;
  findType: FindType;
  trimmedQuery: string;
}) {
  const { requestedTypes, includeOrganizers, findType, trimmedQuery } = params;
  if (requestedTypes && requestedTypes.length > 0) {
    return requestedTypes;
  }

  if (findType === "classes") {
    return ["event"] as const;
  }

  if (findType === "destinations") {
    return ["venue"] as const;
  }

  if (includeOrganizers) {
    return trimmedQuery.length >= 4
      ? (["event", "venue", "organizer"] as const)
      : (["event", "venue"] as const);
  }

  return ["event", "venue"] as const;
}

export async function buildInstantSearchPayload(options: {
  query: string;
  limit: number;
  portalId?: string | null;
  portalSlug: string;
  portalCity?: string;
  viewMode: ViewMode;
  findType: FindType;
  includeOrganizers?: boolean;
  requestedTypes?: InstantSearchEntityType[];
  timing: TimingRecorder;
}): Promise<InstantSearchPayload> {
  const {
    query,
    limit,
    portalId,
    portalSlug,
    portalCity,
    viewMode,
    findType,
    includeOrganizers = false,
    requestedTypes,
    timing,
  } = options;

  const context: SearchContext = {
    viewMode,
    findType,
    portalSlug,
    portalId: portalId || undefined,
  };

  const trimmedQuery = query.trim();
  const instantTypes = getDefaultInstantTypes({
    requestedTypes,
    includeOrganizers,
    findType,
    trimmedQuery,
  });
  const previewTypes = instantTypes.filter(
    (type): type is PreviewSearchType =>
      type === "event" || type === "venue" || type === "organizer",
  );
  const searchLimit = Math.min(limit * 2, limit + 4);
  const suggestionFastPathEligible =
    trimmedQuery.length <= 24 &&
    !includeOrganizers &&
    instantTypes.every((type) => type === "event" || type === "venue");

  const result = await timing.measure("instant_search", async () => {
    if (suggestionFastPathEligible) {
      const suggestionRows = await timing.measure("instant_suggestions", () =>
        getSearchSuggestionsWithFallback(
          trimmedQuery,
          searchLimit,
          portalCity,
        ),
      );
      const mappedResults = suggestionRows
        .map((suggestion) =>
          mapSuggestionToSearchResult(suggestion, portalSlug, "instant", {
            findType,
          }),
        )
        .filter((mapped): mapped is SearchResult => mapped !== null);
      const tunedMappedResults = tuneFastPathSuggestionScores(
        trimmedQuery,
        findType,
        mappedResults,
      );
      const directQueryFallbackResults = boostDirectQueryFallbackResults(
        buildDirectQueryFallbackResults(
          trimmedQuery,
          portalSlug,
          previewTypes.length > 0 ? previewTypes : ["event"],
          findType,
        ),
        trimmedQuery,
        findType,
      );
      const shouldAppendDirectQueryFallback =
        directQueryFallbackResults.length > 0 &&
        (
          mappedResults.length === 0 ||
          (trimmedQuery.length >= 4 && mappedResults.length < limit) ||
          (findType === "events" && /\s/.test(trimmedQuery))
        );
      const fastPathResults = composeFastPathResults({
        query: trimmedQuery,
        limit: searchLimit,
        findType,
        mappedResults: tunedMappedResults,
        directQueryFallbackResults: shouldAppendDirectQueryFallback
          ? directQueryFallbackResults
          : [],
      });

      if (fastPathResults.length > 0) {
        const grouped = groupResultsByType(fastPathResults);
        return {
          results: fastPathResults,
          facets: Object.entries(grouped)
            .filter(([, items]) => items.length > 0)
            .map(([type, items]) => ({
              type: type as SearchResult["type"],
              count: items.length,
            })),
        };
      }
    }

    const rpcResult = await timing.measure("instant_rpc_fallback", () =>
      instantSearch(query, {
        portalId: portalId ?? undefined,
        city: portalCity,
        limit: searchLimit,
        types: previewTypes.length > 0 ? previewTypes : ["event"],
        includeFacets: false,
        includeDidYouMean: false,
        includeEventPopularitySignals: false,
        timingRecorder: timing,
      }),
    );

    return {
      results: [...rpcResult.suggestions, ...rpcResult.topResults],
      facets: rpcResult.facets,
      intent: rpcResult.intent,
    };
  });

  const rankedResults = rankResults(result.results, context);
  const quickActions = detectQuickActions(query, portalSlug, context);
  const groupedResults = groupResultsByType(rankedResults);
  const groupOrder = getGroupDisplayOrder(context);
  const facets = result.facets ?? [];

  const intent =
    "intent" in result
      ? (result.intent as InstantSearchPayload["intent"])
      : undefined;

  return {
    suggestions: rankedResults.slice(0, limit),
    topResults: rankedResults.slice(limit, limit * 2),
    quickActions,
    groupedResults,
    groupOrder,
    facets,
    intent,
  };
}
