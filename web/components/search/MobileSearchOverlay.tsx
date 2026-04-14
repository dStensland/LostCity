"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useInstantSearch } from "@/lib/hooks/useInstantSearch";
import { PreSearchState } from "@/components/search/PreSearchState";
import SuggestionGroup from "@/components/search/SuggestionGroup";
import { buildSearchResultHref } from "@/lib/search-navigation";
import { addRecentSearch } from "@/lib/searchHistory";
import { TRENDING_SEARCHES } from "@/lib/search-presearch";
import type { SearchResult } from "@/lib/search/legacy-result-types";
import { buildExploreUrl } from "@/lib/find-url";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  portalSlug: string;
  portalId?: string;
}

// ─── No-results state ─────────────────────────────────────────────────────────

function NoResultsState({
  query,
  onTrendingClick,
}: {
  query: string;
  onTrendingClick: (term: string) => void;
}) {
  return (
    <div className="px-4 pt-6 pb-4">
      <p className="text-sm text-[var(--muted)] mb-4">
        No results for{" "}
        <span className="text-[var(--soft)] font-medium">&ldquo;{query}&rdquo;</span>
      </p>
      <p className="text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-3">
        Try
      </p>
      <div className="flex flex-wrap gap-2">
        {TRENDING_SEARCHES.slice(0, 6).map((term) => (
          <button
            key={term}
            type="button"
            onMouseDown={() => onTrendingClick(term)}
            onClick={() => onTrendingClick(term)}
            className="px-3 py-1.5 rounded-full bg-[var(--twilight)]/60 border border-[var(--twilight)] text-[var(--soft)] text-xs font-mono"
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MobileSearchOverlay({
  isOpen,
  onClose,
  portalSlug,
  portalId,
}: MobileSearchOverlayProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // Lazy initializer: false during SSR (no window), true on client.
  // This avoids setState-in-effect while still being SSR-safe for createPortal.
  const [mounted] = useState<boolean>(() => typeof window !== "undefined");

  const {
    query,
    setQuery,
    isLoading,
    groupedResults,
    groupOrder,
    facets,
    selectedIndex,
    setSelectedIndex,
    selectSuggestion,
    clear,
    showSuggestions,
    preSearchData,
    preSearchLoading,
  } = useInstantSearch({
    portalSlug,
    portalId,
    debounceMs: 120,
    enabled: isOpen,
    viewMode: "find",
  });

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen) {
      // Small delay so the portal has painted
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Hardware back button via History API
  useEffect(() => {
    if (!isOpen) return;

    // Push a dummy entry so the back button fires popstate before leaving page
    window.history.pushState({ mobileSearch: true }, "");

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Cancel: clear query AND close overlay
  const handleCancel = useCallback(() => {
    clear();
    onClose();
  }, [clear, onClose]);

  // Dismiss keyboard when user touches the results area
  const handleResultsTouchStart = useCallback(() => {
    inputRef.current?.blur();
  }, []);

  // Navigate to result detail
  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      if (query.trim()) {
        addRecentSearch(query.trim());
      }
      selectSuggestion(result);
      const href = buildSearchResultHref(result, { portalSlug });
      router.push(href);
      onClose();
    },
    [query, selectSuggestion, portalSlug, router, onClose]
  );

  // Enter: navigate to browse view
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      addRecentSearch(q);
      router.push(buildExploreUrl({ portalSlug, lane: "events", search: q }));
      onClose();
    },
    [query, portalSlug, router, onClose]
  );

  // Trending pill click — treat like submit
  const handleTrendingClick = useCallback(
    (term: string) => {
      router.push(buildExploreUrl({ portalSlug, lane: "events", search: term }));
      onClose();
    },
    [portalSlug, router, onClose]
  );

  // Keyboard: Escape closes
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleCancel]
  );

  // Derive whether we have results
  const hasResults =
    showSuggestions &&
    groupOrder.some((type) => (groupedResults[type] ?? []).length > 0);
  const hasQuery = query.length >= 2;
  const showNoResults = hasQuery && !isLoading && !hasResults;
  const showPreSearch = !hasQuery;

  // Build group offset for keyboard nav
  function getGroupStartIndex(type: SearchResult["type"]): number {
    let idx = 0;
    for (const t of groupOrder) {
      if (t === type) return idx;
      idx += Math.min(groupedResults[t]?.length ?? 0, 3);
    }
    return idx;
  }

  if (!mounted || !isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[var(--void)]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-safe-top py-3 border-b border-[var(--twilight)]/50 flex-shrink-0">
        {/* Search input */}
        <form
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)]"
          onSubmit={handleSubmit}
        >
          {/* Search icon */}
          <svg
            className="w-4 h-4 text-[var(--muted)] flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search events, places..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-sm text-[var(--cream)] placeholder:text-[var(--muted)] outline-none min-w-0"
            aria-label="Search"
            aria-autocomplete="list"
          />

          {/* Clear input button */}
          {query.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery("");
                inputRef.current?.focus();
              }}
              className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--twilight)] flex items-center justify-center"
              aria-label="Clear search"
            >
              <svg
                className="w-3 h-3 text-[var(--muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          {/* Loading spinner */}
          {isLoading && query.length >= 2 && (
            <div className="flex-shrink-0 w-4 h-4 border-2 border-[var(--coral)]/30 border-t-[var(--coral)] rounded-full animate-spin" />
          )}
        </form>

        {/* Cancel button — iOS pattern: text, not icon */}
        <button
          type="button"
          onClick={handleCancel}
          className="flex-shrink-0 text-sm font-medium text-[var(--action-primary)] px-1 py-2 min-h-[44px] min-w-[44px] flex items-center justify-end"
        >
          Cancel
        </button>
      </div>

      {/* ── Content area ────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        onTouchStart={handleResultsTouchStart}
      >
        {/* Pre-search state (no query yet) */}
        {showPreSearch && preSearchData && (
          <PreSearchState
            trending={preSearchData.trending}
            popularNow={preSearchData.popularNow}
            onTrendingClick={handleTrendingClick}
            portalSlug={portalSlug}
            layout="horizontal"
            loading={preSearchLoading && preSearchData.trending.length === 0}
          />
        )}

        {/* Active search results */}
        {hasResults && (
          <div
            className="py-2"
            role="listbox"
            aria-label="Search results"
          >
            {groupOrder.map((type) => {
              const results = groupedResults[type] ?? [];
              if (results.length === 0) return null;
              const facetEntry = facets.find((f) => f.type === type);
              return (
                <SuggestionGroup
                  key={type}
                  type={type}
                  results={results}
                  query={query}
                  selectedIndex={selectedIndex}
                  startIndex={getGroupStartIndex(type)}
                  onSelect={handleSelectResult}
                  onHover={setSelectedIndex}
                  maxItems={5}
                  totalCount={facetEntry?.count}
                />
              );
            })}
          </div>
        )}

        {/* No-results fallback */}
        {showNoResults && (
          <NoResultsState query={query} onTrendingClick={handleTrendingClick} />
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
