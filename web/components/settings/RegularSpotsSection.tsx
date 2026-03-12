"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MapPin, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import { MAX_REGULAR_SPOTS, type RegularSpotVenue } from "@/lib/types/profile";
// ============================================================================
// Types
// ============================================================================

type SpotWithAddedAt = RegularSpotVenue & { added_at: string };

type VenueSearchResult = {
  id: number;
  name: string;
  neighborhood: string | null;
  image_url: string | null;
};

// ============================================================================
// SpotRow
// ============================================================================

type SpotRowProps = {
  spot: SpotWithAddedAt;
  onRemove: (venueId: number) => void;
  removing: boolean;
};

const SpotRow = memo(function SpotRow({ spot, onRemove, removing }: SpotRowProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--night)] border border-[var(--twilight)]/40">
      <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--twilight)]">
        {spot.image_url ? (
          <Image
            src={spot.image_url}
            alt={spot.name}
            width={40}
            height={40}
            className="object-cover w-full h-full"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin size={16} weight="duotone" className="text-[var(--muted)]" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] truncate">{spot.name}</p>
        {spot.neighborhood && (
          <p className="text-xs text-[var(--muted)] truncate">{spot.neighborhood}</p>
        )}
      </div>

      <button
        onClick={() => onRemove(spot.venue_id)}
        disabled={removing}
        aria-label={`Remove ${spot.name}`}
        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[var(--coral)]/10 text-[var(--muted)] hover:text-[var(--coral)] transition-colors disabled:opacity-40"
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
});

// ============================================================================
// SearchDropdown
// ============================================================================

type SearchDropdownProps = {
  results: VenueSearchResult[];
  isLoading: boolean;
  query: string;
  existingIds: Set<number>;
  onSelect: (result: VenueSearchResult) => void;
};

function SearchDropdown({ results, isLoading, query, existingIds, onSelect }: SearchDropdownProps) {
  if (!query || query.trim().length < 2) return null;

  return (
    <div className="absolute z-10 mt-1 w-full rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] shadow-card-lg overflow-hidden">
      {isLoading && (
        <div className="p-3 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
          <div className="w-3 h-3 border border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
          Searching...
        </div>
      )}

      {!isLoading && results.length === 0 && (
        <div className="p-3 text-xs font-mono text-[var(--muted)]">No venues found</div>
      )}

      {!isLoading &&
        results.map((result) => {
          const alreadyAdded = existingIds.has(result.id);
          return (
            <button
              key={result.id}
              onClick={() => !alreadyAdded && onSelect(result)}
              disabled={alreadyAdded}
              className="flex items-center gap-3 p-3 w-full text-left hover:bg-[var(--twilight)]/40 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default"
            >
              <div className="w-8 h-8 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--twilight)] flex items-center justify-center">
                <MapPin size={12} weight="duotone" className="text-[var(--muted)]" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--cream)] truncate">{result.name}</p>
                {result.neighborhood && (
                  <p className="text-xs text-[var(--muted)] truncate">{result.neighborhood}</p>
                )}
              </div>

              {alreadyAdded && (
                <span className="flex-shrink-0 text-2xs font-mono font-bold uppercase tracking-wider text-[var(--muted)]">
                  Added
                </span>
              )}
            </button>
          );
        })}
    </div>
  );
}

// ============================================================================
// RegularSpotsSection
// ============================================================================

export const RegularSpotsSection = memo(function RegularSpotsSection() {
  const { profile } = useAuth();
  const username = profile?.username;

  const [spots, setSpots] = useState<SpotWithAddedAt[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set());
  const [addingId, setAddingId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VenueSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ------------------------------------------------------------------
  // Fetch spots on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!username) {
      setLoadingSpots(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoadingSpots(true);
      setFetchError(null);
      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(username)}/spots`);
        if (cancelled) return;
        if (!res.ok) {
          setFetchError("Failed to load spots");
          return;
        }
        const { spots: data } = (await res.json()) as { spots: SpotWithAddedAt[] };
        if (!cancelled) setSpots(data ?? []);
      } catch {
        if (!cancelled) setFetchError("Failed to load spots");
      } finally {
        if (!cancelled) setLoadingSpots(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [username]);

  // ------------------------------------------------------------------
  // Close dropdown on outside click
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ------------------------------------------------------------------
  // Debounced venue search
  // ------------------------------------------------------------------
  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSearchResults([]);
      setDropdownOpen(false);
      return;
    }

    setSearchLoading(true);
    setDropdownOpen(true);

    try {
      const params = new URLSearchParams({ q, limit: "5", city: "Atlanta" });
      const res = await fetch(`/api/venues/search?${params}`);
      if (!res.ok) {
        setSearchResults([]);
        return;
      }
      const data = (await res.json()) as {
        venues: VenueSearchResult[];
      };

      setSearchResults(data.venues ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(q);
    }, 300);
  };

  // ------------------------------------------------------------------
  // Add spot
  // ------------------------------------------------------------------
  const handleAddSpot = useCallback(
    async (result: VenueSearchResult) => {
      if (!username) return;

      setAddingId(result.id);
      setDropdownOpen(false);
      setSearchQuery("");
      setSearchResults([]);

      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(username)}/spots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venue_id: result.id }),
        });

        if (!res.ok) {
          // 422 = limit reached; surface nothing — the UI already prevents adding past 10
          return;
        }

        // Optimistically add to list
        const newSpot: SpotWithAddedAt = {
          venue_id: result.id,
          name: result.name,
          slug: null,
          neighborhood: result.neighborhood,
          image_url: result.image_url,
          added_at: new Date().toISOString(),
        };

        setSpots((prev) => {
          if (prev.some((s) => s.venue_id === result.id)) return prev;
          return [newSpot, ...prev];
        });
      } finally {
        setAddingId(null);
      }
    },
    [username]
  );

  // ------------------------------------------------------------------
  // Remove spot
  // ------------------------------------------------------------------
  const handleRemoveSpot = useCallback(
    async (venueId: number) => {
      if (!username) return;

      // Optimistic removal
      setRemovingIds((prev) => new Set(prev).add(venueId));
      const previous = spots;
      setSpots((prev) => prev.filter((s) => s.venue_id !== venueId));

      try {
        const res = await fetch(`/api/profile/${encodeURIComponent(username)}/spots`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venue_id: venueId }),
        });

        if (!res.ok) {
          // Rollback on failure
          setSpots(previous);
        }
      } catch {
        setSpots(previous);
      } finally {
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(venueId);
          return next;
        });
      }
    },
    [username, spots]
  );

  // ------------------------------------------------------------------
  // Guard: no username = profile setup incomplete
  // ------------------------------------------------------------------
  if (!username) return null;

  const existingIds = new Set(spots.map((s) => s.venue_id));
  const atMax = spots.length >= MAX_REGULAR_SPOTS;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--muted)]">
          My Regular Spots
        </h3>
        <p className="font-mono text-xs text-[var(--muted)] mt-1">
          Pin your favorite spots to your profile (max {MAX_REGULAR_SPOTS})
        </p>
      </div>

      {/* Error state */}
      {fetchError && (
        <p className="p-3 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)] text-[var(--coral)] font-mono text-xs">
          {fetchError}
        </p>
      )}

      {/* Loading skeleton */}
      {loadingSpots && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Spots list */}
      {!loadingSpots && spots.length > 0 && (
        <div className="space-y-2">
          {spots.map((spot) => (
            <SpotRow
              key={spot.venue_id}
              spot={spot}
              onRemove={handleRemoveSpot}
              removing={removingIds.has(spot.venue_id)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingSpots && spots.length === 0 && !fetchError && (
        <p className="font-mono text-xs text-[var(--muted)] py-2">
          No regular spots yet. Search for a venue below to add one.
        </p>
      )}

      {/* Add spot search */}
      {!atMax && (
        <div className="relative">
          <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
            Add a spot
          </label>

          <div className="relative">
            <MagnifyingGlass
              size={14}
              weight="bold"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setDropdownOpen(true);
              }}
              placeholder="Search venues..."
              disabled={!!addingId}
              className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors disabled:opacity-50"
            />
          </div>

          {dropdownOpen && (
            <div ref={dropdownRef}>
              <SearchDropdown
                results={searchResults}
                isLoading={searchLoading}
                query={searchQuery}
                existingIds={existingIds}
                onSelect={handleAddSpot}
              />
            </div>
          )}
        </div>
      )}

      {/* Count */}
      <p className="font-mono text-xs text-[var(--muted)] mt-2">
        {spots.length} of {MAX_REGULAR_SPOTS} spots
        {atMax && " — remove a spot to add another"}
      </p>
    </section>
  );
});

export type { SpotWithAddedAt };
