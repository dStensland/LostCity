"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import type { VenueWithCount } from "@/lib/search";

interface Props {
  venues: VenueWithCount[];
}

export default function VenueFilter({ venues }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentVenueId = searchParams.get("venue");
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentVenue = currentVenueId
    ? venues.find((v) => v.id.toString() === currentVenueId)
    : null;

  // Top 5 venues by event count (already sorted)
  const topVenues = venues.slice(0, 5);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const setVenue = useCallback(
    (venueId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (venueId === null) {
        params.delete("venue");
      } else {
        params.set("venue", venueId);
      }

      params.delete("page");

      const newUrl = params.toString() ? `/?${params.toString()}` : "/";
      router.push(newUrl, { scroll: false });
      setIsOpen(false);
      setSearch("");
    },
    [router, searchParams]
  );

  const filteredVenues = search.trim()
    ? venues.filter((v) =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        (v.neighborhood && v.neighborhood.toLowerCase().includes(search.toLowerCase()))
      )
    : [];

  const isSearching = search.trim().length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`filter-btn flex items-center gap-1.5 ${currentVenue ? "active" : ""}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="max-w-[80px] sm:max-w-[120px] truncate">
          {currentVenue ? currentVenue.name : "Venue"}
        </span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-[var(--twilight)]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search venues..."
              className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded text-[var(--cream)] placeholder-[var(--muted)] text-sm focus:outline-none focus:border-[var(--soft)]"
              autoFocus
            />
          </div>

          {/* Venue list */}
          <div className="max-h-72 overflow-y-auto">
            {/* Clear filter option */}
            {currentVenue && (
              <button
                type="button"
                onClick={() => setVenue(null)}
                className="w-full px-3 py-2 text-left text-sm text-[var(--coral)] hover:bg-[var(--twilight)] flex items-center gap-2 border-b border-[var(--twilight)]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear venue filter
              </button>
            )}

            {isSearching ? (
              // Search results
              filteredVenues.length === 0 ? (
                <div className="px-3 py-4 text-center text-[var(--muted)] text-sm">
                  No venues found
                </div>
              ) : (
                filteredVenues.slice(0, 20).map((venue) => (
                  <VenueRow
                    key={venue.id}
                    venue={venue}
                    isSelected={currentVenueId === venue.id.toString()}
                    onSelect={() => setVenue(venue.id.toString())}
                  />
                ))
              )
            ) : (
              // Default view: Top 5 popular venues
              <>
                <div className="px-3 py-2 text-xs font-mono font-medium text-[var(--muted)] uppercase tracking-widest bg-[var(--night)]">
                  Popular Venues
                </div>
                {topVenues.map((venue) => (
                  <VenueRow
                    key={venue.id}
                    venue={venue}
                    isSelected={currentVenueId === venue.id.toString()}
                    onSelect={() => setVenue(venue.id.toString())}
                    showBadge
                  />
                ))}
                <div className="px-3 py-2 text-xs text-[var(--muted)] text-center border-t border-[var(--twilight)]">
                  Search to find more venues
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VenueRow({
  venue,
  isSelected,
  onSelect,
  showBadge = false,
}: {
  venue: VenueWithCount;
  isSelected: boolean;
  onSelect: () => void;
  showBadge?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-3 py-2.5 text-left hover:bg-[var(--twilight)] transition-colors ${
        isSelected ? "bg-[var(--twilight)]" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm text-[var(--cream)] truncate">{venue.name}</div>
          {venue.neighborhood && (
            <div className="text-xs text-[var(--muted)]">{venue.neighborhood}</div>
          )}
        </div>
        <span className={`flex-shrink-0 text-xs font-mono px-2 py-0.5 rounded ${
          showBadge
            ? "bg-[var(--twilight)] text-[var(--coral)] font-medium"
            : "text-[var(--muted)]"
        }`}>
          {venue.event_count}
        </span>
      </div>
    </button>
  );
}
