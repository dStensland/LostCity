"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInstantSearch } from "@/lib/hooks/useInstantSearch";
import { buildSearchResultHref } from "@/lib/search-navigation";
import { trackSearchResultClick } from "@/lib/analytics/find-tracking";
import { addRecentSearch } from "@/lib/searchHistory";
import { SuggestionGroup, QuickActionsList } from "@/components/search";
import type { SearchResult } from "@/lib/unified-search";
import type { QuickAction } from "@/lib/search-ranking";

const TRENDING_SEARCHES = ["Live Music", "Comedy", "Free", "Rooftop", "Late Night"];

const CATEGORY_CHIPS = [
  { value: "music", label: "Music" },
  { value: "comedy", label: "Comedy" },
  { value: "food_drink", label: "Food & Drink" },
  { value: "art", label: "Arts" },
  { value: "nightlife", label: "Nightlife" },
] as const;

interface FindSearchInputProps {
  portalSlug: string;
  portalId?: string;
  findType?: string | null;
  placeholder?: string;
}

function resolveViewAllHref(params: {
  portalSlug: string;
  resultType: SearchResult["type"];
  query: string;
  findType?: string | null;
}): string {
  const encodedQuery = encodeURIComponent(params.query);

  if (params.resultType === "festival") {
    return `/${params.portalSlug}/festivals?search=${encodedQuery}`;
  }

  if (params.resultType === "organizer") {
    return `/${params.portalSlug}?view=community&search=${encodedQuery}`;
  }

  if (params.resultType === "venue") {
    return `/${params.portalSlug}?view=places&search=${encodedQuery}`;
  }

  if (params.findType === "classes") {
    return `/${params.portalSlug}?view=happening&content=classes&search=${encodedQuery}`;
  }

  return `/${params.portalSlug}?view=happening&search=${encodedQuery}`;
}

export default function FindSearchInput({
  portalSlug,
  portalId,
  findType,
  placeholder = "Search events...",
}: FindSearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const urlSyncRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Count-based skip: set to N to suppress the next N runs of the URL sync
  // effect. We need 2 skips because router.push() and search.setQuery("") each
  // trigger a separate effect run (searchParams and search.query are both
  // dependencies), and consuming a boolean skip on the first run leaves the
  // second run unguarded.
  const skipUrlSyncRef = useRef(0);
  const pathname = `/${portalSlug}`;

  const search = useInstantSearch({
    portalSlug,
    portalId,
    findType,
    viewMode: "find",
  });

  // Sync URL search param → query on mount and external changes
  const urlSearch = searchParams?.get("search") || "";
  const prevUrlSearchRef = useRef(urlSearch);
  useEffect(() => {
    if (urlSearch !== prevUrlSearchRef.current) {
      prevUrlSearchRef.current = urlSearch;
      if (urlSearch !== search.query) {
        search.setQuery(urlSearch);
      }
    }
  }, [urlSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced sync of query → URL
  useEffect(() => {
    clearTimeout(urlSyncRef.current);
    if (skipUrlSyncRef.current > 0) {
      skipUrlSyncRef.current -= 1;
      return;
    }
    urlSyncRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      const trimmed = search.query.trim();
      if (trimmed) {
        params.set("search", trimmed);
      } else {
        params.delete("search");
      }
      params.delete("page");
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl, { scroll: false });
    }, 300);

    return () => clearTimeout(urlSyncRef.current);
  }, [search.query, router, searchParams, pathname]);

  // Handle suggestion selection → navigate to detail
  const handleSelectSuggestion = useCallback(
    (result: SearchResult) => {
      trackSearchResultClick({
        portalSlug,
        query: search.query,
        resultType: result.type,
        resultId: String(result.id),
        resultPosition: search.selectedIndex,
      });
      search.selectSuggestion(result);
      // Set skip count to 2: one skip for the effect run triggered by
      // search.query changing to "", and one for the run triggered by
      // searchParams updating after router.push(). Without both skips the
      // second run fires with the stale "brunch" query and writes
      // ?search=brunch back into the URL, which the URL→query sync then picks
      // up and fills the input with the event title instead of navigating.
      skipUrlSyncRef.current = 2;
      search.setQuery("");
      const url = buildSearchResultHref(result, { portalSlug });
      router.push(url, { scroll: false });
      inputRef.current?.blur();
    },
    [portalSlug, router, search]
  );

  // Handle quick action selection → navigate
  const handleSelectQuickAction = useCallback(
    (action: QuickAction) => {
      search.selectQuickAction(action);
      skipUrlSyncRef.current = 2;
      search.setQuery("");
      router.push(action.url, { scroll: false });
      inputRef.current?.blur();
    },
    [router, search]
  );

  // Handle recent search selection → apply as query
  const handleSelectRecent = useCallback(
    (term: string) => {
      search.selectRecentSearch(term);
      inputRef.current?.blur();
    },
    [search]
  );

  // Wrap handleKeyDown to add navigation on Enter for selected items
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();

        // If an item is selected, navigate to it
        if (search.selectedIndex >= 0) {
          const item = search.allItems[search.selectedIndex];
          if (item?.type === "suggestion") {
            handleSelectSuggestion(item.result);
            return;
          }
          if (item?.type === "quickAction") {
            handleSelectQuickAction(item.action);
            return;
          }
          if (item?.type === "recent") {
            handleSelectRecent(item.text);
            return;
          }
        }

        // No item selected — commit the search query to URL immediately
        const trimmed = search.query.trim();
        if (trimmed) {
          clearTimeout(urlSyncRef.current);
          // Skip 1: the router.replace we're about to do will change searchParams,
          // which re-runs the URL sync effect. Suppress it to avoid a double-write.
          skipUrlSyncRef.current = 1;
          addRecentSearch(trimmed);
          const params = new URLSearchParams(searchParams?.toString() || "");
          params.set("search", trimmed);
          params.delete("page");
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
        search.setShowDropdown(false);
        inputRef.current?.blur();
        return;
      }
      search.handleKeyDown(e);
    },
    [search, searchParams, pathname, router, handleSelectSuggestion, handleSelectQuickAction, handleSelectRecent]
  );

  // Handle trending search click
  const handleTrendingSearch = useCallback(
    (term: string) => {
      search.setQuery(term);
      addRecentSearch(term);
    },
    [search]
  );

  // Handle category chip click — apply as filter param
  const handleCategoryChip = useCallback(
    (category: string) => {
      search.setShowDropdown(false);
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("categories", category);
      params.delete("search");
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, search, searchParams, pathname]
  );

  const isSearching = search.query.trim() !== urlSearch || search.isLoading;
  const showPreSearch = search.showDropdown && search.query.length < 2;
  const showDropdown = search.shouldShowDropdown || showPreSearch;

  const quickActionsStartIndex = 0;
  const groupedStartIndexes = search.groupOrder.reduce<Record<string, number>>(
    (acc, type) => {
      const priorTypes = search.groupOrder.slice(0, search.groupOrder.indexOf(type));
      const priorResultsCount = priorTypes.reduce((sum, priorType) => {
        const results = search.groupedResults[priorType as SearchResult["type"]] || [];
        return sum + Math.min(results.length, 3);
      }, 0);
      acc[type] = search.quickActions.length + priorResultsCount;
      return acc;
    },
    {}
  );

  const searchId = "find-search";
  const suggestionsId = "find-search-suggestions";

  return (
    <div className="relative" ref={dropdownRef} role="search">
      {/* Search input */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        {isSearching ? (
          <svg className="w-4 h-4 text-[var(--coral)] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>
      <label htmlFor={searchId} className="sr-only">Search events, places, and organizations</label>
      <input
        ref={inputRef}
        id={searchId}
        type="text"
        value={search.query}
        onChange={(e) => search.setQuery(e.target.value)}
        onFocus={search.handleFocus}
        onBlur={search.handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 h-11 bg-[var(--dusk)]/90 border border-[var(--twilight)]/80 rounded-xl font-mono text-sm text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] focus:ring-2 focus:ring-[var(--coral)]/30 focus:shadow-[0_0_0_4px_var(--coral)/10,0_0_20px_var(--coral)/15] transition-all"
        role="combobox"
        aria-expanded={search.shouldShowDropdown}
        aria-controls={suggestionsId}
        aria-activedescendant={search.selectedIndex >= 0 ? `find-suggestion-${search.selectedIndex}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {search.query && (
        <button
          type="button"
          onClick={() => { search.clear(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          aria-label="Clear search"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Suggestions dropdown */}
      {showDropdown && (
        <div
          id={suggestionsId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-full left-0 right-0 mt-1 border border-[var(--twilight)] rounded-lg shadow-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-50 overflow-hidden max-h-[70vh] overflow-y-auto animate-dropdown-in bg-[var(--dusk)]/95 backdrop-blur-md"
        >
          {/* Recent searches */}
          {search.showRecent && (
            <div className="p-2">
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-2">
                  <svg className="h-3 w-3 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider">Recent Searches</p>
                </div>
                <button
                  onMouseDown={search.clearRecent}
                  className="text-xs text-[var(--muted)] hover:text-[var(--coral)] transition-colors font-mono"
                  title="Clear all"
                >
                  Clear
                </button>
              </div>
              {search.recentSearches.map((term, idx) => (
                <div key={term} className="group relative">
                  <div
                    id={`find-suggestion-${idx}`}
                    role="option"
                    aria-selected={search.selectedIndex === idx}
                    onMouseEnter={() => search.setSelectedIndex(idx)}
                    className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm rounded-lg transition-all ${
                      search.selectedIndex === idx
                        ? "bg-[var(--twilight)] text-[var(--cream)] translate-x-0.5"
                        : "text-[var(--cream)] hover:bg-[var(--twilight)]/50"
                    }`}
                  >
                    <button
                      onMouseDown={() => handleSelectRecent(term)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    >
                      <svg className="h-3.5 w-3.5 text-[var(--soft)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="truncate flex-1">{term}</span>
                    </button>
                    <button
                      onMouseDown={(e) => search.removeRecent(term, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--dusk)] transition-all"
                      title="Remove"
                      aria-label={`Remove "${term}" from recent searches`}
                    >
                      <svg className="h-3 w-3 text-[var(--muted)] hover:text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trending + category chips — shown in pre-search state */}
          {showPreSearch && (
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 pb-2">
                <svg className="h-3 w-3 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider">Trending</p>
              </div>
              <div className="flex flex-wrap gap-1.5 px-2">
                {TRENDING_SEARCHES.map((term) => (
                  <button
                    key={term}
                    onMouseDown={() => handleTrendingSearch(term)}
                    className="px-3 py-1.5 rounded-full bg-[var(--twilight)]/70 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors text-xs font-mono"
                  >
                    {term}
                  </button>
                ))}
              </div>
              <div className="mt-3 px-2">
                <div className="flex items-center gap-2 pb-2">
                  <svg className="h-3 w-3 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider">Browse</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_CHIPS.map((cat) => (
                    <button
                      key={cat.value}
                      onMouseDown={() => handleCategoryChip(cat.value)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--twilight)]/60 bg-white/5 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors text-xs font-mono"
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Search header with result count */}
          {search.showSuggestions && (
            <div className="px-3 py-2 border-b border-[var(--twilight)] bg-[var(--night)]/45">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-mono uppercase tracking-wider text-[var(--soft)] truncate">
                  Search: <span className="text-[var(--cream)] normal-case tracking-normal">&quot;{search.query}&quot;</span>
                </p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--twilight)] text-[var(--muted)]">
                  {search.totalResultCount} results
                </span>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {search.showQuickActions && (
            <QuickActionsList
              actions={search.quickActions}
              selectedIndex={search.selectedIndex}
              startIndex={quickActionsStartIndex}
              onSelect={handleSelectQuickAction}
              onHover={search.setSelectedIndex}
            />
          )}

          {/* Grouped Suggestions */}
          {search.showSuggestions && (
            <div className="p-2">
              {search.groupOrder.map((type, groupIdx) => {
                const results = search.groupedResults[type as SearchResult["type"]] || [];
                if (results.length === 0) return null;

                const facetCount = search.facets.find(f => f.type === type)?.count;
                const totalCount = facetCount ?? results.length;
                const hasMore = totalCount > 3;

                return (
                  <div
                    key={type}
                    className="motion-safe:animate-fade-up"
                    style={{
                      animationDelay: `${Math.min(groupIdx * 40, 200)}ms`,
                      animationFillMode: "forwards",
                    }}
                  >
                    <SuggestionGroup
                      type={type as SearchResult["type"]}
                      results={results}
                      query={search.query}
                      selectedIndex={search.selectedIndex}
                      startIndex={groupedStartIndexes[type] ?? search.quickActions.length}
                      onSelect={handleSelectSuggestion}
                      onHover={search.setSelectedIndex}
                      maxItems={3}
                      totalCount={facetCount}
                      onViewAll={hasMore ? () => {
                        search.setShowDropdown(false);
                        search.setSelectedIndex(-1);
                        router.push(
                          resolveViewAllHref({
                            portalSlug,
                            resultType: type as SearchResult["type"],
                            query: search.query,
                            findType,
                          }),
                          { scroll: false },
                        );
                      } : undefined}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Keyboard hint — desktop only, no physical keyboard on mobile */}
          <div className="hidden sm:block px-3 py-2 border-t border-[var(--twilight)] bg-[var(--night)]/50">
            <p className="text-xs text-[var(--muted)] flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--twilight)] rounded text-[var(--soft)] text-2xs">&#8593;&#8595;</kbd>
                <span>navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--twilight)] rounded text-[var(--soft)] text-2xs">&#8629;</kbd>
                <span>select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--twilight)] rounded text-[var(--soft)] text-2xs">esc</kbd>
                <span>close</span>
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
