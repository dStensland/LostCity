"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } from "@/lib/searchHistory";
import { useSearchContext } from "@/lib/search-context";
import { useSearchPersonalization } from "@/lib/hooks/useSearchPersonalization";
import {
  type QuickAction,
  rankResults,
  detectQuickActions,
  groupResultsByType,
  getGroupDisplayOrder,
  type SearchContext as RankingContext,
} from "@/lib/search-ranking";
import { type SearchResult } from "@/lib/unified-search";
import { SuggestionGroup, QuickActionsList } from "./search";
import { TypeIcon } from "./SearchResultItem";

// ============================================
// Types
// ============================================

interface InstantSearchResponse {
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

// ============================================
// Component
// ============================================

export default function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearchParam = searchParams.get("search") || "";

  // Context
  const searchContext = useSearchContext();
  const { preferences } = useSearchPersonalization();

  // State
  const [query, setQuery] = useState(currentSearchParam);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<(SearchResult & { personalizationReason?: string })[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [facets, setFacets] = useState<{ type: string; count: number }[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      return getRecentSearches();
    }
    return [];
  });
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);
  const fetchIdRef = useRef(0);

  // Derive portal slug from pathname
  const portalSlug = useMemo(() => {
    const match = pathname.match(/^\/([^/]+)/);
    return match ? match[1] : "atlanta";
  }, [pathname]);

  // Build ranking context
  const rankingContext = useMemo<RankingContext>(() => ({
    viewMode: searchContext?.viewMode || "feed",
    findType: searchContext?.findType || null,
    portalSlug,
    portalId: searchContext?.portalId,
    userPreferences: preferences || undefined,
  }), [searchContext, portalSlug, preferences]);

  // Derive isSearching from query vs URL mismatch
  const isSearching = query.trim() !== currentSearchParam || isLoading;

  // Fetch suggestions as user types
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setQuickActions([]);
      setFacets([]);
      return;
    }

    const fetchId = ++fetchIdRef.current;

    const timer = setTimeout(async () => {
      setIsLoading(true);

      try {
        // Build API URL with context params
        const params = new URLSearchParams({
          q: query,
          limit: "8",
          portalSlug,
          viewMode: rankingContext.viewMode,
        });
        if (rankingContext.findType) {
          params.set("findType", rankingContext.findType);
        }
        if (rankingContext.portalId) {
          params.set("portal", rankingContext.portalId);
        }

        const response = await fetch(`/api/search/instant?${params.toString()}`);

        if (fetchId !== fetchIdRef.current) return; // Stale request

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data: InstantSearchResponse = await response.json();

        // Apply client-side ranking with personalization
        const rankedResults = rankResults(data.suggestions, rankingContext);

        setSuggestions(rankedResults);
        setQuickActions(data.quickActions || detectQuickActions(query, portalSlug));
        setFacets(data.facets || []);
        setSelectedIndex(-1);
      } catch (err) {
        console.error("Search error:", err);
        setSuggestions([]);
        setQuickActions([]);
        setFacets([]);
      } finally {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [query, portalSlug, rankingContext]);

  // Debounced URL update - only when query changes from user input
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (query.trim()) {
        params.set("search", query.trim());
        addRecentSearch(query.trim());
        setRecentSearches(getRecentSearches());
      } else {
        params.delete("search");
      }

      params.delete("page");
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.push(newUrl, { scroll: false });
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, router, searchParams, pathname]);

  // Handlers
  const handleClear = useCallback(() => {
    setQuery("");
    setShowDropdown(false);
    setSelectedIndex(-1);
    setSuggestions([]);
    setQuickActions([]);
  }, []);

  const handleFocus = useCallback(() => {
    setShowDropdown(true);
  }, []);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }, 200);
  }, []);

  // Handle selecting a suggestion
  const selectSuggestion = useCallback(
    (result: SearchResult) => {
      // Track the search
      if (query.trim()) {
        addRecentSearch(query.trim());
        setRecentSearches(getRecentSearches());
      }

      // Close dropdown
      setShowDropdown(false);
      setSelectedIndex(-1);
      setQuery("");

      // Build URL based on result type
      // Use simple modal pattern: /{portal}?{type}={id or slug}
      const slug = result.href?.split("/").pop();
      let url: string;

      switch (result.type) {
        case "event":
          url = `/${portalSlug}?event=${result.id}`;
          break;
        case "venue":
          url = `/${portalSlug}?spot=${slug || result.id}`;
          break;
        case "organizer":
          url = `/${portalSlug}?org=${slug || result.id}`;
          break;
        case "series":
          url = `/${portalSlug}?series=${slug || result.id}`;
          break;
        case "list":
          // Lists go to their own page
          url = result.href || `/list/${slug || result.id}`;
          break;
        case "neighborhood":
          // Apply as filter
          url = `/${portalSlug}?view=find&type=events&neighborhoods=${encodeURIComponent(result.title)}`;
          break;
        case "category":
          // Apply as filter
          url = `/${portalSlug}?view=find&type=events&categories=${encodeURIComponent(result.title)}`;
          break;
        default:
          // Fallback to href or portal home
          url = result.href || `/${portalSlug}`;
      }

      router.push(url, { scroll: false });
      inputRef.current?.blur();
    },
    [portalSlug, query, router]
  );

  // Handle selecting a quick action
  const selectQuickAction = useCallback(
    (action: QuickAction) => {
      // Track the search
      if (query.trim()) {
        addRecentSearch(query.trim());
        setRecentSearches(getRecentSearches());
      }

      // Close dropdown and clear query
      setShowDropdown(false);
      setSelectedIndex(-1);
      setQuery("");

      // Navigate to the action URL
      router.push(action.url, { scroll: false });
      inputRef.current?.blur();
    },
    [query, router]
  );

  // Handle selecting a recent search
  const selectRecentSearch = useCallback(
    (term: string) => {
      setQuery(term);
      setShowDropdown(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
    },
    []
  );

  // Handle removing a recent search
  const handleRemoveRecent = useCallback(
    (term: string, e: React.MouseEvent) => {
      e.stopPropagation();
      removeRecentSearch(term);
      setRecentSearches(getRecentSearches());
    },
    []
  );

  // Handle clearing all recent searches
  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  // Build flat list of all selectable items for keyboard navigation
  const showRecent = query.length < 2 && recentSearches.length > 0;
  const showSuggestions = query.length >= 2 && suggestions.length > 0;
  const showQuickActions = query.length >= 2 && quickActions.length > 0;

  // Group suggestions by type for display
  const groupedSuggestions = useMemo<Record<SearchResult["type"], SearchResult[]>>(() => {
    if (!showSuggestions) {
      return {
        event: [],
        venue: [],
        organizer: [],
        series: [],
        list: [],
        neighborhood: [],
        category: [],
      };
    }
    return groupResultsByType(suggestions);
  }, [showSuggestions, suggestions]);

  const groupOrder = useMemo(() => {
    return getGroupDisplayOrder(rankingContext);
  }, [rankingContext]);

  // Build flat list for keyboard navigation
  const allItems = useMemo(() => {
    const items: Array<
      | { type: "recent"; text: string }
      | { type: "quickAction"; action: QuickAction }
      | { type: "suggestion"; result: SearchResult & { personalizationReason?: string } }
    > = [];

    if (showRecent) {
      for (const term of recentSearches) {
        items.push({ type: "recent", text: term });
      }
    } else if (showSuggestions) {
      // Add quick actions first
      if (showQuickActions) {
        for (const action of quickActions) {
          items.push({ type: "quickAction", action });
        }
      }

      // Add suggestions grouped by type
      for (const type of groupOrder) {
        const results = groupedSuggestions[type] || [];
        for (const result of results.slice(0, 3)) {
          items.push({ type: "suggestion", result });
        }
      }
    }

    return items;
  }, [showRecent, showSuggestions, showQuickActions, recentSearches, quickActions, groupOrder, groupedSuggestions]);

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

  const searchId = "event-search";
  const suggestionsId = "search-suggestions";

  // Calculate indices for grouped display
  let currentIndex = 0;

  return (
    <div className="relative w-full" ref={dropdownRef} role="search">
      {/* Search Input */}
      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none" aria-hidden="true">
        {isSearching ? (
          <svg className="h-5 w-5 text-[var(--coral)] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>
      <label htmlFor={searchId} className="sr-only">Search events, venues, and organizers</label>
      <input
        ref={inputRef}
        id={searchId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Search events, venues, organizers..."
        className="block w-full pl-14 pr-12 py-3.5 border border-[var(--twilight)] rounded-xl bg-[var(--night)] text-[var(--cream)] placeholder-[var(--muted)] text-sm focus:outline-none focus:border-[var(--coral)] focus:ring-2 focus:ring-[var(--coral)]/30 focus:shadow-[0_0_0_4px_var(--coral)/10,0_0_20px_var(--coral)/15] transition-all duration-200"
        role="combobox"
        aria-expanded={shouldShowDropdown}
        aria-controls={suggestionsId}
        aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-5 flex items-center group"
          aria-label="Clear search"
        >
          <svg className="h-5 w-5 text-[var(--muted)] group-hover:text-[var(--cream)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Suggestions Dropdown */}
      {shouldShowDropdown && (
        <div
          id={suggestionsId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-full left-0 right-0 mt-1 border border-[var(--twilight)] rounded-lg shadow-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-[10000] overflow-hidden animate-dropdown-in bg-[var(--dusk)]"
        >
          {/* Recent Searches */}
          {showRecent && (
            <div className="p-2">
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-2">
                  <svg className="h-3 w-3 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[0.65rem] text-[var(--muted)] font-mono uppercase tracking-wider">Recent Searches</p>
                </div>
                <button
                  onMouseDown={handleClearRecent}
                  className="text-[0.6rem] text-[var(--muted)] hover:text-[var(--coral)] transition-colors font-mono"
                  title="Clear all"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((term, idx) => (
                <div
                  key={term}
                  className="group relative"
                >
                  <button
                    id={`suggestion-${idx}`}
                    role="option"
                    aria-selected={selectedIndex === idx}
                    onMouseDown={() => selectRecentSearch(term)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm rounded-lg transition-all ${
                      selectedIndex === idx
                        ? "bg-[var(--twilight)] text-[var(--cream)] translate-x-0.5"
                        : "text-[var(--cream)] hover:bg-[var(--twilight)]/50"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5 text-[var(--soft)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="truncate flex-1">{term}</span>
                    <button
                      onMouseDown={(e) => handleRemoveRecent(term, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--dusk)] transition-all"
                      title="Remove"
                      aria-label={`Remove "${term}" from recent searches`}
                    >
                      <svg className="h-3 w-3 text-[var(--muted)] hover:text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          {showQuickActions && (
            <QuickActionsList
              actions={quickActions}
              selectedIndex={selectedIndex}
              startIndex={(() => {
                const idx = currentIndex;
                currentIndex += quickActions.length;
                return idx;
              })()}
              onSelect={selectQuickAction}
              onHover={setSelectedIndex}
            />
          )}

          {/* Grouped Suggestions */}
          {showSuggestions && (
            <div className="p-2">
              {groupOrder.map((type) => {
                const results = groupedSuggestions[type as SearchResult["type"]] || [];
                if (results.length === 0) return null;

                const startIdx = currentIndex;
                currentIndex += Math.min(results.length, 3);

                const facetCount = facets.find(f => f.type === type)?.count;
                const totalCount = facetCount ?? results.length;
                const hasMore = totalCount > 3;

                return (
                  <SuggestionGroup
                    key={type}
                    type={type as SearchResult["type"]}
                    results={results}
                    query={query}
                    selectedIndex={selectedIndex}
                    startIndex={startIdx}
                    onSelect={selectSuggestion}
                    onHover={setSelectedIndex}
                    maxItems={3}
                    totalCount={facetCount}
                    onViewAll={hasMore ? () => {
                      setShowDropdown(false);
                      setSelectedIndex(-1);
                      if (type === "organizer") {
                        router.push(`/${portalSlug}?view=community&search=${encodeURIComponent(query)}`, { scroll: false });
                      } else {
                        const findType = type === "venue" ? "destinations" : "events";
                        router.push(`/${portalSlug}?view=find&type=${findType}&search=${encodeURIComponent(query)}`, { scroll: false });
                      }
                    } : undefined}
                  />
                );
              })}
            </div>
          )}

          {/* Keyboard hint */}
          <div className="px-3 py-2 border-t border-[var(--twilight)] bg-[var(--night)]/50">
            <p className="text-[0.6rem] text-[var(--muted)] flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--twilight)] rounded text-[var(--soft)] text-[0.55rem]">&#8593;&#8595;</kbd>
                <span>navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--twilight)] rounded text-[var(--soft)] text-[0.55rem]">&#8629;</kbd>
                <span>select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--twilight)] rounded text-[var(--soft)] text-[0.55rem]">esc</kbd>
                <span>close</span>
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export TypeIcon for backwards compatibility
export { TypeIcon };
