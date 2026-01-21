"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SpotCard from "@/components/SpotCard";
import SpotFilterBar from "@/components/SpotFilterBar";
import SpotSearchBar from "@/components/SpotSearchBar";
import CategoryIcon, { getCategoryLabel } from "@/components/CategoryIcon";
import type { Spot } from "@/lib/spots";
import type { SortOption } from "./page";

type ViewMode = "list" | "type" | "neighborhood";

interface Props {
  spots: Spot[];
  viewMode: ViewMode;
  sortBy: SortOption;
  selectedTypes: string[];
  selectedHoods: string[];
  searchQuery: string;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SpotsContent({
  spots,
  viewMode: initialViewMode = "type",
  sortBy: initialSortBy = "events",
  selectedTypes,
  selectedHoods,
  searchQuery,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [sortBy, setSortBy] = useState<SortOption>(initialSortBy);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);

  // Request location when sorting by closest
  useEffect(() => {
    if (sortBy === "closest" && !userLocation && !locationRequested) {
      setLocationRequested(true);
      navigator.geolocation?.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Location denied, fall back to alphabetical
          setSortBy("alpha");
          updateParams({ sort: "alpha" });
        }
      );
    }
  }, [sortBy, userLocation, locationRequested]);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    router.push(`/spots${query ? `?${query}` : ""}`, { scroll: false });
  };

  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
    updateParams({ view: newMode === "type" ? null : newMode });
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    updateParams({ sort: newSort === "events" ? null : newSort });
  };

  // Sort spots based on current sort option
  const sortedSpots = useMemo(() => {
    const sorted = [...spots];

    switch (sortBy) {
      case "alpha":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "events":
        return sorted.sort((a, b) => (b.event_count ?? 0) - (a.event_count ?? 0));
      case "closest":
        if (!userLocation) return sorted;
        return sorted.sort((a, b) => {
          const distA = a.lat && a.lng
            ? calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng)
            : Infinity;
          const distB = b.lat && b.lng
            ? calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
            : Infinity;
          return distA - distB;
        });
      default:
        return sorted;
    }
  }, [spots, sortBy, userLocation]);

  // Group spots by category or neighborhood
  const groupedSpots = useMemo(() => {
    if (viewMode === "list") {
      return null;
    }

    const groups = new Map<string, Spot[]>();

    for (const spot of sortedSpots) {
      const key = viewMode === "type"
        ? spot.spot_type || "other"
        : spot.neighborhood || "Other";

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(spot);
    }

    // Sort groups by count (descending)
    return Array.from(groups.entries())
      .sort((a, b) => b[1].length - a[1].length);
  }, [sortedSpots, viewMode]);

  const hasFilters = selectedTypes.length > 0 || selectedHoods.length > 0 || searchQuery;

  return (
    <>
      {/* Header */}
      <section className="py-6 border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-2xl font-bold text-[var(--cream)] mb-2">Spots</h1>
          <p className="text-[var(--muted)] text-sm">
            Venues, bars, restaurants, and places around Atlanta
          </p>
        </div>
      </section>

      {/* Search Bar */}
      <section className="py-3 border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4">
          <SpotSearchBar />
        </div>
      </section>

      {/* Filter Bar */}
      <SpotFilterBar
        viewMode={viewMode}
        sortBy={sortBy}
        onViewModeChange={handleViewModeChange}
        onSortChange={handleSortChange}
      />

      {/* Results Count */}
      <div className="max-w-3xl mx-auto px-4 border-b border-[var(--twilight)]">
        <p className="font-mono text-xs text-[var(--muted)] py-3">
          <span className="text-[var(--soft)]">{spots.length}</span> spots
          {searchQuery && ` matching "${searchQuery}"`}
          {sortBy === "closest" && userLocation && " · sorted by distance"}
        </p>
      </div>

      {/* Spots List */}
      <main className="max-w-3xl mx-auto px-4 pb-12">
        {spots.length > 0 ? (
          viewMode === "list" ? (
            // Flat list
            <div>
              {sortedSpots.map((spot, index) => (
                <SpotCard
                  key={spot.id}
                  spot={spot}
                  index={index}
                  showDistance={sortBy === "closest" && userLocation ? {
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                  } : undefined}
                />
              ))}
            </div>
          ) : (
            // Grouped view
            <div className="space-y-6 pt-4">
              {groupedSpots?.map(([groupKey, groupSpots]) => (
                <div key={groupKey}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-3 sticky top-[160px] bg-[var(--void)] py-2 z-10">
                    {viewMode === "type" && (
                      <span className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                        <CategoryIcon type={groupKey} size={18} className="opacity-80" />
                      </span>
                    )}
                    <h2 className="font-mono text-sm font-medium text-[var(--cream)] leading-5">
                      {viewMode === "type" ? getCategoryLabel(groupKey) : groupKey}
                    </h2>
                    <span className="font-mono text-xs text-[var(--muted)]">
                      ({groupSpots.length})
                    </span>
                  </div>

                  {/* Group spots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {groupSpots.map((spot) => (
                      <Link
                        key={spot.id}
                        href={`/spots/${spot.slug}`}
                        className="p-3 rounded-lg border border-[var(--twilight)] transition-colors group"
                        style={{ backgroundColor: "var(--card-bg)" }}
                      >
                        <div className="flex items-start gap-2.5">
                          {viewMode !== "type" && spot.spot_type && (
                            <span className="flex items-center justify-center w-4 h-4 flex-shrink-0 mt-0.5">
                              <CategoryIcon type={spot.spot_type} size={16} className="opacity-70" />
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
                              {spot.name}
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-[0.6rem] text-[var(--muted)] mt-0.5">
                              {viewMode !== "neighborhood" && spot.neighborhood && (
                                <span>{spot.neighborhood}</span>
                              )}
                              {viewMode === "neighborhood" && spot.spot_type && (
                                <span>{getCategoryLabel(spot.spot_type)}</span>
                              )}
                              {(spot.event_count ?? 0) > 0 && (
                                <>
                                  <span className="opacity-40">·</span>
                                  <span className="text-[var(--coral)]">
                                    {spot.event_count} event{spot.event_count !== 1 ? "s" : ""}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="py-16 text-center">
            <p className="text-[var(--muted)]">No spots found</p>
            {hasFilters && (
              <Link
                href="/spots"
                className="inline-block mt-4 font-mono text-sm text-[var(--coral)] hover:text-[var(--rose)]"
              >
                Clear filters
              </Link>
            )}
          </div>
        )}
      </main>
    </>
  );
}
