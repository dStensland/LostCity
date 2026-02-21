"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useMemo } from "react";
import { addRecentSearch, getRecentSearches } from "@/lib/searchHistory";
import { useSearchContext } from "@/lib/search-context";
import { useSearchPersonalization } from "@/lib/hooks/useSearchPersonalization";
import { useInstantSearch } from "@/lib/hooks/useInstantSearch";
import { type SearchResult } from "@/lib/unified-search";
import type { QuickAction } from "@/lib/search-ranking";
import { buildSearchResultHref } from "@/lib/search-navigation";
import { SuggestionGroup, QuickActionsList } from "./search";
import { TypeIcon } from "./SearchResultItem";

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

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);

  // Prefer portal slug from search context; fall back to URL path.
  const portalSlug = useMemo(() => {
    if (searchContext?.portalSlug) {
      return searchContext.portalSlug;
    }
    const match = pathname.match(/^\/([^/]+)/);
    return match ? match[1] : "atlanta";
  }, [searchContext?.portalSlug, pathname]);

  // Use shared search hook
  const search = useInstantSearch({
    portalSlug,
    portalId: searchContext?.portalId,
    findType: searchContext?.findType,
    viewMode: searchContext?.viewMode || "feed",
    userPreferences: preferences || undefined,
  });

  // Sync URL search param → query on mount
  useEffect(() => {
    if (currentSearchParam && currentSearchParam !== search.query) {
      search.setQuery(currentSearchParam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      if (search.query.trim()) {
        params.set("search", search.query.trim());
        addRecentSearch(search.query.trim());
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
  }, [search.query, router, searchParams, pathname]);

  // Derive isSearching from query vs URL mismatch
  const isSearching = search.query.trim() !== currentSearchParam || search.isLoading;

  // Handle selecting a suggestion — navigate to result
  const handleSelectSuggestion = useCallback(
    (result: SearchResult) => {
      search.selectSuggestion(result);
      search.setQuery("");
      const url = buildSearchResultHref(result, { portalSlug });
      router.push(url, { scroll: false });
      inputRef.current?.blur();
    },
    [portalSlug, router, search]
  );

  // Handle selecting a quick action — navigate
  const handleSelectQuickAction = useCallback(
    (action: QuickAction) => {
      search.selectQuickAction(action);
      search.setQuery("");
      router.push(action.url, { scroll: false });
      inputRef.current?.blur();
    },
    [router, search]
  );

  // Handle selecting a recent search
  const handleSelectRecent = useCallback(
    (term: string) => {
      search.selectRecentSearch(term);
      inputRef.current?.blur();
    },
    [search]
  );

  // Wrap handleKeyDown to intercept Enter for navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && search.selectedIndex >= 0) {
        e.preventDefault();
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
      search.handleKeyDown(e);
    },
    [search, handleSelectSuggestion, handleSelectQuickAction, handleSelectRecent]
  );

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
        value={search.query}
        onChange={(e) => search.setQuery(e.target.value)}
        onFocus={search.handleFocus}
        onBlur={search.handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Search events, venues, organizers..."
        className="block w-full pl-14 pr-12 py-3.5 border border-[var(--twilight)] rounded-xl bg-[var(--night)] text-[var(--cream)] placeholder-[var(--muted)] text-sm focus:outline-none focus:border-[var(--coral)] focus:ring-2 focus:ring-[var(--coral)]/30 focus:shadow-[0_0_0_4px_var(--coral)/10,0_0_20px_var(--coral)/15] transition-all duration-200"
        role="combobox"
        aria-expanded={search.shouldShowDropdown}
        aria-controls={suggestionsId}
        aria-activedescendant={search.selectedIndex >= 0 ? `suggestion-${search.selectedIndex}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {search.query && (
        <button
          type="button"
          onClick={search.clear}
          className="absolute inset-y-0 right-0 pr-5 flex items-center group"
          aria-label="Clear search"
        >
          <svg className="h-5 w-5 text-[var(--muted)] group-hover:text-[var(--cream)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Suggestions Dropdown */}
      {search.shouldShowDropdown && (
        <div
          id={suggestionsId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-full left-0 right-0 mt-1 border border-[var(--twilight)] rounded-lg shadow-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-[10000] overflow-hidden max-h-[78vh] sm:max-h-[72vh] overflow-y-auto animate-dropdown-in bg-[var(--dusk)]"
        >
          {/* Recent Searches */}
          {search.showRecent && (
            <div className="p-2">
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-2">
                  <svg className="h-3 w-3 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[0.65rem] text-[var(--muted)] font-mono uppercase tracking-wider">Recent Searches</p>
                </div>
                <button
                  onMouseDown={search.clearRecent}
                  className="text-[0.6rem] text-[var(--muted)] hover:text-[var(--coral)] transition-colors font-mono"
                  title="Clear all"
                >
                  Clear
                </button>
              </div>
              {search.recentSearches.map((term, idx) => (
                <div
                  key={term}
                  className="group relative"
                >
                  <div
                    id={`suggestion-${idx}`}
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

          {search.showSuggestions && (
            <div className="px-3 py-2 border-b border-[var(--twilight)] bg-[var(--night)]/45">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.65rem] font-mono uppercase tracking-wider text-[var(--soft)] truncate">
                  Search: <span className="text-[var(--cream)] normal-case tracking-normal">&quot;{search.query}&quot;</span>
                </p>
                <span className="text-[0.62rem] px-2 py-0.5 rounded-full bg-[var(--twilight)] text-[var(--muted)]">
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
              startIndex={(() => {
                const idx = currentIndex;
                currentIndex += search.quickActions.length;
                return idx;
              })()}
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

                const startIdx = currentIndex;
                currentIndex += Math.min(results.length, 3);

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
                      startIndex={startIdx}
                      onSelect={handleSelectSuggestion}
                      onHover={search.setSelectedIndex}
                      maxItems={3}
                      totalCount={facetCount}
                      onViewAll={hasMore ? () => {
                        search.setShowDropdown(false);
                        search.setSelectedIndex(-1);
                        if (type === "festival") {
                          router.push(`/${portalSlug}/festivals?search=${encodeURIComponent(search.query)}`, { scroll: false });
                        } else if (type === "organizer") {
                          router.push(`/${portalSlug}?view=community&search=${encodeURIComponent(search.query)}`, { scroll: false });
                        } else {
                          const findType = type === "venue" ? "destinations" : "events";
                          router.push(`/${portalSlug}?view=find&type=${findType}&search=${encodeURIComponent(search.query)}`, { scroll: false });
                        }
                      } : undefined}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Keyboard hint — desktop only, no physical keyboard on mobile */}
          <div className="hidden sm:block px-3 py-2 border-t border-[var(--twilight)] bg-[var(--night)]/50">
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
