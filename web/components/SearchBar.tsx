"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getSearchSuggestions, type SearchSuggestion } from "@/lib/search";
import { getRecentSearches, addRecentSearch } from "@/lib/searchHistory";

export default function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearchParam = searchParams.get("search") || "";
  const [query, setQuery] = useState(currentSearchParam);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    // Initialize with recent searches from localStorage (client-side only)
    if (typeof window !== "undefined") {
      return getRecentSearches();
    }
    return [];
  });
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);

  // Derive isSearching from query vs URL mismatch
  const isSearching = query.trim() !== currentSearchParam;

  // Fetch suggestions as user types
  useEffect(() => {
    // Clear suggestions for short queries immediately via cleanup pattern
    if (query.length < 2) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await getSearchSuggestions(query);
      if (!cancelled) {
        setSuggestions(results);
        setSelectedIndex(-1);
      }
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Clear suggestions when query is too short (derived state approach)
  const activeSuggestions = useMemo(
    () => (query.length >= 2 ? suggestions : []),
    [query.length, suggestions]
  );

  // Debounced search update - only when query changes from user input
  useEffect(() => {
    // Skip the initial mount to avoid redirect loop
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
      // Stay on current path instead of going to /
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.push(newUrl, { scroll: false });
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, router, searchParams, pathname]);

  const handleClear = useCallback(() => {
    setQuery("");
    setShowDropdown(false);
    setSelectedIndex(-1);
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

  const selectSuggestion = useCallback((term: string) => {
    setQuery(term);
    setShowDropdown(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  }, []);

  // Build flat list of all selectable items
  const showRecent = query.length < 2 && recentSearches.length > 0;
  const showSuggestions = query.length >= 2 && activeSuggestions.length > 0;
  const allItems = useMemo(
    () =>
      showRecent
        ? recentSearches.map((t) => ({ text: t, type: "recent" as const }))
        : showSuggestions
        ? activeSuggestions
        : [],
    [showRecent, showSuggestions, recentSearches, activeSuggestions]
  );

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
        selectSuggestion(allItems[selectedIndex].text);
      } else if (e.key === "Escape") {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    },
    [showDropdown, allItems, selectedIndex, selectSuggestion]
  );

  const shouldShowDropdown = showDropdown && (showRecent || showSuggestions);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        {isSearching ? (
          <svg className="h-4 w-4 text-[var(--coral)] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Search events, venues, neighborhoods..."
        className="block w-full pl-11 pr-10 py-2.5 bg-[var(--night)] border border-[var(--twilight)] rounded-lg text-[var(--cream)] placeholder-[var(--muted)] text-sm focus:outline-none focus:border-[var(--coral)] focus:ring-1 focus:ring-[var(--coral)] transition-colors"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-4 flex items-center group"
          aria-label="Clear search"
        >
          <svg className="h-4 w-4 text-[var(--muted)] group-hover:text-[var(--cream)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Suggestions Dropdown */}
      {shouldShowDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--night)] border border-[var(--twilight)] rounded-lg shadow-lg z-50 overflow-hidden">
          {showRecent && (
            <div className="p-2">
              <p className="text-xs text-[var(--muted)] px-2 pb-1 font-medium">Recent</p>
              {recentSearches.map((term, idx) => (
                <button
                  key={term}
                  onMouseDown={() => selectSuggestion(term)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                    selectedIndex === idx
                      ? "bg-[var(--twilight)] text-[var(--cream)]"
                      : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                  }`}
                >
                  <svg className="h-3 w-3 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {term}
                </button>
              ))}
            </div>
          )}

          {showSuggestions && (
            <div className="p-2">
              <p className="text-xs text-[var(--muted)] px-2 pb-1 font-medium">Suggestions</p>
              {activeSuggestions.map((suggestion, idx) => (
                <button
                  key={`${suggestion.type}-${suggestion.text}`}
                  onMouseDown={() => selectSuggestion(suggestion.text)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                    selectedIndex === idx
                      ? "bg-[var(--twilight)] text-[var(--cream)]"
                      : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                  }`}
                >
                  <SuggestionIcon type={suggestion.type} />
                  <span className="flex-1 truncate">{suggestion.text}</span>
                  <span className="text-[0.6rem] text-[var(--muted)] uppercase">{suggestion.type}</span>
                </button>
              ))}
            </div>
          )}

          {/* Keyboard hint */}
          <div className="px-3 py-1.5 bg-[var(--dusk)] border-t border-[var(--twilight)]">
            <p className="text-[0.6rem] text-[var(--muted)]">
              <kbd className="px-1 py-0.5 bg-[var(--twilight)] rounded text-[var(--soft)]">↑</kbd>
              <kbd className="px-1 py-0.5 bg-[var(--twilight)] rounded text-[var(--soft)] ml-1">↓</kbd>
              <span className="ml-1">to navigate</span>
              <kbd className="px-1 py-0.5 bg-[var(--twilight)] rounded text-[var(--soft)] ml-2">↵</kbd>
              <span className="ml-1">to select</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionIcon({ type }: { type: "venue" | "event" | "neighborhood" }) {
  if (type === "venue") {
    return (
      <svg className="h-3 w-3 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  if (type === "neighborhood") {
    return (
      <svg className="h-3 w-3 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  // event
  return (
    <svg className="h-3 w-3 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
