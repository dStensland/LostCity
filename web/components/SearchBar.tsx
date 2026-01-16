"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { getSearchSuggestions } from "@/lib/search";
import { getRecentSearches, addRecentSearch } from "@/lib/searchHistory";

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearchParam = searchParams.get("search") || "";
  const [query, setQuery] = useState(currentSearchParam);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive isSearching from query vs URL mismatch
  const isSearching = query.trim() !== currentSearchParam;

  // Load recent searches on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial data load
    setRecentSearches(getRecentSearches());
  }, []);

  // Fetch suggestions as user types
  useEffect(() => {
    if (query.length >= 2) {
      const timer = setTimeout(async () => {
        const results = await getSearchSuggestions(query);
        setSuggestions(results);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clear on condition
      setSuggestions([]);
    }
  }, [query]);

  // Debounced search update
  useEffect(() => {
    // Clear existing timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (query.trim()) {
        params.set("search", query.trim());
        // Save to recent searches when search is executed
        addRecentSearch(query.trim());
        setRecentSearches(getRecentSearches());
      } else {
        params.delete("search");
      }

      // Reset to page 1 when search changes
      params.delete("page");

      const newUrl = params.toString() ? `/?${params.toString()}` : "/";
      router.push(newUrl, { scroll: false });
    }, 150);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, router, searchParams]);

  const handleClear = useCallback(() => {
    setQuery("");
    setShowDropdown(false);
  }, []);

  const handleFocus = useCallback(() => {
    setShowDropdown(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Delay to allow click on dropdown items
    setTimeout(() => setShowDropdown(false), 200);
  }, []);

  const selectSuggestion = useCallback((term: string) => {
    setQuery(term);
    setShowDropdown(false);
    inputRef.current?.blur();
  }, []);

  const showRecent = query.length < 2 && recentSearches.length > 0;
  const showSuggestions = query.length >= 2 && suggestions.length > 0;
  const shouldShowDropdown = showDropdown && (showRecent || showSuggestions);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        {isSearching ? (
          <svg
            className="h-4 w-4 text-[var(--coral)] animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4 text-[var(--muted)]"
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
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Search events, venues..."
        className="block w-full pl-11 pr-10 py-2.5 bg-[var(--night)] border border-[var(--twilight)] rounded-lg text-[var(--cream)] placeholder-[var(--muted)] text-sm focus:outline-none focus:border-[var(--coral)] focus:ring-1 focus:ring-[var(--coral)] transition-colors"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-4 flex items-center group"
          aria-label="Clear search"
        >
          <svg
            className="h-4 w-4 text-[var(--muted)] group-hover:text-[var(--cream)] transition-colors"
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

      {/* Suggestions Dropdown */}
      {shouldShowDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--night)] border border-[var(--twilight)] rounded-lg shadow-lg z-50 overflow-hidden">
          {showRecent && (
            <div className="p-2">
              <p className="text-xs text-[var(--muted)] px-2 pb-1 font-medium">
                Recent
              </p>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onMouseDown={() => selectSuggestion(term)}
                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-[var(--cream)] hover:bg-[var(--twilight)] rounded transition-colors"
                >
                  <svg
                    className="h-3 w-3 text-[var(--muted)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {term}
                </button>
              ))}
            </div>
          )}

          {showSuggestions && (
            <div className={`p-2 ${showRecent ? "border-t border-[var(--twilight)]" : ""}`}>
              <p className="text-xs text-[var(--muted)] px-2 pb-1 font-medium">
                Suggestions
              </p>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onMouseDown={() => selectSuggestion(suggestion)}
                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-[var(--cream)] hover:bg-[var(--twilight)] rounded transition-colors"
                >
                  <svg
                    className="h-3 w-3 text-[var(--muted)]"
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
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
