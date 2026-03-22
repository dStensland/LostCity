"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from "@/lib/searchHistory";
import {
  trackSearchQuery,
  trackSearchZeroResults,
} from "@/lib/analytics/find-tracking";
import {
  type QuickAction,
  rankResults,
  detectQuickActions,
  groupResultsByType,
  getGroupDisplayOrder,
  type SearchContext as RankingContext,
} from "@/lib/search-ranking";
import { type SearchResult } from "@/lib/unified-search";
import type { FindType as SearchContextFindType } from "@/lib/search-context";
import { buildStableInstantSearchCacheKey } from "@/lib/search-cache-key";

const INSTANT_SEARCH_CLIENT_CACHE_TTL_MS = 20 * 1000;
const INSTANT_SEARCH_CLIENT_CACHE_MAX_ENTRIES = 100;
const instantSearchClientCache = new Map<
  string,
  { data: InstantSearchResponse; expiresAt: number }
>();

function pruneInstantSearchClientCache() {
  const now = Date.now();

  for (const [key, value] of instantSearchClientCache.entries()) {
    if (value.expiresAt <= now) {
      instantSearchClientCache.delete(key);
    }
  }

  if (instantSearchClientCache.size > INSTANT_SEARCH_CLIENT_CACHE_MAX_ENTRIES) {
    const overflow =
      instantSearchClientCache.size - INSTANT_SEARCH_CLIENT_CACHE_MAX_ENTRIES;
    const keys = Array.from(instantSearchClientCache.keys()).slice(0, overflow);
    for (const key of keys) {
      instantSearchClientCache.delete(key);
    }
  }
}

function getLongestPrefixCachedInstantSearch(
  params: URLSearchParams,
  query: string,
): InstantSearchResponse | null {
  const normalizedQuery = query.trim();
  for (let length = normalizedQuery.length - 1; length >= 2; length -= 1) {
    const prefixParams = new URLSearchParams(params);
    prefixParams.set("q", normalizedQuery.slice(0, length));
    const prefixKey = buildStableInstantSearchCacheKey(prefixParams);
    const cached = instantSearchClientCache.get(prefixKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }
  return null;
}

// ============================================
// Types
// ============================================

export interface InstantSearchResponse {
  suggestions: (SearchResult & { personalizationReason?: string })[];
  topResults: SearchResult[];
  quickActions: QuickAction[];
  groupedResults: Record<string, SearchResult[]>;
  groupOrder: string[];
  facets?: { type: string; count: number }[];
  intent?: {
    type: string;
    confidence: number;
    dateFilter?: string;
  };
}

export type IntentType = "time" | "location" | "category" | "venue" | "organizer" | "series" | "general";

export interface UseInstantSearchOptions {
  portalSlug: string;
  portalId?: string;
  findType?: string | null;
  debounceMs?: number;
  enabled?: boolean;
  /** Ranking context overrides */
  viewMode?: "feed" | "find" | "community";
  userPreferences?: RankingContext["userPreferences"];
}

export interface UseInstantSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  isLoading: boolean;
  suggestions: (SearchResult & { personalizationReason?: string })[];
  quickActions: QuickAction[];
  groupedResults: Record<SearchResult["type"], SearchResult[]>;
  groupOrder: SearchResult["type"][];
  facets: { type: string; count: number }[];
  recentSearches: string[];
  totalResultCount: number;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  selectSuggestion: (result: SearchResult) => void;
  selectQuickAction: (action: QuickAction) => void;
  selectRecentSearch: (term: string) => void;
  removeRecent: (term: string, e: React.MouseEvent) => void;
  clearRecent: () => void;
  clear: () => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  handleFocus: () => void;
  handleBlur: () => void;
  /** Whether the dropdown should render */
  shouldShowDropdown: boolean;
  /** Whether recent searches section should show */
  showRecent: boolean;
  /** Whether suggestions section should show */
  showSuggestions: boolean;
  /** Whether quick actions section should show */
  showQuickActions: boolean;
  /** Flat items list for keyboard navigation indexing */
  allItems: AllItem[];
  /** Intent type from API */
  intentType: IntentType | null;
}

export type AllItem =
  | { type: "recent"; text: string }
  | { type: "quickAction"; action: QuickAction }
  | { type: "suggestion"; result: SearchResult & { personalizationReason?: string } };

// ============================================
// Deduplication Utilities
// ============================================

function dedupeResultsByIdentity<T extends SearchResult>(results: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const result of results) {
    const key = `${result.type}:${String(result.id)}`;
    const existing = byKey.get(key);
    if (!existing || result.score > existing.score) {
      byKey.set(key, result);
    }
  }
  return Array.from(byKey.values());
}

function normalizeSearchText(value?: string): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function dedupeResultsSemantically<T extends SearchResult>(results: T[]): T[] {
  const identityDeduped = dedupeResultsByIdentity(results);
  const semanticSeen = new Set<string>();
  const deduped: T[] = [];

  for (const result of identityDeduped) {
    const shouldUseSemanticKey =
      result.type === "event" || result.type === "venue" || result.type === "organizer";

    if (!shouldUseSemanticKey) {
      deduped.push(result);
      continue;
    }

    const semanticKey = [
      result.type,
      normalizeSearchText(result.title),
      normalizeSearchText(result.subtitle),
      result.metadata?.date || "",
      result.metadata?.time || "",
    ].join(":");

    if (semanticSeen.has(semanticKey)) {
      continue;
    }
    semanticSeen.add(semanticKey);
    deduped.push(result);
  }

  return deduped;
}

export function dedupeGroupedResults(
  grouped: Record<string, SearchResult[]>
): Record<string, SearchResult[]> {
  const output: Record<string, SearchResult[]> = {};
  for (const [type, results] of Object.entries(grouped)) {
    output[type] = dedupeResultsSemantically(results);
  }
  return output;
}

function dedupeQuickActions(actions: QuickAction[]): QuickAction[] {
  const byId = new Map<string, QuickAction>();
  for (const action of actions) {
    if (!byId.has(action.id)) {
      byId.set(action.id, action);
    }
  }
  return Array.from(byId.values());
}

export function getIntentAwareGroupOrder(
  baseOrder: SearchResult["type"][],
  intentType: IntentType | null,
  query: string
): SearchResult["type"][] {
  const intentOrderMap: Partial<Record<IntentType, SearchResult["type"][]>> = {
    time: ["event", "festival", "series", "venue", "organizer", "list", "neighborhood", "category"],
    category: ["event", "festival", "series", "venue", "organizer", "list", "neighborhood", "category"],
    venue: ["venue", "event", "neighborhood", "festival", "organizer", "series", "list", "category"],
    location: ["venue", "neighborhood", "event", "festival", "organizer", "series", "list", "category"],
    organizer: ["organizer", "event", "series", "venue", "festival", "list", "neighborhood", "category"],
    series: ["series", "event", "venue", "organizer", "festival", "list", "neighborhood", "category"],
  };

  const trimmed = query.trim().toLowerCase();
  const liveLike = /\blive\b/.test(trimmed);
  const preferredByIntent = intentType ? intentOrderMap[intentType] : undefined;
  const preferred = preferredByIntent || (liveLike
    ? ["event", "venue", "series", "festival", "organizer", "list", "neighborhood", "category"]
    : baseOrder);

  return Array.from(new Set([...preferred, ...baseOrder]));
}

// ============================================
// Hook
// ============================================

export function useInstantSearch({
  portalSlug,
  portalId,
  findType,
  debounceMs = 100,
  enabled = true,
  viewMode = "find",
  userPreferences,
}: UseInstantSearchOptions): UseInstantSearchReturn {
  // State
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<(SearchResult & { personalizationReason?: string })[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [facets, setFacets] = useState<{ type: string; count: number }[]>([]);
  const [apiGroupedResults, setApiGroupedResults] = useState<Record<string, SearchResult[]>>({});
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      return getRecentSearches();
    }
    return [];
  });
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [intentType, setIntentType] = useState<IntentType | null>(null);

  // Refs
  const fetchIdRef = useRef(0);
  const analyticsTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  // Build ranking context
  const rankingContext = useMemo<RankingContext>(() => ({
    viewMode,
    findType: (findType || null) as SearchContextFindType,
    portalSlug,
    portalId,
    userPreferences,
  }), [viewMode, findType, portalSlug, portalId, userPreferences]);

  // Fetch suggestions as user types
  useEffect(() => {
    if (!enabled) return;

    if (query.length < 2) {
      setSuggestions([]);
      setQuickActions([]);
      setFacets([]);
      setApiGroupedResults({});
      setIntentType(null);
      return;
    }

    const fetchId = ++fetchIdRef.current;

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          limit: "8",
          portalSlug,
          viewMode,
        });
        if (findType) {
          params.set("findType", findType);
        }
        params.set("portal", portalSlug);
        if (portalId) {
          params.set("portal_id", portalId);
        }

        const cacheKey = buildStableInstantSearchCacheKey(params);
        const cached = instantSearchClientCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          const rankedResults = dedupeResultsSemantically(
            rankResults(cached.data.suggestions, rankingContext)
          );
          const fallbackActions = detectQuickActions(query, portalSlug, rankingContext);
          const nextQuickActions = dedupeQuickActions(
            cached.data.quickActions || fallbackActions
          );

          setSuggestions(rankedResults);
          setQuickActions(nextQuickActions);
          setFacets(cached.data.facets || []);
          setApiGroupedResults(dedupeGroupedResults(cached.data.groupedResults || {}));
          setIntentType((cached.data.intent?.type as IntentType | undefined) || null);
          setSelectedIndex(-1);
          return;
        }

        const prefixCached = getLongestPrefixCachedInstantSearch(params, query);
        if (prefixCached) {
          const rankedResults = dedupeResultsSemantically(
            rankResults(prefixCached.suggestions, rankingContext)
          );
          const fallbackActions = detectQuickActions(query, portalSlug, rankingContext);
          const nextQuickActions = dedupeQuickActions(
            prefixCached.quickActions || fallbackActions
          );

          setSuggestions(rankedResults);
          setQuickActions(nextQuickActions);
          setFacets(prefixCached.facets || []);
          setApiGroupedResults(
            dedupeGroupedResults(prefixCached.groupedResults || {})
          );
          setIntentType(
            (prefixCached.intent?.type as IntentType | undefined) || null
          );
          setSelectedIndex(-1);
        }

        setIsLoading(true);
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch(`/api/search/instant?${params.toString()}`, {
          signal: controller.signal,
        });

        if (fetchId !== fetchIdRef.current) return; // Stale request

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data: InstantSearchResponse = await response.json();
        instantSearchClientCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + INSTANT_SEARCH_CLIENT_CACHE_TTL_MS,
        });
        pruneInstantSearchClientCache();

        const rankedResults = dedupeResultsSemantically(
          rankResults(data.suggestions, rankingContext)
        );
        const fallbackActions = detectQuickActions(query, portalSlug);
        const nextQuickActions = dedupeQuickActions(data.quickActions || fallbackActions);

        setSuggestions(rankedResults);
        setQuickActions(nextQuickActions);
        setFacets(data.facets || []);
        setApiGroupedResults(dedupeGroupedResults(data.groupedResults || {}));
        setIntentType((data.intent?.type as IntentType | undefined) || null);
        setSelectedIndex(-1);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("Search error:", err);
        setSuggestions([]);
        setQuickActions([]);
        setFacets([]);
        setApiGroupedResults({});
        setIntentType(null);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query, portalSlug, rankingContext, enabled, debounceMs, findType, portalId, viewMode]);

  // Search analytics — fires 500ms after results settle (not per-keystroke)
  useEffect(() => {
    if (!enabled || query.length < 2 || isLoading) return;

    clearTimeout(analyticsTimerRef.current);
    analyticsTimerRef.current = setTimeout(() => {
      const totalCount = suggestions.length;
      if (totalCount === 0) {
        trackSearchZeroResults({
          portalSlug,
          query,
          intentType: intentType || undefined,
          findType: findType || undefined,
        });
      } else {
        trackSearchQuery({
          portalSlug,
          query,
          resultCount: totalCount,
          intentType: intentType || undefined,
          findType: findType || undefined,
        });
      }
    }, 500);

    return () => clearTimeout(analyticsTimerRef.current);
  }, [query, suggestions.length, isLoading, enabled, portalSlug, intentType, findType]);

  // Derived booleans
  const showRecent = query.length < 2 && recentSearches.length > 0;
  const showSuggestions = query.length >= 2 && suggestions.length > 0;
  const showQuickActions = query.length >= 2 && quickActions.length > 0;

  // Group suggestions by type for display
  const groupedSuggestions = useMemo<Record<SearchResult["type"], SearchResult[]>>(() => {
    const empty: Record<SearchResult["type"], SearchResult[]> = {
      event: [],
      venue: [],
      organizer: [],
      series: [],
      list: [],
      neighborhood: [],
      category: [],
      festival: [],
      program: [],
    };
    if (!showSuggestions) return empty;

    if (Object.keys(apiGroupedResults).length > 0) {
      return { ...empty, ...apiGroupedResults } as Record<SearchResult["type"], SearchResult[]>;
    }
    return groupResultsByType(suggestions);
  }, [showSuggestions, suggestions, apiGroupedResults]);

  const groupOrder = useMemo(() => {
    const baseOrder = Array.from(new Set(getGroupDisplayOrder(rankingContext)));
    return getIntentAwareGroupOrder(baseOrder, intentType, query);
  }, [rankingContext, intentType, query]);

  const totalResultCount = useMemo(() => {
    const facetTotal = facets.reduce((sum, facet) => sum + facet.count, 0);
    if (facetTotal > 0) return facetTotal;

    return Object.values(groupedSuggestions).reduce(
      (sum, results) => sum + results.length,
      0
    );
  }, [facets, groupedSuggestions]);

  // Build flat list for keyboard navigation
  const allItems = useMemo<AllItem[]>(() => {
    const items: AllItem[] = [];

    if (showRecent) {
      for (const term of recentSearches) {
        items.push({ type: "recent", text: term });
      }
    } else if (showSuggestions) {
      if (showQuickActions) {
        for (const action of quickActions) {
          items.push({ type: "quickAction", action });
        }
      }

      for (const type of groupOrder) {
        const results = groupedSuggestions[type] || [];
        for (const result of results.slice(0, 3)) {
          items.push({ type: "suggestion", result });
        }
      }
    }

    return items;
  }, [showRecent, showSuggestions, showQuickActions, recentSearches, quickActions, groupOrder, groupedSuggestions]);

  // Handlers
  const clear = useCallback(() => {
    setQuery("");
    setShowDropdown(false);
    setSelectedIndex(-1);
    setSuggestions([]);
    setQuickActions([]);
    setApiGroupedResults({});
    setIntentType(null);
  }, []);

  const handleFocus = useCallback(() => {
    setShowDropdown(true);
    // Refresh recent searches on focus
    setRecentSearches(getRecentSearches());
  }, []);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }, 200);
  }, []);

  const selectSuggestion = useCallback(
    (_result: SearchResult) => {
      void _result;
      if (query.trim()) {
        addRecentSearch(query.trim());
        setRecentSearches(getRecentSearches());
      }
      setShowDropdown(false);
      setSelectedIndex(-1);
    },
    [query]
  );

  const selectQuickAction = useCallback(
    (_action: QuickAction) => {
      void _action;
      if (query.trim()) {
        addRecentSearch(query.trim());
        setRecentSearches(getRecentSearches());
      }
      setShowDropdown(false);
      setSelectedIndex(-1);
    },
    [query]
  );

  const selectRecentSearch = useCallback((term: string) => {
    setQuery(term);
    setShowDropdown(false);
    setSelectedIndex(-1);
  }, []);

  const removeRecent = useCallback((term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSearch(term);
    setRecentSearches(getRecentSearches());
  }, []);

  const clearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || allItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        const item = allItems[selectedIndex];
        if (item.type === "recent") {
          selectRecentSearch(item.text);
        } else if (item.type === "quickAction") {
          selectQuickAction(item.action);
        } else if (item.type === "suggestion") {
          selectSuggestion(item.result);
        }
      } else if (e.key === "Escape") {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    },
    [showDropdown, allItems, selectedIndex, selectRecentSearch, selectQuickAction, selectSuggestion]
  );

  const shouldShowDropdown = showDropdown && (showRecent || showSuggestions);

  return {
    query,
    setQuery,
    isLoading,
    suggestions,
    quickActions,
    groupedResults: groupedSuggestions,
    groupOrder,
    facets,
    recentSearches,
    totalResultCount,
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    selectSuggestion,
    selectQuickAction,
    selectRecentSearch,
    removeRecent,
    clearRecent,
    clear,
    showDropdown,
    setShowDropdown,
    handleFocus,
    handleBlur,
    shouldShowDropdown,
    showRecent,
    showSuggestions,
    showQuickActions,
    allItems,
    intentType,
  };
}
