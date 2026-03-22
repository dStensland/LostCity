"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInstantSearch } from "@/lib/hooks/useInstantSearch";
import { buildSearchResultHref } from "@/lib/search-navigation";
import { addRecentSearch } from "@/lib/searchHistory";
import { SuggestionGroup } from "@/components/search";
import { MobileSearchOverlay } from "@/components/search/MobileSearchOverlay";
import type { SearchResult } from "@/lib/unified-search";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeaderSearchButtonProps {
  portalSlug?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HeaderSearchButton({ portalSlug }: HeaderSearchButtonProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false);

  const slug = portalSlug ?? "atlanta";

  const search = useInstantSearch({
    portalSlug: slug,
    viewMode: "find",
    debounceMs: 150,
  });

  // ⌘K / Ctrl+K:
  //   - Desktop → focus the header compact input
  //   - Mobile  → open the full-screen overlay
  // This component is only mounted when NOT on the happening/find view
  // (StandardHeader unmounts it there), so no double-registration risk.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key === "k")) return;
      e.preventDefault();

      if (window.innerWidth < 768) {
        // Mobile: open overlay
        setMobileOverlayOpen(true);
      } else {
        // Desktop: focus input
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdown when clicking outside the container
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        search.setShowDropdown(false);
        setIsFocused(false);
      }
    }
    if (search.showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [search.showDropdown, search]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    search.handleFocus();
  }, [search]);

  const handleBlur = useCallback(() => {
    // Delay so mousedown on dropdown items fires first
    setTimeout(() => {
      setIsFocused(false);
    }, 200);
    search.handleBlur();
  }, [search]);

  const handleSelectSuggestion = useCallback(
    (result: SearchResult) => {
      search.selectSuggestion(result);
      const url = buildSearchResultHref(result, { portalSlug: slug });
      search.clear();
      setIsFocused(false);
      router.push(url);
    },
    [search, slug, router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        search.clear();
        inputRef.current?.blur();
        setIsFocused(false);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();

        // Keyboard-selected item → navigate to it
        if (search.selectedIndex >= 0) {
          const item = search.allItems[search.selectedIndex];
          if (item?.type === "suggestion") {
            handleSelectSuggestion(item.result);
            return;
          }
        }

        // Plain Enter → commit query, navigate to Find browse view
        const trimmed = search.query.trim();
        if (trimmed) {
          addRecentSearch(trimmed);
          search.setShowDropdown(false);
          setIsFocused(false);
          inputRef.current?.blur();
          router.push(`/${slug}?view=happening&search=${encodeURIComponent(trimmed)}`);
          search.clear();
        }
        return;
      }

      search.handleKeyDown(e);
    },
    [search, slug, router, handleSelectSuggestion]
  );

  // Build per-group start indexes for keyboard nav highlighting
  const groupedStartIndexes = search.groupOrder.reduce<Record<string, number>>(
    (acc, type) => {
      const priorTypes = search.groupOrder.slice(0, search.groupOrder.indexOf(type));
      const priorCount = priorTypes.reduce((sum, priorType) => {
        const results = search.groupedResults[priorType as SearchResult["type"]] || [];
        return sum + Math.min(results.length, 3);
      }, 0);
      acc[type] = priorCount;
      return acc;
    },
    {}
  );

  const hasResults = search.showSuggestions;
  // Show dropdown only while this input is focused
  const showDropdown = isFocused && (search.shouldShowDropdown || (search.showDropdown && search.query.length >= 2));

  return (
    <>
      {/* ── Desktop: compact functional search input (>=768px) ─────────── */}
      <div ref={containerRef} className="relative hidden md:block">
        {/* Input pill */}
        <div
          className={`flex items-center gap-2 h-8 pl-3 pr-2 rounded-full border transition-all duration-150 ${
            isFocused
              ? "bg-[var(--dusk)] border-[var(--coral)]/60 ring-2 ring-[var(--coral)]/20 w-52"
              : "bg-[var(--twilight)]/60 border-[var(--twilight)] hover:border-[var(--soft)]/40 hover:bg-[var(--twilight)]/80 w-44"
          }`}
        >
          {/* Search icon */}
          <svg
            className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${isFocused ? "text-[var(--coral)]" : "text-[var(--muted)]"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
            type="text"
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            aria-label="Search events, places, and more"
            aria-keyshortcuts="Control+k Meta+k"
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
            aria-controls="header-search-dropdown"
            role="combobox"
            aria-autocomplete="list"
            autoComplete="off"
            className="flex-1 min-w-0 bg-transparent font-mono text-xs text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none"
          />

          {/* ⌘K badge — visible when idle (no focus, no query) */}
          {!isFocused && !search.query && (
            <kbd className="ml-auto px-1.5 py-0.5 rounded bg-[var(--night)] border border-[var(--twilight)] font-mono text-2xs text-[var(--muted)] leading-none flex-shrink-0">
              ⌘K
            </kbd>
          )}

          {/* Clear button — visible when there is a query */}
          {search.query && (
            <button
              type="button"
              onMouseDown={(e) => {
                // Prevent blur from firing before we clear
                e.preventDefault();
                search.clear();
              }}
              className="ml-auto flex-shrink-0 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div
            id="header-search-dropdown"
            role="listbox"
            aria-label="Search suggestions"
            className="absolute right-0 w-80 max-h-[60vh] overflow-y-auto overflow-x-hidden z-[110] rounded-b-lg border border-[var(--twilight)] bg-[var(--dusk)] shadow-card-xl"
            style={{
              // Seamless join: overlap the pill's bottom border on dark themes.
              // The 1px negative offset hides the gap without needing border-top-none,
              // which would need a [data-theme] override for light portals.
              top: "calc(100% - 1px)",
            }}
          >
            {/* Loading shimmer */}
            {search.isLoading && !hasResults && (
              <div className="px-4 py-3 space-y-2.5">
                {[70, 110, 55].map((w, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-[var(--twilight)]/40 animate-pulse flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 rounded bg-[var(--twilight)]/40 animate-pulse" style={{ width: `${w}%` }} />
                      <div className="h-2.5 w-1/2 rounded bg-[var(--twilight)]/30 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Grouped suggestions */}
            {hasResults && (
              <div className="p-1.5">
                {search.groupOrder.map((type) => {
                  const results = search.groupedResults[type as SearchResult["type"]] || [];
                  if (results.length === 0) return null;
                  const facetCount = search.facets.find((f) => f.type === type)?.count;
                  return (
                    <SuggestionGroup
                      key={type}
                      type={type as SearchResult["type"]}
                      results={results}
                      query={search.query}
                      selectedIndex={search.selectedIndex}
                      startIndex={groupedStartIndexes[type] ?? 0}
                      onSelect={handleSelectSuggestion}
                      onHover={search.setSelectedIndex}
                      maxItems={3}
                      totalCount={facetCount}
                    />
                  );
                })}
              </div>
            )}

            {/* No-results message */}
            {search.query.length >= 2 && !search.isLoading && !hasResults && (
              <div className="px-4 py-3">
                <p className="text-xs font-mono text-[var(--muted)]">
                  No results for &ldquo;{search.query}&rdquo;
                </p>
              </div>
            )}

            {/* Keyboard shortcut footer */}
            {hasResults && (
              <div className="px-3 py-2 border-t border-[var(--twilight)] bg-[var(--night)]/50">
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
            )}
          </div>
        )}
      </div>

      {/* ── Mobile: icon-only button → opens full-screen overlay (<768px) ─ */}
      <button
        onClick={() => setMobileOverlayOpen(true)}
        className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-lg text-[var(--cream)] hover:text-[var(--soft)] hover:bg-[var(--twilight)]/70 transition-colors active:scale-95"
        aria-label="Search"
      >
        <svg
          className="w-5 h-5"
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
      </button>

      {/* Mobile overlay — conditionally rendered, not always in DOM */}
      {mobileOverlayOpen && (
        <MobileSearchOverlay
          isOpen={mobileOverlayOpen}
          onClose={() => setMobileOverlayOpen(false)}
          portalSlug={slug}
        />
      )}
    </>
  );
}
