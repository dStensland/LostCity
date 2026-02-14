"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth-context";
import { useDebounce } from "@/lib/hooks/useDebounce";

interface VenueResult {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  venue_type: string | null;
}

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  website?: string;
  category?: string;
  categoryName?: string;
}

type SearchResult =
  | { type: "venue"; data: VenueResult }
  | { type: "place"; data: PlaceResult };

type AddedItem = { name: string; slug?: string; pending?: boolean };

interface QuickAddVenueProps {
  /** Element to anchor the popover to. Renders a button if not provided. */
  trigger?: React.ReactNode;
  /** Called when a venue is added (either existing or newly submitted) */
  onAdd?: (venue: { id?: number; name: string; slug?: string }) => void;
  /** Button size variant */
  size?: "sm" | "md";
}

export default function QuickAddVenue({ trigger, onAdd, size = "sm" }: QuickAddVenueProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [added, setAdded] = useState<AddedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [isOpen]);

  // Search
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setSearching(true);

    (async () => {
      try {
        const [venueRes, placeRes] = await Promise.all([
          fetch(`/api/venues/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`),
          fetch("/api/places/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: debouncedQuery }),
          }),
        ]);

        if (cancelled) return;

        const venueData = await venueRes.json();
        const venues: SearchResult[] = (venueData.venues || []).map(
          (v: VenueResult) => ({ type: "venue" as const, data: v })
        );

        let places: SearchResult[] = [];
        if (placeRes.ok) {
          const placeData = await placeRes.json();
          places = (placeData.places || []).map(
            (p: PlaceResult) => ({ type: "place" as const, data: p })
          );
        }

        setResults([...venues, ...places]);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();

    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  const handleSelectExisting = useCallback((venue: VenueResult) => {
    const alreadyAdded = added.some(
      (a) => a.slug === venue.slug || a.name === venue.name
    );
    if (alreadyAdded) return;

    setAdded((prev) => [...prev, { name: venue.name, slug: venue.slug }]);
    onAdd?.({ id: venue.id, name: venue.name, slug: venue.slug });
    setQuery("");
    setResults([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [added, onAdd]);

  const handleAddNew = useCallback(async (place: PlaceResult) => {
    if (!user) {
      setError("Sign in to add places");
      return;
    }

    setSubmitting(place.id);
    setError(null);

    // Parse address
    let city = "Atlanta";
    let state = "GA";
    let zip = "";
    let streetAddress = "";
    if (place.address) {
      const parts = place.address.split(",").map((p) => p.trim());
      if (parts.length >= 1) streetAddress = parts[0];
      if (parts.length >= 2) city = parts[1];
      if (parts.length >= 3) {
        const stateZip = parts[2].split(" ");
        if (stateZip.length >= 1) state = stateZip[0];
        if (stateZip.length >= 2) zip = stateZip[1];
      }
    }

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_type: "venue",
          data: {
            name: place.name,
            address: streetAddress || undefined,
            city,
            state,
            zip: zip || undefined,
            venue_type: place.category || undefined,
            website: place.website || undefined,
            foursquare_id: place.id,
          },
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to add");

      const slug = result.venue?.slug;
      setAdded((prev) => [
        ...prev,
        { name: place.name, slug, pending: !slug },
      ]);
      onAdd?.({ name: place.name, slug });
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setSubmitting(null);
    }
  }, [user, onAdd]);

  const isAdded = (result: SearchResult) => {
    if (result.type === "venue") {
      return added.some(
        (a) => a.slug === result.data.slug || a.name === result.data.name
      );
    }
    return added.some((a) => a.name === result.data.name);
  };

  const popoverContent = isOpen ? (
    <div
      ref={popoverRef}
      className="fixed z-50 w-80 bg-[var(--night)] border border-[var(--twilight)] rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
      style={{
        top: (triggerRef.current?.getBoundingClientRect().bottom ?? 0) + 6,
        left: Math.min(
          triggerRef.current?.getBoundingClientRect().left ?? 0,
          window.innerWidth - 336
        ),
      }}
    >
      {/* Search input */}
      <div className="p-3 border-b border-[var(--twilight)]">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
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
            placeholder="Search places..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-3.5 h-3.5 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-h-64 overflow-y-auto">
        {results.length > 0 ? (
          results.map((result) => {
            const alreadyAdded = isAdded(result);
            const isPlace = result.type === "place";
            const isSubmitting =
              isPlace && submitting === (result.data as PlaceResult).id;

            return (
              <button
                key={
                  result.type === "venue"
                    ? `v-${result.data.id}`
                    : `p-${(result.data as PlaceResult).id}`
                }
                type="button"
                disabled={alreadyAdded || isSubmitting}
                onClick={() =>
                  result.type === "venue"
                    ? handleSelectExisting(result.data as VenueResult)
                    : handleAddNew(result.data as PlaceResult)
                }
                className="w-full px-3 py-2.5 text-left hover:bg-[var(--twilight)] transition-colors disabled:opacity-50 disabled:cursor-default flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-[var(--cream)] truncate">
                    {result.data.name}
                  </div>
                  <div className="font-mono text-xs text-[var(--muted)] truncate">
                    {result.type === "venue"
                      ? (result.data as VenueResult).neighborhood ||
                        (result.data as VenueResult).address
                      : [
                          (result.data as PlaceResult).categoryName,
                          (result.data as PlaceResult).address,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {alreadyAdded ? (
                    <svg
                      className="w-4 h-4 text-[var(--neon-green)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
                  ) : result.type === "venue" ? (
                    <span className="font-mono text-[10px] text-[var(--neon-green)] uppercase">
                      in db
                    </span>
                  ) : (
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  )}
                </div>
              </button>
            );
          })
        ) : query.length >= 2 && !searching ? (
          <div className="px-3 py-4 text-center font-mono text-xs text-[var(--muted)]">
            No places found
          </div>
        ) : query.length < 2 && added.length === 0 ? (
          <div className="px-3 py-4 text-center font-mono text-xs text-[var(--muted)]">
            Type to search for places
          </div>
        ) : null}
      </div>

      {/* Recently added */}
      {added.length > 0 && (
        <div className="border-t border-[var(--twilight)] px-3 py-2">
          <div className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-wider mb-1.5">
            Added ({added.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {added.map((item, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-xs bg-[var(--neon-green)]/10 text-[var(--neon-green)] border border-[var(--neon-green)]/20"
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {item.name}
                {item.pending && (
                  <span className="text-[var(--muted)]">(pending)</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-t border-[var(--twilight)] px-3 py-2 font-mono text-xs text-[var(--coral)]">
          {error}
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {trigger ? (
        <span ref={triggerRef as React.RefObject<HTMLSpanElement>} onClick={() => setIsOpen(!isOpen)}>
          {trigger}
        </span>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--coral)] hover:text-[var(--coral)] transition-colors ${
            size === "sm"
              ? "px-2.5 py-1.5 font-mono text-xs"
              : "px-3 py-2 font-mono text-sm"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add spot
        </button>
      )}

      {typeof document !== "undefined" && popoverContent
        ? createPortal(popoverContent, document.body)
        : null}
    </>
  );
}
