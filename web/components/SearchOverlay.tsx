"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePortalOptional, DEFAULT_PORTAL } from "@/lib/portal-context";
import type { SearchResult, SearchFacet } from "@/lib/unified-search";
import type { SearchSuggestion } from "@/lib/search-suggestions";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_SEARCHES = ["Live Music", "Comedy", "Free", "Rooftop", "Late Night"];

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal ?? DEFAULT_PORTAL;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [facets, setFacets] = useState<SearchFacet[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [didYouMean, setDidYouMean] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTypeFilter, setActiveTypeFilter] = useState<"event" | "venue" | "organizer" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query (150ms for fast autocomplete)
  const debouncedQuery = useDebounce(query, 150);

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
      setSuggestions([]);
      setDidYouMean([]);
      setActiveTypeFilter(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Fetch suggestions for autocomplete
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/search/suggestions?q=${encodeURIComponent(searchQuery)}&limit=6&corrections=true`
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        // Only show corrections if we have some
        if (data.corrections && data.corrections.length > 0) {
          setDidYouMean(data.corrections.map((c: { suggestion: string }) => c.suggestion));
        } else {
          setDidYouMean([]);
        }
      }
    } catch (error) {
      console.error("Suggestions error:", error);
    }
  }, []);

  // Main search function
  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setFacets([]);
      return;
    }

    setIsLoading(true);

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
      if (response.ok) {
        const data = await response.json();

        // Map hrefs to portal-aware paths
        const mappedResults = (data.results || []).map((result: SearchResult) => ({
          ...result,
          href: mapToPortalPath(result, portal?.slug),
        }));

        setResults(mappedResults);
        setFacets(data.facets || []);

        // Set didYouMean from search response if not already set
        if (data.didYouMean && data.didYouMean.length > 0 && didYouMean.length === 0) {
          setDidYouMean(data.didYouMean);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [portal?.id, portal?.slug, activeTypeFilter, didYouMean.length]);

  // Map result href to portal-aware path
  function mapToPortalPath(result: SearchResult, portalSlug?: string): string {
    if (!portalSlug) return result.href;

    // Map based on type
    if (result.type === "event") {
      return `/${portalSlug}/events/${result.id}`;
    } else if (result.type === "venue") {
      // Extract slug from href like /venue/slug
      const slug = result.href.split("/").pop();
      return `/${portalSlug}/spots/${slug}`;
    } else if (result.type === "organizer") {
      const slug = result.href.split("/").pop();
      return `/${portalSlug}/community/${slug}`;
    }
    return result.href;
  }

  // Trigger search when debounced query changes
  useEffect(() => {
    search(debouncedQuery);
    fetchSuggestions(debouncedQuery);
  }, [debouncedQuery, search, fetchSuggestions]);

  // Re-search when filter changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      search(debouncedQuery);
    }
  }, [activeTypeFilter, debouncedQuery, search]);

  const handlePopularSearch = (term: string) => {
    setQuery(term);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
  };

  const handleDidYouMeanClick = (suggestion: string) => {
    setQuery(suggestion);
    setDidYouMean([]);
  };

  const handleResultClick = () => {
    onClose();
  };

  const handleTypeFilterClick = (type: "event" | "venue" | "organizer") => {
    setActiveTypeFilter(activeTypeFilter === type ? null : type);
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const hasResults = results.length > 0;
  const showSuggestions = query.length < 2;
  const showAutocompleteSuggestions = suggestions.length > 0 && !hasResults && !isLoading;

  // Filter results by active type
  const filteredResults = activeTypeFilter
    ? results.filter((r) => r.type === activeTypeFilter)
    : results;

  // Get facet count for a type
  const getFacetCount = (type: string): number => {
    const facet = facets.find((f) => f.type === type);
    return facet?.count || 0;
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
          {/* Search Input */}
          <div className="rounded-2xl border border-[var(--twilight)] overflow-hidden shadow-2xl bg-[var(--night)]">
            <div className="flex items-center px-4 py-3">
              <svg
                className="w-5 h-5 text-[var(--muted)] mr-3"
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
                placeholder="Find the good stuff..."
                className="flex-1 bg-transparent text-[var(--cream)] placeholder:text-[var(--muted)] outline-none text-lg font-display"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="p-1 hover:bg-[var(--twilight)] rounded-full transition-colors"
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
            </div>

            {/* Type Filter Pills */}
            {query.length >= 2 && facets.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 border-t border-[var(--twilight)]">
                <button
                  onClick={() => setActiveTypeFilter(null)}
                  className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                    !activeTypeFilter
                      ? "bg-[var(--neon-magenta)]/20 text-[var(--neon-magenta)]"
                      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  All
                </button>
                {getFacetCount("event") > 0 && (
                  <button
                    onClick={() => handleTypeFilterClick("event")}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                      activeTypeFilter === "event"
                        ? "bg-[var(--neon-magenta)]/20 text-[var(--neon-magenta)]"
                        : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                    }`}
                  >
                    Events ({getFacetCount("event")})
                  </button>
                )}
                {getFacetCount("venue") > 0 && (
                  <button
                    onClick={() => handleTypeFilterClick("venue")}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                      activeTypeFilter === "venue"
                        ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)]"
                        : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                    }`}
                  >
                    Venues ({getFacetCount("venue")})
                  </button>
                )}
                {getFacetCount("organizer") > 0 && (
                  <button
                    onClick={() => handleTypeFilterClick("organizer")}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                      activeTypeFilter === "organizer"
                        ? "bg-[var(--coral)]/20 text-[var(--coral)]"
                        : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                    }`}
                  >
                    Organizers ({getFacetCount("organizer")})
                  </button>
                )}
              </div>
            )}

            {/* Results */}
            {(hasResults || showSuggestions || showAutocompleteSuggestions || isLoading || didYouMean.length > 0) && (
              <div className="border-t border-[var(--twilight)] max-h-[60vh] overflow-y-auto">
                {isLoading && (
                  <div className="p-4 text-center">
                    <div className="animate-spin h-5 w-5 border-2 border-[var(--neon-magenta)] border-t-transparent rounded-full mx-auto" />
                    <p className="text-xs text-[var(--muted)] mt-2">Hold your horses...</p>
                  </div>
                )}

                {/* Did You Mean? */}
                {!isLoading && didYouMean.length > 0 && !hasResults && (
                  <div className="p-3 border-b border-[var(--twilight)]">
                    <p className="text-sm text-[var(--muted)]">
                      Maybe more like:{" "}
                      {didYouMean.map((suggestion, i) => (
                        <span key={suggestion}>
                          <button
                            onClick={() => handleDidYouMeanClick(suggestion)}
                            className="text-[var(--neon-cyan)] hover:underline"
                          >
                            {suggestion}
                          </button>
                          {i < didYouMean.length - 1 && ", "}
                        </span>
                      ))}
                    </p>
                  </div>
                )}

                {/* Autocomplete Suggestions */}
                {!isLoading && showAutocompleteSuggestions && (
                  <div className="p-3">
                    <h3 className="text-xs font-mono font-semibold text-[var(--muted)] uppercase tracking-wider mb-2 px-2">
                      Suggestions
                    </h3>
                    <div className="space-y-1">
                      {suggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.type}-${suggestion.text}`}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-[var(--twilight)] transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[var(--twilight)] flex items-center justify-center flex-shrink-0">
                            <SuggestionIcon type={suggestion.type} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[var(--cream)] truncate">{suggestion.text}</p>
                            <p className="text-xs text-[var(--muted)] capitalize">{suggestion.type}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!isLoading && showSuggestions && (
                  <div className="p-4">
                    <h3 className="text-xs font-mono font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                      Hot right now
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {POPULAR_SEARCHES.map((term) => (
                        <button
                          key={term}
                          onClick={() => handlePopularSearch(term)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--dusk)] transition-colors text-sm font-mono"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                            />
                          </svg>
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!isLoading && hasResults && (
                  <div className="divide-y divide-[var(--twilight)]">
                    {/* Events */}
                    {filteredResults.filter((r) => r.type === "event").length > 0 && (
                      <div className="p-3">
                        <h3 className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--muted)] uppercase tracking-wider mb-2 px-2">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          Events
                        </h3>
                        <div className="space-y-1">
                          {filteredResults
                            .filter((r) => r.type === "event")
                            .map((result) => (
                              <Link
                                key={result.id}
                                href={result.href}
                                onClick={handleResultClick}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--twilight)] transition-colors group"
                              >
                                <div className="w-10 h-10 rounded-lg bg-[var(--neon-magenta)]/10 flex items-center justify-center flex-shrink-0">
                                  <svg
                                    className="w-5 h-5 text-[var(--neon-magenta)]"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-[var(--cream)] truncate group-hover:text-[var(--neon-magenta)] transition-colors">
                                    {result.title}
                                  </p>
                                  <p className="text-xs text-[var(--muted)]">
                                    {result.subtitle}
                                    {result.metadata?.date && ` · ${result.metadata.date}`}
                                  </p>
                                </div>
                                {result.metadata?.isFree && (
                                  <span className="text-xs bg-[var(--neon-green)]/20 text-[var(--neon-green)] px-2 py-0.5 rounded-full flex-shrink-0">
                                    Free
                                  </span>
                                )}
                              </Link>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Venues */}
                    {filteredResults.filter((r) => r.type === "venue").length > 0 && (
                      <div className="p-3">
                        <h3 className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--muted)] uppercase tracking-wider mb-2 px-2">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                          Venues
                        </h3>
                        <div className="space-y-1">
                          {filteredResults
                            .filter((r) => r.type === "venue")
                            .map((result) => (
                              <Link
                                key={result.id}
                                href={result.href}
                                onClick={handleResultClick}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--twilight)] transition-colors group"
                              >
                                <div className="w-10 h-10 rounded-lg bg-[var(--neon-cyan)]/10 flex items-center justify-center flex-shrink-0">
                                  <svg
                                    className="w-5 h-5 text-[var(--neon-cyan)]"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                    />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-[var(--cream)] truncate group-hover:text-[var(--neon-cyan)] transition-colors">
                                    {result.title}
                                  </p>
                                  <p className="text-xs text-[var(--muted)]">{result.subtitle}</p>
                                </div>
                              </Link>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Organizers */}
                    {filteredResults.filter((r) => r.type === "organizer").length > 0 && (
                      <div className="p-3">
                        <h3 className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--muted)] uppercase tracking-wider mb-2 px-2">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          Organizers
                        </h3>
                        <div className="space-y-1">
                          {filteredResults
                            .filter((r) => r.type === "organizer")
                            .map((result) => (
                              <Link
                                key={result.id}
                                href={result.href}
                                onClick={handleResultClick}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--twilight)] transition-colors group"
                              >
                                <div className="w-10 h-10 rounded-lg bg-[var(--coral)]/10 flex items-center justify-center flex-shrink-0">
                                  <svg
                                    className="w-5 h-5 text-[var(--coral)]"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                    />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
                                    {result.title}
                                  </p>
                                  <p className="text-xs text-[var(--muted)] capitalize">{result.subtitle}</p>
                                </div>
                              </Link>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* No Results */}
                {!isLoading && query.length >= 2 && !hasResults && suggestions.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-[var(--muted)]">Nothing. Absolutely nothing. The void stares back.</p>
                    <p className="text-sm text-[var(--muted)] opacity-60 mt-1">
                      Nothing here. Try searching better.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Close hint */}
          <p className="text-center text-xs text-[var(--muted)] mt-3">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs">
              ESC
            </kbd>{" "}
            to bail
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}

// Helper component for suggestion type icons
function SuggestionIcon({ type }: { type: string }) {
  switch (type) {
    case "event":
      return (
        <svg className="w-4 h-4 text-[var(--neon-magenta)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case "venue":
      return (
        <svg className="w-4 h-4 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "neighborhood":
      return (
        <svg className="w-4 h-4 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      );
    case "organizer":
      return (
        <svg className="w-4 h-4 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "category":
      return (
        <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      );
    case "tag":
    case "vibe":
      return (
        <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
  }
}
