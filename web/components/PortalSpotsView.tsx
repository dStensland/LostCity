"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import CategoryIcon, { getCategoryLabel, getCategoryColor } from "./CategoryIcon";
import CategorySkeleton from "./CategorySkeleton";

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

type SortOption = "category" | "alphabetical" | "neighborhood";

// Spot type configuration with colors and labels
const SPOT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  // Performance & Arts
  music_venue: { label: "Music Venues", color: "#F472B6" },
  theater: { label: "Theaters", color: "#F87171" },
  cinema: { label: "Cinemas", color: "#A5B4FC" },
  comedy_club: { label: "Comedy Clubs", color: "#FBBF24" },
  gallery: { label: "Galleries", color: "#C4B5FD" },
  museum: { label: "Museums", color: "#A78BFA" },
  studio: { label: "Studios", color: "#A3E635" },

  // Food & Drink
  restaurant: { label: "Restaurants", color: "#FB923C" },
  bar: { label: "Bars", color: "#C084FC" },
  sports_bar: { label: "Sports Bars", color: "#38BDF8" },
  brewery: { label: "Breweries", color: "#FBBF24" },
  distillery: { label: "Distilleries", color: "#D97706" },
  coffee_shop: { label: "Coffee Shops", color: "#D4A574" },
  food_hall: { label: "Food Halls", color: "#FB923C" },
  farmers_market: { label: "Markets", color: "#FCA5A5" },

  // Nightlife
  club: { label: "Clubs", color: "#E879F9" },
  nightclub: { label: "Nightclubs", color: "#E879F9" },

  // Books & Learning
  bookstore: { label: "Bookstores", color: "#93C5FD" },
  library: { label: "Libraries", color: "#60A5FA" },
  university: { label: "Universities", color: "#60A5FA" },
  college: { label: "Colleges", color: "#60A5FA" },
  cooking_school: { label: "Cooking Schools", color: "#F97316" },
  coworking: { label: "Coworking", color: "#60A5FA" },

  // Community & Organizations
  organization: { label: "Organizations", color: "#6EE7B7" },
  community_center: { label: "Community Centers", color: "#6EE7B7" },
  community_space: { label: "Community Spaces", color: "#34D399" },
  church: { label: "Churches", color: "#DDD6FE" },

  // Sports & Fitness
  arena: { label: "Arenas", color: "#7DD3FC" },
  sports_venue: { label: "Sports Venues", color: "#4ADE80" },
  fitness_center: { label: "Fitness Centers", color: "#5EEAD4" },
  fitness_studio: { label: "Fitness Studios", color: "#2DD4BF" },

  // Outdoors
  park: { label: "Parks", color: "#86EFAC" },
  garden: { label: "Gardens", color: "#4ADE80" },
  outdoor: { label: "Outdoor Spaces", color: "#BEF264" },

  // Entertainment & Events
  event_space: { label: "Event Spaces", color: "#A78BFA" },
  convention_center: { label: "Convention Centers", color: "#38BDF8" },
  games: { label: "Game Venues", color: "#86EFAC" },
  eatertainment: { label: "Eatertainment", color: "#22D3EE" },
  attraction: { label: "Attractions", color: "#FBBF24" },

  // Hospitality & Services
  hotel: { label: "Hotels", color: "#FBBF24" },
  hospital: { label: "Hospitals", color: "#34D399" },
  healthcare: { label: "Healthcare", color: "#34D399" },

  // Catch-all
  venue: { label: "The Rest", color: "#94A3B8" },
  other: { label: "Other", color: "#64748B" },
};

// Order for category sorting
const SPOT_TYPE_ORDER = [
  // Performance & Arts
  "music_venue",
  "theater",
  "cinema",
  "comedy_club",
  "gallery",
  "museum",
  "studio",
  // Food & Drink
  "restaurant",
  "bar",
  "sports_bar",
  "brewery",
  "distillery",
  "coffee_shop",
  "food_hall",
  "farmers_market",
  // Nightlife
  "club",
  "nightclub",
  // Books & Learning
  "bookstore",
  "library",
  "university",
  "college",
  "cooking_school",
  "coworking",
  // Community & Organizations
  "organization",
  "community_center",
  "community_space",
  "church",
  // Sports & Fitness
  "arena",
  "sports_venue",
  "fitness_center",
  "fitness_studio",
  // Outdoors
  "park",
  "garden",
  "outdoor",
  // Entertainment & Events
  "event_space",
  "convention_center",
  "games",
  "eatertainment",
  "attraction",
  // Hospitality & Services
  "hotel",
  "hospital",
  "healthcare",
  // Catch-all
  "venue",
  "other",
];

interface Props {
  portalId: string;
  portalSlug: string;
  isExclusive?: boolean;
}

// Spot card component
function SpotCard({
  spot,
  portalSlug,
}: {
  spot: Spot;
  portalSlug: string;
}) {
  const categoryColor = spot.spot_type ? getCategoryColor(spot.spot_type) : "var(--coral)";
  const reflectionClass = getReflectionClass(spot.spot_type);
  const config = SPOT_TYPE_CONFIG[spot.spot_type || "other"] || SPOT_TYPE_CONFIG.other;

  return (
    <Link
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
            className="flex-shrink-0 mt-0.5"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[var(--cream)] group-hover:text-[var(--glow-color)] transition-colors">
            {spot.name}
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--muted)] mt-1">
            {spot.spot_type && (
              <span style={{ color: config.color }}>{getCategoryLabel(spot.spot_type)}</span>
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
                  {spot.event_count} event{spot.event_count !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function PortalSpotsView({ portalId, portalSlug, isExclusive = false }: Props) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("category");
  // Track which categories are expanded (collapsed by default)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

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

  // Sort spots
  const sortedSpots = useMemo(() => {
    const sorted = [...spots];
    if (sortBy === "alphabetical") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "neighborhood") {
      sorted.sort((a, b) => {
        const aNeighborhood = a.neighborhood || "ZZZ";
        const bNeighborhood = b.neighborhood || "ZZZ";
        if (aNeighborhood !== bNeighborhood) return aNeighborhood.localeCompare(bNeighborhood);
        return a.name.localeCompare(b.name);
      });
    } else {
      // Sort by category (spot_type), then by event count within category
      sorted.sort((a, b) => {
        const aType = a.spot_type || "other";
        const bType = b.spot_type || "other";
        const aOrder = SPOT_TYPE_ORDER.indexOf(aType);
        const bOrder = SPOT_TYPE_ORDER.indexOf(bType);
        const aIdx = aOrder === -1 ? 999 : aOrder;
        const bIdx = bOrder === -1 ? 999 : bOrder;
        if (aIdx !== bIdx) return aIdx - bIdx;
        // Within same category, sort by event count then name
        if ((b.event_count ?? 0) !== (a.event_count ?? 0)) {
          return (b.event_count ?? 0) - (a.event_count ?? 0);
        }
        return a.name.localeCompare(b.name);
      });
    }
    return sorted;
  }, [spots, sortBy]);

  // Group spots by category or neighborhood for collapsible view
  const groupedSpots = useMemo(() => {
    if (sortBy === "alphabetical") return null;

    const groups: Record<string, Spot[]> = {};
    for (const spot of sortedSpots) {
      const key = sortBy === "category"
        ? (spot.spot_type || "other")
        : (spot.neighborhood || "Other");
      if (!groups[key]) groups[key] = [];
      groups[key].push(spot);
    }

    if (sortBy === "category") {
      // Return in predefined order
      return SPOT_TYPE_ORDER
        .filter(type => groups[type]?.length > 0)
        .map(type => ({
          type,
          spots: groups[type],
          config: SPOT_TYPE_CONFIG[type] || SPOT_TYPE_CONFIG.other
        }));
    } else {
      // Neighborhood - sort alphabetically
      return Object.keys(groups)
        .sort()
        .map(neighborhood => ({
          type: neighborhood,
          spots: groups[neighborhood],
          config: { label: neighborhood, color: "var(--muted)" }
        }));
    }
  }, [sortedSpots, sortBy]);

  // Loading state - after hooks to follow Rules of Hooks
  if (loading) {
    return (
      <CategorySkeleton
        count={10}
        title="Places"
        subtitle="Loading venues..."
      />
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
    <div className="py-6">
      {/* Header with count and controls */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--cream)]">Places</h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              <span className="text-[var(--soft)]">{spots.length}</span> venues in the city
            </p>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mr-2 hidden sm:inline">
              Sort:
            </span>
            <button
              onClick={() => setSortBy("category")}
              className={`px-2 py-1 rounded font-mono text-[0.65rem] transition-all ${
                sortBy === "category"
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              Category
            </button>
            <button
              onClick={() => setSortBy("neighborhood")}
              className={`px-2 py-1 rounded font-mono text-[0.65rem] transition-all ${
                sortBy === "neighborhood"
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              Area
            </button>
            <button
              onClick={() => setSortBy("alphabetical")}
              className={`px-2 py-1 rounded font-mono text-[0.65rem] transition-all ${
                sortBy === "alphabetical"
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              A-Z
            </button>
          </div>
        </div>
      </div>

      {/* Spots list with collapsible grouping */}
      {groupedSpots ? (
        <div className="space-y-2">
          {groupedSpots.map(({ type, spots: groupSpots, config }) => {
            const isExpanded = expandedCategories.has(type);

            return (
              <div key={type}>
                {/* Collapsible Header */}
                <button
                  onClick={() => toggleCategory(type)}
                  className="w-full flex items-center gap-2 py-3 px-1 group/header"
                >
                  {sortBy === "category" && (
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                  )}
                  <h3
                    className="font-mono text-xs font-medium uppercase tracking-wider flex-1 text-left"
                    style={{ color: sortBy === "category" ? config.color : "var(--muted)" }}
                  >
                    {config.label}
                  </h3>
                  <span className="font-mono text-[0.6rem] text-[var(--muted)] mr-2">
                    {groupSpots.length}
                  </span>
                  <svg
                    className={`w-4 h-4 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="space-y-2 pb-4">
                    {groupSpots.map((spot) => (
                      <SpotCard
                        key={spot.id}
                        spot={spot}
                        portalSlug={portalSlug}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedSpots.map((spot) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
