"use client";

import { memo } from "react";

interface SearchResultsHeaderProps {
  resultCount: number;
  isLoading?: boolean;
  query?: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  suggestions?: Array<{
    text: string;
    onClick: () => void;
  }>;
}

export const SearchResultsHeader = memo(function SearchResultsHeader({
  resultCount,
  isLoading = false,
  query,
  hasFilters = false,
  onClearFilters,
  suggestions = [],
}: SearchResultsHeaderProps) {
  const showNoResults = !isLoading && resultCount === 0 && (query || hasFilters);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 bg-[var(--dusk)]/50 rounded-lg border border-[var(--twilight)]">
        <div className="animate-spin h-4 w-4 border-2 border-[var(--coral)] border-t-transparent rounded-full" />
        <span className="font-mono text-sm text-[var(--soft)]">Searching...</span>
      </div>
    );
  }

  if (showNoResults) {
    return (
      <div className="py-6 px-4 bg-[var(--void)] rounded-lg border border-[var(--twilight)]">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--twilight)] flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-mono text-base font-semibold text-[var(--cream)] mb-1">
              No results found
            </h3>
            {query && (
              <p className="text-sm text-[var(--soft)]">
                No matches for <span className="text-[var(--coral)]">&quot;{query}&quot;</span>
              </p>
            )}
          </div>

          {/* Suggestions */}
          {(hasFilters || suggestions.length > 0) && (
            <div className="w-full mt-2">
              <p className="text-xs text-[var(--muted)] mb-3">Try:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {hasFilters && onClearFilters && (
                  <button
                    onClick={onClearFilters}
                    className="px-3 py-2 rounded-lg bg-[var(--coral)]/20 text-[var(--coral)] hover:bg-[var(--coral)]/30 transition-colors text-sm font-mono"
                  >
                    Clear all filters
                  </button>
                )}
                {suggestions.slice(0, 3).map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={suggestion.onClick}
                    className="px-3 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)] transition-colors text-sm font-mono"
                  >
                    {suggestion.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show result count
  return (
    <div className="flex items-center justify-between py-2 px-1">
      <div className="font-mono text-sm text-[var(--soft)]">
        {resultCount === 1 ? (
          <span>
            <span className="text-[var(--cream)] font-semibold">1</span> result
          </span>
        ) : (
          <span>
            <span className="text-[var(--cream)] font-semibold">{resultCount.toLocaleString()}</span> results
          </span>
        )}
        {query && (
          <span className="ml-1">
            for <span className="text-[var(--coral)]">&quot;{query}&quot;</span>
          </span>
        )}
      </div>
    </div>
  );
});

export type { SearchResultsHeaderProps };
