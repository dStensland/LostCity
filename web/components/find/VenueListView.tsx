"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef, type RefCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SPOT_TYPE_CONFIG, SPOT_TYPE_ORDER, SPOTS_TABS, type Spot, type SpotsTab } from "@/lib/spots-constants";
import { haversineKm } from "@/lib/distance";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import VenueListSkeleton from "@/components/find/VenueListSkeleton";
import CategoryTileGrid from "@/components/find/CategoryTileGrid";
import { getSpotsEmptyStateCopy } from "@/lib/empty-state-copy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortOption = "category" | "alphabetical" | "neighborhood" | "distance";

interface VenueListViewProps {
  spots: Spot[];
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  portalSlug: string;
  loading: boolean;
  fetchError: string | null;
  onRetry: () => void;
  filteredCount: number;
  totalCount: number;
  renderCard: (spot: Spot) => React.ReactNode;
  /** Whether the user has granted location (controls distance sort button visibility) */
  hasLocation?: boolean;
  /** User coordinates for computing distance sort */
  userLocation?: { lat: number; lng: number } | null;
  /** Active spots sub-tab — scopes category sort to tab's venue types */
  activeTab?: SpotsTab;
  /** Label of the active chip filter (for empty state feedback) */
  activeChipLabel?: string | null;
  /** When true, show category tile grid instead of grouped list */
  showCategoryGrid?: boolean;
  /** Callback when a category tile is clicked */
  onCategorySelect?: (venueTypes: string[]) => void;
  /** All spots for the current tab (unfiltered) — used by category grid for counts */
  allTabSpots?: Spot[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VenueListView({
  spots,
  sortBy,
  setSortBy,
  loading,
  fetchError,
  onRetry,
  filteredCount,
  totalCount,
  renderCard,
  hasLocation = false,
  userLocation,
  activeTab,
  activeChipLabel,
  showCategoryGrid,
  onCategorySelect,
  allTabSpots,
}: VenueListViewProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const alphaScrollRef = useRef<HTMLDivElement>(null);
  const prevTabRef = useRef(activeTab);
  const hasAutoExpandedRef = useRef(false);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // ── Sort ────────────────────────────────────────────────────────────────
  const sortedSpots = useMemo(() => {
    // If distance sort is requested but location was lost, fall back to category
    const effectiveSort = sortBy === "distance" && !userLocation ? "category" : sortBy;

    const sorted = [...spots];
    if (effectiveSort === "alphabetical") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (effectiveSort === "neighborhood") {
      sorted.sort((a, b) => {
        const aNeighborhood = a.neighborhood || "ZZZ";
        const bNeighborhood = b.neighborhood || "ZZZ";
        if (aNeighborhood !== bNeighborhood) return aNeighborhood.localeCompare(bNeighborhood);
        return a.name.localeCompare(b.name);
      });
    } else if (effectiveSort === "distance" && userLocation) {
      const { lat: uLat, lng: uLng } = userLocation;
      sorted.sort((a, b) => {
        // Prefer API-provided distance_km, fall back to client-side haversine
        const aDist = a.distance_km ?? (a.lat != null && a.lng != null
          ? haversineKm(uLat, uLng, a.lat, a.lng)
          : Infinity);
        const bDist = b.distance_km ?? (b.lat != null && b.lng != null
          ? haversineKm(uLat, uLng, b.lat, b.lng)
          : Infinity);
        if (aDist !== bDist) return aDist - bDist;
        return a.name.localeCompare(b.name);
      });
    } else {
      sorted.sort((a, b) => {
        const aType = a.venue_type || "other";
        const bType = b.venue_type || "other";
        const aOrder = (SPOT_TYPE_ORDER as readonly string[]).indexOf(aType);
        const bOrder = (SPOT_TYPE_ORDER as readonly string[]).indexOf(bType);
        const aIdx = aOrder === -1 ? 999 : aOrder;
        const bIdx = bOrder === -1 ? 999 : bOrder;
        if (aIdx !== bIdx) return aIdx - bIdx;
        if ((b.event_count ?? 0) !== (a.event_count ?? 0)) {
          return (b.event_count ?? 0) - (a.event_count ?? 0);
        }
        return a.name.localeCompare(b.name);
      });
    }
    return sorted;
  }, [spots, sortBy, userLocation]);

  // ── Group ──────────────────────────────────────────────────────────────
  const tabVenueTypeSet = useMemo(() => {
    if (!activeTab) return null;
    const tab = SPOTS_TABS.find((t) => t.key === activeTab);
    return tab ? new Set(tab.venueTypes) : null;
  }, [activeTab]);

  const groupedSpots = useMemo(() => {
    if (sortBy === "alphabetical" || sortBy === "distance") return null;

    const groups: Record<string, Spot[]> = {};
    for (const spot of sortedSpots) {
      const key = sortBy === "category" ? spot.venue_type || "other" : spot.neighborhood || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(spot);
    }

    if (sortBy === "category") {
      // Scope to tab's venue types when a tab is active
      const typeOrder = tabVenueTypeSet
        ? SPOT_TYPE_ORDER.filter((type) => tabVenueTypeSet.has(type) || type === "other")
        : SPOT_TYPE_ORDER;

      return (typeOrder as readonly string[]).filter((type) => groups[type]?.length > 0).map((type) => ({
        type,
        spots: groups[type],
        config: SPOT_TYPE_CONFIG[type] || SPOT_TYPE_CONFIG.other,
      }));
    } else {
      return Object.keys(groups)
        .sort()
        .map((neighborhood) => ({
          type: neighborhood,
          spots: groups[neighborhood],
          config: { label: neighborhood, color: "var(--muted)" },
        }));
    }
  }, [sortedSpots, sortBy, tabVenueTypeSet]);

  // Auto-expand top 3 categories by venue count on tab change or initial mount
  useEffect(() => {
    const tabChanged = prevTabRef.current !== activeTab;
    if (tabChanged || !hasAutoExpandedRef.current) {
      prevTabRef.current = activeTab;
      if (groupedSpots && groupedSpots.length > 0) {
        const top3 = [...groupedSpots]
          .sort((a, b) => b.spots.length - a.spots.length)
          .slice(0, 3)
          .map((g) => g.type);
        setExpandedCategories(new Set(top3));
        hasAutoExpandedRef.current = true;
      }
    }
  }, [activeTab, groupedSpots]);

  const isFlatList = sortBy === "alphabetical" || sortBy === "distance";
  const shouldVirtualize = isFlatList && sortedSpots.length > 50;

  // eslint-disable-next-line react-hooks/incompatible-library
  const alphaVirtualizer = useVirtualizer({
    count: shouldVirtualize ? sortedSpots.length : 0,
    getScrollElement: () => alphaScrollRef.current,
    estimateSize: () => 120,
    overscan: 8,
  });

  // ── Error state ────────────────────────────────────────────────────────
  if (fetchError && !loading) {
    return (
      <div className="py-10 sm:py-14 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <div className="text-[var(--soft)] font-mono text-sm">{fetchError}</div>
        <button onClick={onRetry} className="btn-primary btn-md mt-4">
          Retry
        </button>
      </div>
    );
  }

  // ── Category tile grid ────────────────────────────────────────────────
  if (showCategoryGrid && onCategorySelect) {
    return (
      <CategoryTileGrid
        spots={allTabSpots ?? spots}
        onCategorySelect={onCategorySelect}
        loading={loading}
      />
    );
  }

  // ── Initial loading state ──────────────────────────────────────────────
  if (loading && spots.length === 0) {
    return <VenueListSkeleton />;
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (filteredCount === 0 && !loading && !fetchError) {
    const emptyState = getSpotsEmptyStateCopy({ activeChipLabel });
    return (
      <div className="py-12 sm:py-16 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--twilight)]/25 border border-[var(--twilight)]/50 mb-4">
          <svg className="w-7 h-7 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="text-[var(--muted)] font-mono text-sm">
          {emptyState.headline}
        </div>
        <div className="text-[var(--muted)]/60 font-mono text-xs mt-2 mb-4">{emptyState.subline}</div>
      </div>
    );
  }

  // ── Header ─────────────────────────────────────────────────────────────
  const header = (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-[var(--muted)]">
        <span className="text-[var(--soft)] font-medium">{filteredCount}</span>
        {filteredCount !== totalCount ? ` of ${totalCount}` : ""} places
      </p>
      <div className="flex items-center gap-3">
        {/* Expand/Collapse All Toggle */}
        {sortBy !== "alphabetical" && groupedSpots && groupedSpots.length > 0 && (
          <button
            onClick={() => {
              if (expandedCategories.size === groupedSpots.length) {
                setExpandedCategories(new Set());
              } else {
                setExpandedCategories(new Set(groupedSpots.map((g) => g.type)));
              }
            }}
            className="px-2 py-1 rounded font-mono text-xs text-[var(--muted)] hover:text-[var(--soft)] transition-colors bg-[var(--twilight)]/30 hover:bg-[var(--twilight)]/50"
          >
            {expandedCategories.size === groupedSpots.length ? "Collapse all" : "Expand all"}
          </button>
        )}

        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mr-2 hidden sm:inline">Sort:</span>
          {(["category", "neighborhood", "alphabetical"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`px-2 py-1 rounded font-mono text-xs transition-all ${
                sortBy === option
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {option === "category" ? "Category" : option === "neighborhood" ? "Area" : "A-Z"}
            </button>
          ))}
          {hasLocation && (
            <button
              onClick={() => setSortBy("distance")}
              className={`px-2 py-1 rounded font-mono text-xs transition-all ${
                sortBy === "distance"
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              Near Me
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── List renders ───────────────────────────────────────────────────────
  return (
    <>
      {header}

      {/* Grouped view (category or neighborhood) */}
      {groupedSpots ? (
        <div className="space-y-3 mt-4">
          {groupedSpots.map(({ type, spots: groupSpots, config }) => {
            const isExpanded = expandedCategories.has(type);
            const accent = createCssVarClass("--accent-color", config.color, "accent");
            return (
              <div key={type}>
                <ScopedStyles css={accent?.css} />
                <button
                  onClick={() => toggleCategory(type)}
                  data-accent
                  className={`w-full flex items-center gap-2 py-3 px-1 group/header ${accent?.className ?? ""}`}
                >
                  {sortBy === "category" && <div className="w-2 h-2 rounded-sm bg-accent" />}
                  <h3
                    className={`font-mono text-xs font-medium uppercase tracking-wider flex-1 text-left ${
                      sortBy === "category" ? "text-accent" : "text-[var(--muted)]"
                    }`}
                  >
                    {config.label}
                  </h3>
                  <span className="font-mono text-xs text-[var(--muted)] mr-2">{groupSpots.length}</span>
                  <svg
                    className={`w-4 h-4 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && <div className="space-y-3 pb-4">{groupSpots.map((spot) => renderCard(spot))}</div>}
              </div>
            );
          })}
        </div>
      ) : shouldVirtualize ? (
        /* Virtualized flat list (alphabetical or distance, large result sets) */
        <div
          ref={alphaScrollRef}
          className="overflow-y-auto mt-4"
          style={{ height: "clamp(400px, calc(100dvh - 320px), 800px)" }}
        >
          <div className="relative w-full" style={{ height: `${alphaVirtualizer.getTotalSize()}px` }}>
            {alphaVirtualizer.getVirtualItems().map((virtualRow) => {
              const spot = sortedSpots[virtualRow.index];
              return (
                <div
                  key={spot.id}
                  data-index={virtualRow.index}
                  ref={alphaVirtualizer.measureElement as RefCallback<HTMLDivElement>}
                  className="absolute left-0 w-full pb-3"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {renderCard(spot)}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Simple flat list */
        <div className="space-y-3 mt-4">{sortedSpots.map((spot) => renderCard(spot))}</div>
      )}
    </>
  );
}
