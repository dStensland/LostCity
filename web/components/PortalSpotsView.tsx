"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import CategoryIcon, { getCategoryLabel, getCategoryColor } from "./CategoryIcon";

// Get reflection color class based on spot type
function getReflectionClass(spotType: string | null): string {
  if (!spotType) return "";
  const reflectionMap: Record<string, string> = {
    music_venue: "reflect-music",
    comedy_club: "reflect-comedy",
    art_gallery: "reflect-art",
    theater: "reflect-theater",
    movie_theater: "reflect-film",
    community_space: "reflect-community",
    restaurant: "reflect-food",
    bar: "reflect-nightlife",
    sports_venue: "reflect-sports",
    fitness_studio: "reflect-fitness",
    nightclub: "reflect-nightlife",
    family_venue: "reflect-family",
  };
  return reflectionMap[spotType] || "";
}

type Spot = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  spot_type: string | null;
  event_count?: number;
  lat?: number | null;
  lng?: number | null;
};

type SortOption = "alphabetical" | "event_count" | "neighborhood";
type GroupOption = "none" | "category" | "neighborhood";

interface Props {
  portalId: string;
  portalSlug: string;
  isExclusive?: boolean;
}

export default function PortalSpotsView({ portalId, portalSlug, isExclusive = false }: Props) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("event_count");
  const [groupBy, setGroupBy] = useState<GroupOption>("none");

  useEffect(() => {
    async function fetchSpots() {
      try {
        const params = new URLSearchParams();
        if (portalId) params.set("portal_id", portalId);
        if (isExclusive) params.set("exclusive", "true");

        const res = await fetch(`/api/spots?${params}`);
        const data = await res.json();

        setSpots(data.spots || []);
      } catch (error) {
        console.error("Failed to fetch spots:", error);
        setSpots([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSpots();
  }, [portalId, isExclusive]);

  // Sort and group spots - must be called before any conditional returns (Rules of Hooks)
  const sortedAndGroupedSpots = useMemo(() => {
    if (spots.length === 0) return [];

    // Sort spots
    const sorted = [...spots].sort((a, b) => {
      switch (sortBy) {
        case "alphabetical":
          return a.name.localeCompare(b.name);
        case "event_count":
          return (b.event_count ?? 0) - (a.event_count ?? 0);
        case "neighborhood":
          return (a.neighborhood || "ZZZ").localeCompare(b.neighborhood || "ZZZ");
        default:
          return 0;
      }
    });

    // Group if needed
    if (groupBy === "none") {
      return [{ key: "all", label: null, spots: sorted }];
    }

    const groups = new Map<string, Spot[]>();
    for (const spot of sorted) {
      const key = groupBy === "category"
        ? (spot.spot_type || "other")
        : (spot.neighborhood || "Other");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(spot);
    }

    // Sort groups by name
    const sortedGroups = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, spots]) => ({
        key,
        label: groupBy === "category" ? getCategoryLabel(key) : key,
        spots,
      }));

    return sortedGroups;
  }, [spots, sortBy, groupBy]);

  // Loading state - after hooks to follow Rules of Hooks
  if (loading) {
    return (
      <div className="py-4">
        <div className="mb-4">
          <div className="h-3 w-40 rounded skeleton-shimmer" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-lg border border-[var(--twilight)]"
              style={{ backgroundColor: "var(--card-bg)" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-[18px] h-[18px] rounded skeleton-shimmer" />
                <div className="flex-1 min-w-0">
                  <div className="h-4 w-2/3 rounded skeleton-shimmer mb-2" style={{ animationDelay: `${i * 0.05}s` }} />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-20 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.05 + 0.1}s` }} />
                    <div className="h-3 w-24 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.05 + 0.15}s` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (spots.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-[var(--cream)] text-lg font-medium mb-1">No locations found</p>
        <p className="text-[var(--muted)] text-sm mb-4">
          We haven&apos;t discovered any venues for this portal yet
        </p>
        <Link
          href={`/${portalSlug}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors font-mono text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          View all events
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* Header with count and controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="font-mono text-xs text-[var(--muted)]">
          <span className="text-[var(--soft)]">{spots.length}</span> locations with upcoming events
        </p>

        {/* Sort and Group controls */}
        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-2.5 py-1.5 rounded-lg bg-[var(--twilight)]/50 border border-[var(--twilight)] text-[var(--soft)] font-mono text-xs focus:outline-none focus:border-[var(--coral)]/50 cursor-pointer"
          >
            <option value="event_count">Most Events</option>
            <option value="alphabetical">A-Z</option>
            <option value="neighborhood">Neighborhood</option>
          </select>

          {/* Group dropdown */}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupOption)}
            className="px-2.5 py-1.5 rounded-lg bg-[var(--twilight)]/50 border border-[var(--twilight)] text-[var(--soft)] font-mono text-xs focus:outline-none focus:border-[var(--coral)]/50 cursor-pointer"
          >
            <option value="none">No Grouping</option>
            <option value="category">By Category</option>
            <option value="neighborhood">By Neighborhood</option>
          </select>
        </div>
      </div>

      {/* Spots list with optional grouping */}
      <div className="space-y-6">
        {sortedAndGroupedSpots.map((group) => (
          <div key={group.key}>
            {/* Group header */}
            {group.label && (
              <div className="flex items-center gap-2 mb-3 pt-2">
                {groupBy === "category" && (
                  <CategoryIcon type={group.key} size={14} className="opacity-60" />
                )}
                <h3 className="font-mono text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
                  {group.label}
                </h3>
                <span className="font-mono text-[0.6rem] text-[var(--muted)]/60 bg-[var(--twilight)]/30 px-1.5 py-0.5 rounded">
                  {group.spots.length}
                </span>
                <div className="flex-1 h-px bg-[var(--twilight)]/30" />
              </div>
            )}

            {/* Spots in this group */}
            <div className="space-y-2">
              {group.spots.map((spot) => {
                const categoryColor = spot.spot_type ? getCategoryColor(spot.spot_type) : "var(--coral)";
                const reflectionClass = getReflectionClass(spot.spot_type);
                return (
                  <Link
                    key={spot.id}
                    href={`/${portalSlug}/spots/${spot.slug}`}
                    className={`block p-4 rounded-lg border border-[var(--twilight)] card-atmospheric ${reflectionClass} group`}
                    style={{
                      backgroundColor: "var(--card-bg)",
                      "--glow-color": categoryColor,
                      "--reflection-color": `color-mix(in srgb, ${categoryColor} 15%, transparent)`,
                    } as React.CSSProperties}
                  >
                    <div className="flex items-start gap-3">
                      {spot.spot_type && (
                        <CategoryIcon
                          type={spot.spot_type}
                          size={18}
                          className="flex-shrink-0 opacity-60 mt-0.5"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--cream)] group-hover:text-[var(--glow-color,var(--coral))] transition-colors">
                          {spot.name}
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs text-[var(--muted)] mt-1">
                          {spot.spot_type && (
                            <span>{getCategoryLabel(spot.spot_type)}</span>
                          )}
                          {spot.neighborhood && (
                            <>
                              <span className="opacity-40">·</span>
                              <span>{spot.neighborhood}</span>
                            </>
                          )}
                          {(spot.event_count ?? 0) > 0 && (
                            <>
                              <span className="opacity-40">·</span>
                              <span className="text-[var(--coral)]">
                                {spot.event_count} upcoming event{spot.event_count !== 1 ? "s" : ""}
                              </span>
                            </>
                          )}
                        </div>
                        {spot.address && (
                          <div className="font-mono text-[0.65rem] text-[var(--muted)] mt-1 opacity-60">
                            {spot.address}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
