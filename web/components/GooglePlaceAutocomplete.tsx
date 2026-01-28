"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";

interface VenueResult {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  venue_type: string | null;
}

interface GooglePlaceResult {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
}

type SearchResult =
  | { type: "venue"; data: VenueResult }
  | { type: "google"; data: GooglePlaceResult };

interface GooglePlaceAutocompleteProps {
  value: {
    name: string;
    address?: string;
    google_place_id?: string;
    venue_id?: number;
  } | null;
  onChange: (result: {
    name: string;
    address?: string;
    google_place_id?: string;
    venue_id?: number;
    location?: { lat: number; lng: number };
  } | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

export function GooglePlaceAutocomplete({
  value,
  onChange,
  placeholder = "Search for a place...",
  required = false,
  disabled = false,
  error,
}: GooglePlaceAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Search venues and Google Places
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const searchPlaces = async () => {
      setLoading(true);
      try {
        // Search local database first
        const venueRes = await fetch(
          `/api/venues/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`
        );
        const venueData = await venueRes.json();
        const venueResults: SearchResult[] = (venueData.venues || []).map(
          (venue: VenueResult) => ({
            type: "venue" as const,
            data: venue,
          })
        );

        // Search Google Places
        const googleRes = await fetch("/api/places/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: debouncedQuery }),
        });

        let googleResults: SearchResult[] = [];
        if (googleRes.ok) {
          const googleData = await googleRes.json();
          googleResults = (googleData.places || []).map(
            (place: GooglePlaceResult) => ({
              type: "google" as const,
              data: place,
            })
          );
        }

        // Combine results: DB results first, then Google results
        setResults([...venueResults, ...googleResults]);
      } catch (err) {
        console.error("Place search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    searchPlaces();
  }, [debouncedQuery]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectResult = useCallback((result: SearchResult) => {
    if (result.type === "venue") {
      const venue = result.data;
      onChange({
        name: venue.name,
        address: venue.address || undefined,
        venue_id: venue.id,
      });
      setQuery(venue.name);
    } else {
      const place = result.data;
      onChange({
        name: place.name,
        address: place.address,
        google_place_id: place.id,
        location: place.location,
      });
      setQuery(place.name);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, [onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && results[highlightedIndex]) {
            selectResult(results[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, highlightedIndex, results, selectResult]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsOpen(true);
    setHighlightedIndex(-1);

    // Clear selection if user is typing
    if (value && value.name !== newQuery) {
      onChange(null);
    }
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    inputRef.current?.focus();
  };

  const noResults = !loading && results.length === 0 && query.length >= 2;

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--coral)]/50 transition-colors ${
            error
              ? "border-[var(--coral)] focus:border-[var(--coral)]"
              : "border-[var(--twilight)] focus:border-[var(--coral)]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {value && !loading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <svg
              className="w-4 h-4"
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

      {error && <p className="text-[var(--coral)] font-mono text-xs mt-1">{error}</p>}

      {/* Dropdown */}
      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] shadow-xl max-h-64 overflow-y-auto"
        >
          {results.map((result, index) => {
            const isHighlighted = highlightedIndex === index;
            const isVenue = result.type === "venue";
            const data = result.data;

            return (
              <button
                key={
                  isVenue
                    ? `venue-${(data as VenueResult).id}`
                    : `google-${(data as GooglePlaceResult).id}`
                }
                type="button"
                onClick={() => selectResult(result)}
                className={`w-full px-4 py-3 text-left hover:bg-[var(--twilight)] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--coral)]/50 ${
                  isHighlighted ? "bg-[var(--twilight)] ring-1 ring-[var(--coral)]/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-[var(--cream)]">
                      {data.name}
                    </div>
                    {isVenue ? (
                      <>
                        {((data as VenueResult).neighborhood ||
                          (data as VenueResult).address) && (
                          <div className="font-mono text-xs text-[var(--muted)] mt-0.5">
                            {(data as VenueResult).neighborhood ||
                              (data as VenueResult).address}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {(data as GooglePlaceResult).address && (
                          <div className="font-mono text-xs text-[var(--muted)] mt-0.5">
                            {(data as GooglePlaceResult).address}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {isVenue ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-[var(--neon-green)]/10 text-[var(--neon-green)] border border-[var(--neon-green)]/20">
                        In Database
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/20">
                        From Google
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {noResults && (
            <div className="px-4 py-3 text-[var(--muted)] font-mono text-sm">
              No places found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { GooglePlaceAutocompleteProps };
