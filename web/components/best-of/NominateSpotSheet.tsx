"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "@/components/SmartImage";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";

interface VenueResult {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  imageUrl: string | null;
}

interface NominateSpotSheetProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  accentColor: string;
  portalSlug: string;
  onNominated: () => void;
}

export default function NominateSpotSheet({
  isOpen,
  onClose,
  categoryId,
  categorySlug,
  categoryName,
  accentColor,
  portalSlug,
  onNominated,
}: NominateSpotSheetProps) {
  const { authFetch } = useAuthenticatedFetch();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<VenueResult | null>(null);
  const [isNominating, setIsNominating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setError(null);
    }
  }, [isOpen]);

  const searchVenues = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/venues/search?q=${encodeURIComponent(q)}&portal=${portalSlug}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        const venues = (data.venues ?? []).map((v: Record<string, unknown>) => ({
          id: v.id as number,
          name: v.name as string,
          slug: (v.slug as string) ?? null,
          neighborhood: (v.neighborhood as string) ?? null,
          imageUrl: (v.hero_image_url as string) ?? (v.image_url as string) ?? null,
        }));
        setResults(venues);
      }
    } catch {
      // silent
    } finally {
      setIsSearching(false);
    }
  }, [portalSlug]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelected(null);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchVenues(value), 300);
  };

  const handleNominate = async () => {
    if (!selected || isNominating) return;
    setIsNominating(true);
    setError(null);

    const { error: apiError } = await authFetch<{ success: boolean }>(`/api/best-of/${categorySlug}/nominate`, {
      method: "POST",
      body: { categoryId, venueId: selected.id },
    });

    if (apiError) {
      setError(apiError);
      setIsNominating(false);
      return;
    }

    setIsNominating(false);
    onNominated();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 z-50 animate-fade-in" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div
          className="bg-[var(--night)] rounded-t-2xl max-w-lg mx-auto max-h-[80vh] flex flex-col"
          style={{ borderTop: `2px solid ${accentColor}` }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-12 h-1.5 rounded-full bg-white/20" />
          </div>

          <div className="px-4 pb-6 flex flex-col flex-1 min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <h3 className="text-base font-semibold text-[var(--cream)]">Nominate a Spot</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Add a contender to <span style={{ color: accentColor }}>{categoryName}</span>
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-[var(--muted)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search input */}
            <div className="relative flex-shrink-0 mb-3">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: query ? accentColor : "var(--muted)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search spots..."
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl text-sm text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none transition-all"
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = `${accentColor}50`;
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}20`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--twilight)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: `${accentColor}40`, borderTopColor: "transparent" }}
                  />
                </div>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
              {results.length === 0 && query.length >= 2 && !isSearching && (
                <div className="text-center py-8">
                  <p className="text-xs text-[var(--muted)]">No spots found for &ldquo;{query}&rdquo;</p>
                  <p className="text-[10px] text-[var(--muted)] opacity-60 mt-1">
                    Try a different search term
                  </p>
                </div>
              )}
              {results.map((venue) => {
                const isSelected = selected?.id === venue.id;
                return (
                  <button
                    key={venue.id}
                    onClick={() => setSelected(venue)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: isSelected ? `${accentColor}15` : "transparent",
                      border: isSelected ? `1px solid ${accentColor}30` : "1px solid transparent",
                    }}
                  >
                    {venue.imageUrl ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                        <Image
                          src={venue.imageUrl}
                          alt={venue.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex-shrink-0 bg-[var(--dusk)] flex items-center justify-center">
                        <span className="text-xs text-[var(--muted)] font-mono">
                          {venue.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: isSelected ? accentColor : "var(--cream)" }}
                      >
                        {venue.name}
                      </p>
                      {venue.neighborhood && (
                        <p className="text-[11px] text-[var(--muted)] truncate">{venue.neighborhood}</p>
                      )}
                    </div>
                    {isSelected && (
                      <svg className="w-5 h-5 flex-shrink-0" style={{ color: accentColor }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 mt-2 flex-shrink-0">{error}</p>
            )}

            {/* Nominate button */}
            <button
              onClick={handleNominate}
              disabled={!selected || isNominating}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-mono font-medium transition-all flex-shrink-0"
              style={
                selected && !isNominating
                  ? {
                      background: accentColor,
                      color: "var(--void)",
                      boxShadow: `0 0 12px ${accentColor}30`,
                    }
                  : {
                      background: "rgba(255,255,255,0.06)",
                      color: "var(--muted)",
                      cursor: "not-allowed",
                    }
              }
            >
              {isNominating ? "Nominating..." : selected ? `Nominate ${selected.name}` : "Select a spot"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
