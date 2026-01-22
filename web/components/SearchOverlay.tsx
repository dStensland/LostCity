"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePortal } from "@/lib/portal-context";

interface SearchResult {
  id: number | string;
  type: "event" | "venue" | "neighborhood" | "organizer";
  title: string;
  subtitle?: string;
  href: string;
  isLive?: boolean;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_SEARCHES = ["Live Music", "Comedy", "Free Events", "Rooftop", "Late Night"];

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const { portal } = usePortal();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Search logic
  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      type EventRow = {
        id: number;
        title: string;
        start_date: string;
        start_time: string | null;
        is_live: boolean | null;
        venue: { name: string; neighborhood: string | null } | null;
      };

      type VenueRow = {
        id: number;
        name: string;
        neighborhood: string | null;
        slug: string;
      };

      type ProducerRow = {
        id: string;
        name: string;
        org_type: string;
        slug: string;
      };

      // Search events
      const { data: events } = await supabase
        .from("events")
        .select("id, title, start_date, start_time, is_live, venue:venues(name, neighborhood)")
        .ilike("title", `%${searchQuery}%`)
        .gte("start_date", new Date().toISOString().split("T")[0])
        .order("start_date", { ascending: true })
        .limit(5);

      // Search venues
      const { data: venues } = await supabase
        .from("venues")
        .select("id, name, neighborhood, slug")
        .or(`name.ilike.%${searchQuery}%,neighborhood.ilike.%${searchQuery}%`)
        .limit(4);

      // Search organizers (event producers)
      const { data: producers } = await supabase
        .from("event_producers")
        .select("id, name, org_type, slug")
        .ilike("name", `%${searchQuery}%`)
        .eq("hidden", false)
        .limit(3);

      const searchResults: SearchResult[] = [];
      const eventRows = events as EventRow[] | null;
      const venueRows = venues as VenueRow[] | null;
      const producerRows = producers as ProducerRow[] | null;

      // Add events
      if (eventRows) {
        for (const event of eventRows) {
          searchResults.push({
            id: event.id,
            type: "event",
            title: event.title,
            subtitle: event.venue ? `${event.venue.name} · ${event.start_date}` : event.start_date,
            href: portal?.slug ? `/${portal.slug}/events/${event.id}` : `/events/${event.id}`,
            isLive: event.is_live || false,
          });
        }
      }

      // Add venues
      if (venueRows) {
        for (const venue of venueRows) {
          searchResults.push({
            id: venue.id,
            type: "venue",
            title: venue.name,
            subtitle: venue.neighborhood || undefined,
            href: portal?.slug ? `/${portal.slug}/spots/${venue.slug}` : `/spots/${venue.slug}`,
          });
        }
      }

      // Add organizers
      if (producerRows) {
        for (const producer of producerRows) {
          searchResults.push({
            id: producer.id,
            type: "organizer",
            title: producer.name,
            subtitle: producer.org_type.replace(/_/g, " "),
            href: portal?.slug ? `/${portal.slug}/community/${producer.slug}` : `/community/${producer.slug}`,
          });
        }
      }

      setResults(searchResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [portal?.slug]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handlePopularSearch = (term: string) => {
    setQuery(term);
  };

  const handleResultClick = () => {
    onClose();
  };

  if (!isOpen) return null;

  const hasResults = results.length > 0;
  const showSuggestions = query.length < 2;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--void)]/80 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Search Container */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 pt-20 animate-fade-up">
        <div className="max-w-2xl mx-auto">
          {/* Search Input */}
          <div className="glass rounded-2xl border border-[var(--twilight)] overflow-hidden shadow-2xl">
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
                placeholder="Search events, venues, organizers..."
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

            {/* Results */}
            {(hasResults || showSuggestions || isLoading) && (
              <div className="border-t border-[var(--twilight)] max-h-[60vh] overflow-y-auto">
                {isLoading && (
                  <div className="p-4 text-center">
                    <div className="animate-spin h-5 w-5 border-2 border-[var(--neon-magenta)] border-t-transparent rounded-full mx-auto" />
                  </div>
                )}

                {!isLoading && showSuggestions && (
                  <div className="p-4">
                    <h3 className="text-xs font-mono font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                      Popular Searches
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
                    {results.filter((r) => r.type === "event").length > 0 && (
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
                          {results
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
                                  <p className="text-xs text-[var(--muted)]">{result.subtitle}</p>
                                </div>
                                {result.isLive && (
                                  <span className="text-xs bg-[var(--neon-red)]/20 text-[var(--neon-red)] px-2 py-0.5 rounded-full flex-shrink-0">
                                    Live
                                  </span>
                                )}
                              </Link>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Venues */}
                    {results.filter((r) => r.type === "venue").length > 0 && (
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
                          {results
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
                    {results.filter((r) => r.type === "organizer").length > 0 && (
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
                          {results
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
                {!isLoading && query.length >= 2 && !hasResults && (
                  <div className="p-8 text-center">
                    <p className="text-[var(--muted)]">No results found for &quot;{query}&quot;</p>
                    <p className="text-sm text-[var(--muted)] opacity-60 mt-1">
                      Try searching for events, venues, or organizers
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Close hint */}
          <p className="text-center text-xs text-[var(--muted)] mt-3">
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs">
              ESC
            </kbd>{" "}
            to close
          </p>
        </div>
      </div>
    </>
  );
}
