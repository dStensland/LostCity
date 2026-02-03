"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePortalOptional, DEFAULT_PORTAL } from "@/lib/portal-context";
import type { SearchResult, SearchFacet } from "@/lib/unified-search";
import SearchResultItem, { SearchResultSection, TypeIcon } from "./SearchResultItem";
import { getRecentSearches, addRecentSearch, clearRecentSearches } from "@/lib/searchHistory";
import { POPULAR_ACTIVITIES, getActivityColor } from "./ActivityChip";
import CategoryIcon from "./CategoryIcon";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_SEARCHES = ["Live Music", "Comedy", "Free", "Rooftop", "Late Night"];

const SEARCH_PLACEHOLDERS = [
  "Search events, venues, organizers...",
  "Try 'live music tonight'",
  "Try 'free events this weekend'",
  "Try 'comedy shows'",
  "Try 'rooftop bars'",
];

type TypeFilter = "event" | "venue" | "organizer" | "series" | "list" | null;

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// LRU cache for search results with bounded size
const searchCache = new Map<string, { data: SearchResult[]; facets: SearchFacet[]; timestamp: number }>();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 30 * 1000; // 30 seconds

// Prune cache to remove expired entries and enforce size limit
function pruneCache() {
  const now = Date.now();

  // First, remove expired entries
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      searchCache.delete(key);
    }
  }

  // Then, if still over limit, remove oldest entries (LRU)
  if (searchCache.size > MAX_CACHE_SIZE) {
    const entries = [...searchCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, searchCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => searchCache.delete(key));
  }
}

// Clear cache for a specific portal
function clearCacheForPortal(portalId: string | undefined) {
  const prefix = portalId ? `:${portalId}:` : "::";
  for (const key of searchCache.keys()) {
    if (key.includes(prefix)) {
      searchCache.delete(key);
    }
  }
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal ?? DEFAULT_PORTAL;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [facets, setFacets] = useState<SearchFacet[]>([]);
  const [didYouMean, setDidYouMean] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoadingSpinner, setShowLoadingSpinner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<TypeFilter>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const previousPortalId = useRef<string | undefined>(portal?.id);

  // Debounce search query (150ms for fast autocomplete)
  const debouncedQuery = useDebounce(query, 150);

  // Delay showing loading spinner to prevent flash on fast searches
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setShowLoadingSpinner(true), 200);
      return () => clearTimeout(timer);
    } else {
      setShowLoadingSpinner(false);
    }
  }, [isLoading]);

  // Rotate placeholder text when search is empty
  useEffect(() => {
    if (!query && isOpen) {
      const timer = setInterval(() => {
        setPlaceholderIndex((i) => (i + 1) % SEARCH_PLACEHOLDERS.length);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [query, isOpen]);

  // Clear cache when portal changes
  useEffect(() => {
    if (portal?.id !== previousPortalId.current) {
      clearCacheForPortal(previousPortalId.current);
      previousPortalId.current = portal?.id;
    }
  }, [portal?.id]);

  // Load recent searches on mount
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
    }
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setFacets([]);
      setDidYouMean([]);
      setActiveTypeFilter(null);
      setError(null);
      setSelectedResultIndex(-1);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Only handle arrow keys when we have results
      if (results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedResultIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedResultIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1
        );
      } else if (e.key === "Enter" && selectedResultIndex >= 0) {
        e.preventDefault();
        const selectedResult = results[selectedResultIndex];
        if (selectedResult) {
          handleResultClick();
          // Navigate to the result
          window.location.href = mapToPortalPath(selectedResult, portal?.slug);
        }
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, results, selectedResultIndex, portal?.slug]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedResultIndex(-1);
  }, [results]);

  // Scroll selected result into view
  useEffect(() => {
    if (selectedResultIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(
        `[data-result-index="${selectedResultIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedResultIndex]);

  // Main search function with caching
  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setFacets([]);
      setError(null);
      return;
    }

    // Check cache first
    const cacheKey = `${searchQuery}:${portal?.id || ""}:${activeTypeFilter || "all"}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setResults(cached.data);
      setFacets(cached.facets);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: "15",
      });

      // Apply type filter if active
      if (activeTypeFilter) {
        params.set("types", activeTypeFilter);
      }

      // Scope to portal if available
      if (portal?.id) {
        params.set("portal", portal.id);
      }

      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Search request failed");
      }

      const data = await response.json();

      // Map hrefs to portal-aware paths
      const mappedResults = (data.results || []).map((result: SearchResult) => ({
        ...result,
        href: mapToPortalPath(result, portal?.slug),
      }));

      setResults(mappedResults);
      setFacets(data.facets || []);

      // Cache the results and prune if needed
      searchCache.set(cacheKey, {
        data: mappedResults,
        facets: data.facets || [],
        timestamp: Date.now(),
      });
      pruneCache();

      // Set didYouMean from search response
      if (data.didYouMean && data.didYouMean.length > 0) {
        setDidYouMean(data.didYouMean);
      } else {
        setDidYouMean([]);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Search failed. Please try again.");
      setResults([]);
      setFacets([]);
    } finally {
      setIsLoading(false);
    }
  }, [portal?.id, portal?.slug, activeTypeFilter]);

  // Map result href to portal-aware path
  function mapToPortalPath(result: SearchResult, portalSlug?: string): string {
    if (!portalSlug) return result.href;

    // Map based on type - use ?param=value format for in-page detail views
    if (result.type === "event") {
      return `/${portalSlug}?event=${result.id}`;
    } else if (result.type === "venue") {
      const slug = result.href.split("/").pop();
      return `/${portalSlug}?spot=${slug}`;
    } else if (result.type === "organizer") {
      const slug = result.href.split("/").pop();
      return `/${portalSlug}?org=${slug}`;
    } else if (result.type === "series") {
      const slug = result.href.split("/").pop();
      return `/${portalSlug}?series=${slug}`;
    }
    return result.href;
  }

  // Trigger search when debounced query changes
  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  // Re-search when filter changes (with loading state)
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      // Clear cache for this query to force fresh results with new filter
      const cacheKey = `${debouncedQuery}:${portal?.id || ""}:${activeTypeFilter || "all"}`;
      searchCache.delete(cacheKey);
      search(debouncedQuery);
    }
  }, [activeTypeFilter, debouncedQuery, search, portal?.id]);

  const handlePopularSearch = (term: string) => {
    setQuery(term);
  };

  const handleRecentSearch = (term: string) => {
    setQuery(term);
  };

  const handleDidYouMeanClick = (suggestion: string) => {
    setQuery(suggestion);
    setDidYouMean([]);
  };

  const handleResultClick = () => {
    // Add to recent searches
    if (query.trim()) {
      addRecentSearch(query.trim());
    }
    onClose();
  };

  const handleTypeFilterClick = (type: TypeFilter) => {
    setActiveTypeFilter(activeTypeFilter === type ? null : type);
  };

  const handleClearRecent = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const handleRetry = () => {
    setError(null);
    search(debouncedQuery);
  };

  const router = useRouter();

  const handleActivityClick = (activity: typeof POPULAR_ACTIVITIES[number]) => {
    // Build URL for the activity filter
    const params = new URLSearchParams();
    params.set("view", "find");
    params.set("type", "events");
    params.set("categories", activity.value);

    const basePath = portal?.slug ? `/${portal.slug}` : "";
    onClose();
    router.push(`${basePath}?${params.toString()}`);
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const hasResults = results.length > 0;
  const showEmptyState = query.length < 2;
  const showNoResults = !isLoading && query.length >= 2 && !hasResults && !error;

  // Filter results by active type
  const filteredResults = activeTypeFilter
    ? results.filter((r) => r.type === activeTypeFilter)
    : results;

  // Group results by type for display
  const groupedResults = {
    event: filteredResults.filter((r) => r.type === "event"),
    venue: filteredResults.filter((r) => r.type === "venue"),
    organizer: filteredResults.filter((r) => r.type === "organizer"),
    series: filteredResults.filter((r) => r.type === "series"),
    list: filteredResults.filter((r) => r.type === "list"),
  };

  // Get facet count for a type
  const getFacetCount = (type: string): number => {
    const facet = facets.find((f) => f.type === type);
    return facet?.count || 0;
  };

  // Calculate result index for keyboard navigation
  const getResultIndex = (type: string, indexInGroup: number): number => {
    let index = 0;
    const order = ["event", "venue", "organizer", "series", "list"];
    for (const t of order) {
      if (t === type) {
        return index + indexInGroup;
      }
      index += groupedResults[t as keyof typeof groupedResults].length;
    }
    return index;
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Search Container */}
      <div className="fixed top-0 left-0 right-0 z-[60] p-4 pt-20 animate-fade-up">
        <div className="max-w-2xl mx-auto">
          {/* Search Input - standardized design */}
          <div className="rounded-xl border border-[var(--twilight)] overflow-hidden shadow-2xl" style={{ backgroundColor: "var(--card-bg)" }}>
            <div className="flex items-center pl-6 pr-5 py-4">
              <svg
                className="w-5 h-5 text-[var(--soft)] mr-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="flex-1 bg-transparent text-[var(--cream)] placeholder:text-[var(--soft)] outline-none text-lg font-display transition-all duration-300"
                role="combobox"
                aria-expanded={hasResults}
                aria-controls="search-results"
                aria-activedescendant={selectedResultIndex >= 0 ? `result-${selectedResultIndex}` : undefined}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="p-2.5 hover:bg-[var(--twilight)] rounded-full transition-colors"
                  aria-label="Clear search"
                >
                  <svg
                    className="w-4 h-4 text-[var(--muted)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
              {/* Close button */}
              <button
                onClick={onClose}
                className="ml-2 p-2.5 hover:bg-[var(--twilight)] rounded-full transition-colors"
                aria-label="Close search"
              >
                <svg
                  className="w-5 h-5 text-[var(--muted)] hover:text-[var(--cream)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Type Filter Pills with scroll indicators */}
            {query.length >= 2 && (
              <div className="relative border-t border-[var(--twilight)]">
                {/* Scroll fade left */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--night)] to-transparent pointer-events-none z-10 opacity-0 transition-opacity" />

                <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-hide scroll-smooth">
                  <FilterPill
                    active={!activeTypeFilter}
                    onClick={() => setActiveTypeFilter(null)}
                    color="magenta"
                    loading={isLoading && !activeTypeFilter}
                  >
                    All
                  </FilterPill>
                  {getFacetCount("event") > 0 && (
                    <FilterPill
                      active={activeTypeFilter === "event"}
                      onClick={() => handleTypeFilterClick("event")}
                      color="magenta"
                      loading={isLoading && activeTypeFilter === "event"}
                    >
                      <TypeIcon type="event" className="w-3 h-3 mr-1" />
                      Events ({getFacetCount("event")})
                    </FilterPill>
                  )}
                  {getFacetCount("venue") > 0 && (
                    <FilterPill
                      active={activeTypeFilter === "venue"}
                      onClick={() => handleTypeFilterClick("venue")}
                      color="cyan"
                      loading={isLoading && activeTypeFilter === "venue"}
                    >
                      <TypeIcon type="venue" className="w-3 h-3 mr-1" />
                      Venues ({getFacetCount("venue")})
                    </FilterPill>
                  )}
                  {getFacetCount("organizer") > 0 && (
                    <FilterPill
                      active={activeTypeFilter === "organizer"}
                      onClick={() => handleTypeFilterClick("organizer")}
                      color="coral"
                      loading={isLoading && activeTypeFilter === "organizer"}
                    >
                      <TypeIcon type="organizer" className="w-3 h-3 mr-1" />
                      Organizers ({getFacetCount("organizer")})
                    </FilterPill>
                  )}
                  {getFacetCount("series") > 0 && (
                    <FilterPill
                      active={activeTypeFilter === "series"}
                      onClick={() => handleTypeFilterClick("series")}
                      color="gold"
                      loading={isLoading && activeTypeFilter === "series"}
                    >
                      <TypeIcon type="series" className="w-3 h-3 mr-1" />
                      Series ({getFacetCount("series")})
                    </FilterPill>
                  )}
                  {getFacetCount("list") > 0 && (
                    <FilterPill
                      active={activeTypeFilter === "list"}
                      onClick={() => handleTypeFilterClick("list")}
                      color="green"
                      loading={isLoading && activeTypeFilter === "list"}
                    >
                      <TypeIcon type="list" className="w-3 h-3 mr-1" />
                      Lists ({getFacetCount("list")})
                    </FilterPill>
                  )}
                </div>

                {/* Scroll fade right */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--night)] to-transparent pointer-events-none z-10 opacity-0 transition-opacity" />
              </div>
            )}

            {/* Results Area */}
            <div
              ref={resultsRef}
              id="search-results"
              role="listbox"
              className="border-t border-[var(--twilight)] max-h-[60vh] overflow-y-auto"
            >
              {showLoadingSpinner && (
                <div className="p-4 text-center">
                  <div className="animate-spin h-5 w-5 border-2 border-[var(--neon-magenta)] border-t-transparent rounded-full mx-auto" />
                  <p className="text-xs text-[var(--soft)] mt-2">Searching...</p>
                </div>
              )}

              {/* Error State */}
              {!isLoading && error && (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-[var(--coral)]/10 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-[var(--cream)] font-medium mb-1">{error}</p>
                  <button
                    onClick={handleRetry}
                    className="mt-3 px-4 py-2 bg-[var(--twilight)] hover:bg-[var(--dusk)] text-[var(--cream)] rounded-lg text-sm transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Did You Mean? */}
              {!isLoading && !error && didYouMean.length > 0 && !hasResults && (
                <div className="p-3 border-b border-[var(--twilight)]">
                  <p className="text-sm text-[var(--soft)]">
                    Did you mean:{" "}
                    {didYouMean.map((suggestion, i) => (
                      <span key={suggestion}>
                        <button
                          onClick={() => handleDidYouMeanClick(suggestion)}
                          className="text-[var(--coral)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] rounded"
                        >
                          {suggestion}
                        </button>
                        {i < didYouMean.length - 1 && ", "}
                      </span>
                    ))}
                  </p>
                </div>
              )}

              {/* Empty State - Show recent searches and popular searches */}
              {!isLoading && !error && showEmptyState && (
                <div className="p-4 space-y-4">
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-mono font-semibold text-[var(--soft)] uppercase tracking-wider flex items-center gap-2">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Recent
                        </h3>
                        <button
                          onClick={handleClearRecent}
                          className="text-[0.65rem] text-[var(--muted)] hover:text-[var(--cream)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] rounded px-1"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recentSearches.map((term) => (
                          <button
                            key={term}
                            onClick={() => handleRecentSearch(term)}
                            className="px-3 py-2 rounded-full bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)] transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Browse by Activity */}
                  <div>
                    <h3 className="text-xs font-mono font-semibold text-[var(--soft)] uppercase tracking-wider mb-2 flex items-center gap-2">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      Browse by Activity
                    </h3>
                    <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
                      {POPULAR_ACTIVITIES.map((activity) => {
                        const color = getActivityColor(activity.iconType);
                        return (
                          <button
                            key={activity.value}
                            onClick={() => handleActivityClick(activity)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] border border-transparent transition-colors text-sm whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]"
                            style={{
                              ["--chip-color" as string]: color,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${color} 15%, transparent)`;
                              e.currentTarget.style.borderColor = `color-mix(in srgb, ${color} 30%, transparent)`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "";
                              e.currentTarget.style.borderColor = "transparent";
                            }}
                          >
                            <CategoryIcon type={activity.iconType} size={14} style={{ color }} />
                            <span>{activity.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Popular Searches */}
                  <div>
                    <h3 className="text-xs font-mono font-semibold text-[var(--soft)] uppercase tracking-wider mb-2 flex items-center gap-2">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Popular
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_SEARCHES.map((term) => (
                        <button
                          key={term}
                          onClick={() => handlePopularSearch(term)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--dusk)] transition-colors text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Tips */}
                  <div className="pt-2 border-t border-[var(--twilight)]">
                    <p className="text-xs text-[var(--soft)]">
                      Try &quot;tonight&quot;, &quot;this weekend&quot;, or a venue name
                    </p>
                  </div>
                </div>
              )}

              {/* Search Results */}
              {!isLoading && !error && hasResults && (
                <div className="divide-y divide-[var(--twilight)]">
                  {/* Events Section */}
                  {groupedResults.event.length > 0 && (
                    <SearchResultSection
                      type="event"
                      count={getFacetCount("event")}
                      shownCount={groupedResults.event.length}
                      onSeeMore={() => handleTypeFilterClick("event")}
                    >
                      {groupedResults.event.map((result, idx) => {
                        const resultIndex = getResultIndex("event", idx);
                        return (
                          <div
                            key={result.id}
                            data-result-index={resultIndex}
                            id={`result-${resultIndex}`}
                            role="option"
                            aria-selected={selectedResultIndex === resultIndex}
                            className={selectedResultIndex === resultIndex ? "ring-2 ring-[var(--neon-magenta)] ring-inset rounded-lg" : ""}
                          >
                            <SearchResultItem
                              result={result}
                              onClick={handleResultClick}
                              portalSlug={portal?.slug}
                            />
                          </div>
                        );
                      })}
                    </SearchResultSection>
                  )}

                  {/* Venues Section */}
                  {groupedResults.venue.length > 0 && (
                    <SearchResultSection
                      type="venue"
                      count={getFacetCount("venue")}
                      shownCount={groupedResults.venue.length}
                      onSeeMore={() => handleTypeFilterClick("venue")}
                    >
                      {groupedResults.venue.map((result, idx) => {
                        const resultIndex = getResultIndex("venue", idx);
                        return (
                          <div
                            key={result.id}
                            data-result-index={resultIndex}
                            id={`result-${resultIndex}`}
                            role="option"
                            aria-selected={selectedResultIndex === resultIndex}
                            className={selectedResultIndex === resultIndex ? "ring-2 ring-[var(--coral)] ring-inset rounded-lg" : ""}
                          >
                            <SearchResultItem
                              result={result}
                              onClick={handleResultClick}
                              portalSlug={portal?.slug}
                            />
                          </div>
                        );
                      })}
                    </SearchResultSection>
                  )}

                  {/* Organizers Section */}
                  {groupedResults.organizer.length > 0 && (
                    <SearchResultSection
                      type="organizer"
                      count={getFacetCount("organizer")}
                      shownCount={groupedResults.organizer.length}
                      onSeeMore={() => handleTypeFilterClick("organizer")}
                    >
                      {groupedResults.organizer.map((result, idx) => {
                        const resultIndex = getResultIndex("organizer", idx);
                        return (
                          <div
                            key={result.id}
                            data-result-index={resultIndex}
                            id={`result-${resultIndex}`}
                            role="option"
                            aria-selected={selectedResultIndex === resultIndex}
                            className={selectedResultIndex === resultIndex ? "ring-2 ring-[var(--coral)] ring-inset rounded-lg" : ""}
                          >
                            <SearchResultItem
                              result={result}
                              onClick={handleResultClick}
                              portalSlug={portal?.slug}
                            />
                          </div>
                        );
                      })}
                    </SearchResultSection>
                  )}

                  {/* Series Section */}
                  {groupedResults.series.length > 0 && (
                    <SearchResultSection
                      type="series"
                      count={getFacetCount("series")}
                      shownCount={groupedResults.series.length}
                      onSeeMore={() => handleTypeFilterClick("series")}
                    >
                      {groupedResults.series.map((result, idx) => {
                        const resultIndex = getResultIndex("series", idx);
                        return (
                          <div
                            key={result.id}
                            data-result-index={resultIndex}
                            id={`result-${resultIndex}`}
                            role="option"
                            aria-selected={selectedResultIndex === resultIndex}
                            className={selectedResultIndex === resultIndex ? "ring-2 ring-[var(--gold)] ring-inset rounded-lg" : ""}
                          >
                            <SearchResultItem
                              result={result}
                              onClick={handleResultClick}
                              portalSlug={portal?.slug}
                            />
                          </div>
                        );
                      })}
                    </SearchResultSection>
                  )}

                  {/* Lists Section */}
                  {groupedResults.list.length > 0 && (
                    <SearchResultSection
                      type="list"
                      count={getFacetCount("list")}
                      shownCount={groupedResults.list.length}
                      onSeeMore={() => handleTypeFilterClick("list")}
                    >
                      {groupedResults.list.map((result, idx) => {
                        const resultIndex = getResultIndex("list", idx);
                        return (
                          <div
                            key={result.id}
                            data-result-index={resultIndex}
                            id={`result-${resultIndex}`}
                            role="option"
                            aria-selected={selectedResultIndex === resultIndex}
                            className={selectedResultIndex === resultIndex ? "ring-2 ring-[var(--neon-green)] ring-inset rounded-lg" : ""}
                          >
                            <SearchResultItem
                              result={result}
                              onClick={handleResultClick}
                              portalSlug={portal?.slug}
                            />
                          </div>
                        );
                      })}
                    </SearchResultSection>
                  )}
                </div>
              )}

              {/* No Results */}
              {showNoResults && (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-[var(--twilight)] flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-[var(--cream)] font-medium mb-1">No results for &quot;{query}&quot;</p>
                  <p className="text-sm text-[var(--soft)]">
                    Try a different search term or browse popular searches above
                  </p>
                  {POPULAR_SEARCHES.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      {POPULAR_SEARCHES.slice(0, 3).map((term) => (
                        <button
                          key={term}
                          onClick={() => handlePopularSearch(term)}
                          className="px-3 py-2 rounded-full bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Close hint with keyboard shortcuts */}
          <p className="text-center text-xs text-[var(--soft)] mt-3">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs">
              ESC
            </kbd>{" "}
            to close
            {hasResults && (
              <>
                {" · "}
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs">
                  ↑↓
                </kbd>{" "}
                to navigate
                {" · "}
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs">
                  ↵
                </kbd>{" "}
                to select
              </>
            )}
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}

// Filter pill component with loading state
function FilterPill({
  active,
  onClick,
  color,
  loading,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: "magenta" | "cyan" | "coral" | "gold" | "green";
  loading?: boolean;
  children: React.ReactNode;
}) {
  const colorClasses = {
    magenta: active
      ? "bg-[var(--neon-magenta)]/20 text-[var(--neon-magenta)]"
      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]",
    cyan: active
      ? "bg-[var(--coral)]/20 text-[var(--coral)]"
      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]",
    coral: active
      ? "bg-[var(--coral)]/20 text-[var(--coral)]"
      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]",
    gold: active
      ? "bg-[var(--gold)]/20 text-[var(--gold)]"
      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]",
    green: active
      ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)]"
      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]",
  };

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      disabled={loading}
      className={`flex items-center px-3.5 py-2 rounded-full text-xs font-mono transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] disabled:opacity-50 ${colorClasses[color]}`}
    >
      {loading && active && (
        <svg className="animate-spin h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
