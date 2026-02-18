"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePortalOptional, DEFAULT_PORTAL } from "@/lib/portal-context";
import type { SearchResult, SearchFacet } from "@/lib/unified-search";
import SearchResultItem, { SearchResultSection, TypeIcon } from "./SearchResultItem";
import { getRecentSearches, addRecentSearch, clearRecentSearches } from "@/lib/searchHistory";
import { buildSearchResultHref } from "@/lib/search-navigation";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_SEARCHES = ["Live Music", "Comedy", "Free", "Rooftop", "Late Night"];
type QuickActionId = "tonight" | "weekend" | "free" | "live_music";

const QUICK_ACTIONS: Array<{
  id: QuickActionId;
  label: string;
  description: string;
}> = [
  { id: "tonight", label: "Tonight", description: "Events still happening today" },
  { id: "weekend", label: "This Weekend", description: "Weekend events (Sat–Sun)" },
  { id: "free", label: "Free", description: "Free events this week" },
  { id: "live_music", label: "Live Music", description: "Live music this week" },
];

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

function normalizeText(value: string | undefined): string {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeSearchResults(items: SearchResult[]): SearchResult[] {
  const byIdentity = new Map<string, SearchResult>();

  // First pass: hard dedupe by canonical identity.
  for (const item of items) {
    const identity = `${item.type}:${String(item.id)}`;
    const existing = byIdentity.get(identity);
    if (!existing || item.score > existing.score) {
      byIdentity.set(identity, item);
    }
  }

  // Second pass: collapse visually identical cards from different sources.
  const byScore = Array.from(byIdentity.values()).sort((a, b) => b.score - a.score);
  const semanticSeen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const item of byScore) {
    const shouldCollapseSemanticDuplicate =
      item.type === "event" || item.type === "venue" || item.type === "organizer";

    if (!shouldCollapseSemanticDuplicate) {
      deduped.push(item);
      continue;
    }

    const semanticKey = [
      item.type,
      normalizeText(item.title),
      normalizeText(item.subtitle),
      item.metadata?.date || "",
      item.metadata?.time || "",
    ].join(":");

    if (semanticSeen.has(semanticKey)) {
      continue;
    }

    semanticSeen.add(semanticKey);
    deduped.push(item);
  }

  return deduped;
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
  const [activeQuickAction, setActiveQuickAction] = useState<QuickActionId | null>(null);
  const [quickResults, setQuickResults] = useState<SearchResult[]>([]);
  const [quickResultsLoading, setQuickResultsLoading] = useState(false);
  const [quickResultsError, setQuickResultsError] = useState<string | null>(null);
  const [quickFetchNonce, setQuickFetchNonce] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const previousPortalId = useRef<string | undefined>(portal?.id);
  const activeTypeFilterRef = useRef<TypeFilter>(activeTypeFilter);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);

  // Keep ref in sync with state
  useEffect(() => {
    activeTypeFilterRef.current = activeTypeFilter;
  }, [activeTypeFilter]);

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
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      setQuery("");
      setResults([]);
      setFacets([]);
      setDidYouMean([]);
      setActiveTypeFilter(null);
      setError(null);
      setActiveQuickAction(null);
      setQuickResults([]);
      setQuickResultsLoading(false);
      setQuickResultsError(null);
      setSelectedResultIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

  // Reset quick action mode when user starts typing
  useEffect(() => {
    if (query.trim().length > 0 && activeQuickAction) {
      setActiveQuickAction(null);
      setQuickResults([]);
      setQuickResultsLoading(false);
      setQuickResultsError(null);
      setSelectedResultIndex(-1);
    }
  }, [query, activeQuickAction]);

  // Handler for clicking on a result (add to recent searches and close)
  const handleResultClick = useCallback(() => {
    // Add to recent searches
    if (query.trim()) {
      addRecentSearch(query.trim());
    }
    onClose();
  }, [query, onClose]);

  const router = useRouter();

  const navigateToHref = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  // Load quick action results (filter-only events list)
  useEffect(() => {
    if (!isOpen) return;
    if (!activeQuickAction) return;
    if (query.trim().length > 0) return;

    let cancelled = false;
    setQuickResultsLoading(true);
    setQuickResultsError(null);

    const params = new URLSearchParams({
      pageSize: "15",
      page: "1",
      exclude_classes: "true",
    });

    if (portal?.id) {
      params.set("portal_id", portal.id);
    }

    switch (activeQuickAction) {
      case "tonight":
        params.set("date", "today");
        break;
      case "weekend":
        params.set("date", "weekend");
        break;
      case "free":
        params.set("price", "free");
        params.set("date", "week");
        break;
      case "live_music":
        params.set("categories", "music");
        params.set("date", "week");
        break;
    }

    fetch(`/api/events?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const events = (data?.events || []) as Array<{
          id: number;
          title: string;
          start_date: string;
          start_time: string | null;
          is_all_day: boolean;
          is_free: boolean;
          category: string | null;
          venue: { name: string; neighborhood: string | null } | null;
        }>;

        const mapped: SearchResult[] = events.map((event, idx) => ({
          id: event.id,
          type: "event",
          title: event.title,
          subtitle: event.venue?.name || undefined,
          href: `/event/${event.id}`,
          score: events.length - idx,
          metadata: {
            date: event.start_date,
            time: event.start_time || undefined,
            neighborhood: event.venue?.neighborhood || undefined,
            category: event.category || undefined,
            isFree: event.is_free,
          },
        }));

        setQuickResults(dedupeSearchResults(mapped));
      })
      .catch(() => {
        if (!cancelled) setQuickResultsError("Couldn’t load results. Try again.");
      })
      .finally(() => {
        if (!cancelled) setQuickResultsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeQuickAction, query, portal?.id, quickFetchNonce]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      const resultsForNav = activeQuickAction ? quickResults : results;
      const currentTypeFilter = activeTypeFilterRef.current;
      const filtered = currentTypeFilter
        ? resultsForNav.filter((r) => r.type === currentTypeFilter)
        : resultsForNav;

      const grouped = {
        event: filtered.filter((r) => r.type === "event"),
        venue: filtered.filter((r) => r.type === "venue"),
        organizer: filtered.filter((r) => r.type === "organizer"),
        series: filtered.filter((r) => r.type === "series"),
        list: filtered.filter((r) => r.type === "list"),
      };

      const flattened = (["event", "venue", "organizer", "series", "list"] as const).flatMap(
        (t) => grouped[t]
      );

      // Only handle arrow keys when we have results
      if (flattened.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedResultIndex((prev) =>
          prev < flattened.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedResultIndex((prev) =>
          prev > 0 ? prev - 1 : flattened.length - 1
        );
      } else if (e.key === "Enter" && selectedResultIndex >= 0) {
        e.preventDefault();
        const selectedResult = flattened[selectedResultIndex];
        if (selectedResult) {
          if (query.trim()) {
            addRecentSearch(query.trim());
          }
          navigateToHref(buildSearchResultHref(selectedResult, { portalSlug: portal?.slug }));
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
  }, [isOpen, onClose, results, quickResults, activeQuickAction, selectedResultIndex, portal?.slug, query, navigateToHref]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedResultIndex(-1);
  }, [results, quickResults, activeQuickAction]);

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
  const search = useCallback(async (searchQuery: string, clearCache = false) => {
    if (searchQuery.length < 2) {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      setResults([]);
      setFacets([]);
      setDidYouMean([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Use ref to get latest filter value without recreating callback
    const currentTypeFilter = activeTypeFilterRef.current;

    // Check cache first
    const cacheKey = `${searchQuery}:${portal?.id || portal?.slug || ""}:${currentTypeFilter || "all"}`;

    // Clear cache if requested (e.g., when filter changes)
    if (clearCache) {
      searchCache.delete(cacheKey);
    }

    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setResults(cached.data);
      setFacets(cached.facets);
      setDidYouMean([]);
      setError(null);
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const requestId = ++searchRequestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: "15",
      });

      // Apply type filter if active
      if (currentTypeFilter) {
        params.set("types", currentTypeFilter);
      }

      // Scope to portal if available
      if (portal?.slug) {
        params.set("portal", portal.slug);
      }
      if (portal?.id) {
        params.set("portal_id", portal.id);
      }

      const response = await fetch(`/api/search?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Search request failed");
      }

      const data = await response.json();
      if (controller.signal.aborted || requestId !== searchRequestIdRef.current) {
        return;
      }

      const nextResults = dedupeSearchResults((data.results || []) as SearchResult[]);
      setResults(nextResults);
      setFacets(data.facets || []);

      // Cache the results and prune if needed
      searchCache.set(cacheKey, {
        data: nextResults,
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
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      console.error("Search error:", err);
      setError("Search failed. Please try again.");
      setResults([]);
      setFacets([]);
    } finally {
      if (!controller.signal.aborted && requestId === searchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [portal?.id, portal?.slug]);

  // Trigger search when debounced query changes
  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  // Re-search when filter changes (clearing cache for fresh results)
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      search(debouncedQuery, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTypeFilter]);

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

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resultsToDisplay = useMemo(
    () => dedupeSearchResults(activeQuickAction ? quickResults : results),
    [activeQuickAction, quickResults, results]
  );

  const { filteredResults, groupedResults } = useMemo(() => {
    const filtered = activeTypeFilter
      ? resultsToDisplay.filter((r) => r.type === activeTypeFilter)
      : resultsToDisplay;

    const grouped = {
      event: filtered.filter((r) => r.type === "event"),
      venue: filtered.filter((r) => r.type === "venue"),
      organizer: filtered.filter((r) => r.type === "organizer"),
      series: filtered.filter((r) => r.type === "series"),
      list: filtered.filter((r) => r.type === "list"),
    };

    return {
      filteredResults: filtered,
      groupedResults: grouped,
    };
  }, [resultsToDisplay, activeTypeFilter]);

  const hasResults = filteredResults.length > 0;
  const showEmptyState = query.length < 2 && !activeQuickAction;
  const showNoResults = !isLoading && query.length >= 2 && !hasResults && !error;

  // Get facet count for a type, falling back to local result count
  const getFacetCount = (type: string): number | undefined => {
    // Quick actions use filter-only event results and don't return facets
    if (activeQuickAction) return undefined;
    const facet = facets.find((f) => f.type === type);
    if (facet && facet.count > 0) return facet.count;
    // When facets are unavailable (DB issue), return undefined
    // so the section header shows the local count instead
    return undefined;
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

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-search-backdrop"
        onClick={onClose}
      />

      {/* Search Container */}
      <div className="fixed top-0 left-0 right-0 z-[60] p-4 sm:p-6 pt-16 sm:pt-20 animate-search-enter">
        <div className="max-w-6xl mx-auto">
          {/* Search Input - standardized design */}
          <div className="rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6)] search-surface min-h-[60vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--twilight)] bg-[var(--night)]/60">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--cream)]">Search</span>
                <span className="text-[0.65rem] font-mono text-[var(--muted)]">Events, venues, organizers</span>
              </div>
              <div className="flex items-center gap-2 text-[0.6rem] font-mono text-[var(--soft)]">
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)]">ESC</kbd>
                <span>to close</span>
              </div>
            </div>
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
                className="flex-1 bg-transparent text-[var(--cream)] placeholder:text-[var(--soft)] outline-none text-lg font-display transition-all duration-300 pl-3 py-2"
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

            {/* Quick actions (when search is empty) */}
            {query.length === 0 && (
              <div className="px-6 py-3 border-t border-[var(--twilight)] flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      setSelectedResultIndex(-1);
                      setDidYouMean([]);
                      setActiveTypeFilter(null);
                      setActiveQuickAction((prev) => (prev === action.id ? null : action.id));
                      setQuickResults([]);
                      setQuickResultsError(null);
                      setQuickFetchNonce((n) => n + 1);
                    }}
                    className={`px-3 py-1.5 rounded-full transition-colors text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] ${
                      activeQuickAction === action.id
                        ? "bg-[var(--dusk)] text-[var(--cream)] border border-[var(--coral)]/40 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                        : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--dusk)]"
                    }`}
                    title={action.description}
                  >
                    {action.label}
                  </button>
                ))}
                {activeQuickAction && (
                  <button
                    onClick={() => {
                      setSelectedResultIndex(-1);
                      setActiveQuickAction(null);
                      setQuickResults([]);
                      setQuickResultsError(null);
                      setQuickResultsLoading(false);
                    }}
                    className="px-3 py-1.5 rounded-full bg-transparent text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors text-xs font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] border border-[var(--twilight)]"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

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
                  {(getFacetCount("event") ?? groupedResults.event.length) > 0 && (
                    <FilterPill
                      active={activeTypeFilter === "event"}
                      onClick={() => handleTypeFilterClick("event")}
                      color="magenta"
                      loading={isLoading && activeTypeFilter === "event"}
                    >
                      <TypeIcon type="event" className="w-3 h-3 mr-1" />
                      Events ({getFacetCount("event") ?? groupedResults.event.length})
                    </FilterPill>
                  )}
                  {(getFacetCount("venue") ?? groupedResults.venue.length) > 0 && (
                    <FilterPill
                      active={activeTypeFilter === "venue"}
                      onClick={() => handleTypeFilterClick("venue")}
                      color="cyan"
                      loading={isLoading && activeTypeFilter === "venue"}
                    >
                      <TypeIcon type="venue" className="w-3 h-3 mr-1" />
                      Venues ({getFacetCount("venue") ?? groupedResults.venue.length})
                    </FilterPill>
                  )}
                  {(getFacetCount("organizer") ?? groupedResults.organizer.length) > 0 && (
                    <FilterPill
                      active={activeTypeFilter === "organizer"}
                      onClick={() => handleTypeFilterClick("organizer")}
                      color="coral"
                      loading={isLoading && activeTypeFilter === "organizer"}
                    >
                      <TypeIcon type="organizer" className="w-3 h-3 mr-1" />
                      Organizers ({getFacetCount("organizer") ?? groupedResults.organizer.length})
                    </FilterPill>
                  )}
                  {(getFacetCount("series") ?? groupedResults.series.length) > 0 && (
                    <FilterPill
                      active={activeTypeFilter === "series"}
                      onClick={() => handleTypeFilterClick("series")}
                      color="gold"
                      loading={isLoading && activeTypeFilter === "series"}
                    >
                      <TypeIcon type="series" className="w-3 h-3 mr-1" />
                      Series ({getFacetCount("series") ?? groupedResults.series.length})
                    </FilterPill>
                  )}
                  {(getFacetCount("list") ?? groupedResults.list.length) > 0 && (
                    <FilterPill
                      active={activeTypeFilter === "list"}
                      onClick={() => handleTypeFilterClick("list")}
                      color="green"
                      loading={isLoading && activeTypeFilter === "list"}
                    >
                      <TypeIcon type="list" className="w-3 h-3 mr-1" />
                      Lists ({getFacetCount("list") ?? groupedResults.list.length})
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
              className="border-t border-[var(--twilight)] h-[min(75vh,calc(100vh-14rem))] overflow-y-auto"
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

              {/* Quick Action Results (filter-only) */}
              {!isLoading && !error && activeQuickAction && (
                <div className="p-4 border-b border-[var(--twilight)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--cream)]">
                        {QUICK_ACTIONS.find((a) => a.id === activeQuickAction)?.label}
                      </p>
                      <p className="text-xs text-[var(--soft)]">
                        {QUICK_ACTIONS.find((a) => a.id === activeQuickAction)?.description}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedResultIndex(-1);
                        setActiveQuickAction(null);
                        setQuickResults([]);
                        setQuickResultsError(null);
                        setQuickResultsLoading(false);
                      }}
                      className="text-[0.65rem] text-[var(--muted)] hover:text-[var(--cream)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] rounded px-1"
                    >
                      Clear
                    </button>
                  </div>

                  {quickResultsLoading && (
                    <div className="mt-4 text-center">
                      <div className="animate-spin h-5 w-5 border-2 border-[var(--neon-magenta)] border-t-transparent rounded-full mx-auto" />
                      <p className="text-xs text-[var(--soft)] mt-2">Loading…</p>
                    </div>
                  )}

                  {!quickResultsLoading && quickResultsError && (
                    <div className="mt-4 text-center">
                      <p className="text-sm text-[var(--soft)]">{quickResultsError}</p>
                      <button
                        onClick={() => {
                          setQuickResultsError(null);
                          setQuickFetchNonce((n) => n + 1);
                        }}
                        className="mt-3 px-4 py-2 bg-[var(--twilight)] hover:bg-[var(--dusk)] text-[var(--cream)] rounded-lg text-sm transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                  {!quickResultsLoading && !quickResultsError && quickResults.length === 0 && (
                    <div className="mt-4 text-center">
                      <p className="text-sm text-[var(--soft)]">No matches right now.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Empty State - Show recent searches and popular searches */}
              {!isLoading && !error && showEmptyState && (
                <div className="p-5 space-y-5">
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-mono font-semibold text-[var(--soft)] uppercase tracking-wider flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                  {/* Popular Searches */}
                  <div className="animate-fade-up">
                    <h3 className="text-xs font-mono font-semibold text-[var(--soft)] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                </div>
              )}

              {/* Search Results */}
              {!isLoading && !error && hasResults && (
                <div className="divide-y divide-[var(--twilight)]">
                  {/* Events Section */}
                  {groupedResults.event.length > 0 && (
                    <SearchResultSection
                      type="event"
                      count={getFacetCount("event") ?? groupedResults.event.length}
                      shownCount={groupedResults.event.length}
                      onSeeMore={() => handleTypeFilterClick("event")}
                    >
                      {groupedResults.event.map((result, idx) => {
                        const resultIndex = getResultIndex("event", idx);
                        return (
                          <div
                            key={`${result.type}-${result.id}-${idx}`}
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
                      count={getFacetCount("venue") ?? groupedResults.venue.length}
                      shownCount={groupedResults.venue.length}
                      onSeeMore={() => handleTypeFilterClick("venue")}
                    >
                      {groupedResults.venue.map((result, idx) => {
                        const resultIndex = getResultIndex("venue", idx);
                        return (
                          <div
                            key={`${result.type}-${result.id}-${idx}`}
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
                      count={getFacetCount("organizer") ?? groupedResults.organizer.length}
                      shownCount={groupedResults.organizer.length}
                      onSeeMore={() => handleTypeFilterClick("organizer")}
                    >
                      {groupedResults.organizer.map((result, idx) => {
                        const resultIndex = getResultIndex("organizer", idx);
                        return (
                          <div
                            key={`${result.type}-${result.id}-${idx}`}
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
                      count={getFacetCount("series") ?? groupedResults.series.length}
                      shownCount={groupedResults.series.length}
                      onSeeMore={() => handleTypeFilterClick("series")}
                    >
                      {groupedResults.series.map((result, idx) => {
                        const resultIndex = getResultIndex("series", idx);
                        return (
                          <div
                            key={`${result.type}-${result.id}-${idx}`}
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
                      count={getFacetCount("list") ?? groupedResults.list.length}
                      shownCount={groupedResults.list.length}
                      onSeeMore={() => handleTypeFilterClick("list")}
                    >
                      {groupedResults.list.map((result, idx) => {
                        const resultIndex = getResultIndex("list", idx);
                        return (
                          <div
                            key={`${result.type}-${result.id}-${idx}`}
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
                  <div className="w-14 h-14 rounded-full bg-[var(--twilight)]/50 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-[var(--cream)] font-medium mb-1">No results for &quot;{query}&quot;</p>
                  <p className="text-sm text-[var(--soft)]">
                    Try a different search term or browse by activity
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

          {/* Keyboard shortcuts */}
          {hasResults && (
            <p className="text-center text-xs text-[var(--soft)] mt-3">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs">
                ↑↓
              </kbd>{" "}
              to navigate
              {" · "}
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs">
                ↵
              </kbd>{" "}
              to select
            </p>
          )}
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
      className={`flex items-center px-4 py-2.5 rounded-full text-xs font-mono transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] disabled:opacity-50 min-h-[36px] ${colorClasses[color]}`}
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
