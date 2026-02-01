"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import CategoryIcon, { getCategoryLabel, getCategoryColor } from "./CategoryIcon";
import CategorySkeleton from "./CategorySkeleton";
import LazyImage from "./LazyImage";
import { OpenStatusBadge } from "./HoursSection";
import { formatCloseTime, type HoursData } from "@/lib/hours";
import { formatPriceLevel } from "@/lib/spots";
import { ITP_NEIGHBORHOODS } from "@/config/neighborhoods";

// ITP neighborhood names for quick filter
const ITP_NEIGHBORHOOD_NAMES = ITP_NEIGHBORHOODS.map(n => n.name);

type Spot = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  venue_type: string | null;
  image_url?: string | null;
  event_count?: number;
  price_level?: number | null;
  hours?: HoursData | null;
  hours_display?: string | null;
  is_24_hours?: boolean | null;
  vibes?: string[] | null;
  short_description?: string | null;
  is_open?: boolean;
  closes_at?: string;
};

type SortOption = "category" | "alphabetical" | "neighborhood";

type FilterState = {
  openNow: boolean;
  priceLevel: number[];
  venueTypes: string[];
  neighborhoods: string[];
  search: string;
  withEvents: boolean;
};

// Spot type configuration with colors and labels
const SPOT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  music_venue: { label: "Music Venues", color: "#F472B6" },
  theater: { label: "Theaters", color: "#F87171" },
  cinema: { label: "Cinemas", color: "#A5B4FC" },
  comedy_club: { label: "Comedy Clubs", color: "#FBBF24" },
  gallery: { label: "Galleries", color: "#C4B5FD" },
  museum: { label: "Museums", color: "#A78BFA" },
  studio: { label: "Studios", color: "#A3E635" },
  restaurant: { label: "Restaurants", color: "#FB923C" },
  bar: { label: "Bars", color: "#C084FC" },
  sports_bar: { label: "Sports Bars", color: "#38BDF8" },
  brewery: { label: "Breweries", color: "#FBBF24" },
  distillery: { label: "Distilleries", color: "#D97706" },
  coffee_shop: { label: "Coffee Shops", color: "#D4A574" },
  food_hall: { label: "Food Halls", color: "#FB923C" },
  farmers_market: { label: "Markets", color: "#FCA5A5" },
  club: { label: "Clubs", color: "#E879F9" },
  nightclub: { label: "Nightclubs", color: "#E879F9" },
  bookstore: { label: "Bookstores", color: "#93C5FD" },
  library: { label: "Libraries", color: "#60A5FA" },
  university: { label: "Universities", color: "#60A5FA" },
  college: { label: "Colleges", color: "#60A5FA" },
  cooking_school: { label: "Cooking Schools", color: "#F97316" },
  coworking: { label: "Coworking", color: "#60A5FA" },
  organization: { label: "Organizations", color: "#6EE7B7" },
  community_center: { label: "Community Centers", color: "#6EE7B7" },
  church: { label: "Churches", color: "#DDD6FE" },
  arena: { label: "Arenas", color: "#7DD3FC" },
  sports_venue: { label: "Sports Venues", color: "#4ADE80" },
  fitness_center: { label: "Fitness Centers", color: "#5EEAD4" },
  park: { label: "Parks", color: "#86EFAC" },
  garden: { label: "Gardens", color: "#4ADE80" },
  outdoor: { label: "Outdoor Spaces", color: "#BEF264" },
  event_space: { label: "Event Spaces", color: "#A78BFA" },
  convention_center: { label: "Convention Centers", color: "#38BDF8" },
  games: { label: "Game Venues", color: "#86EFAC" },
  eatertainment: { label: "Eatertainment", color: "#22D3EE" },
  attraction: { label: "Attractions", color: "#FBBF24" },
  hotel: { label: "Hotels", color: "#FBBF24" },
  venue: { label: "Venues", color: "#94A3B8" },
  other: { label: "Other", color: "#64748B" },
};

const SPOT_TYPE_ORDER = [
  "music_venue", "theater", "cinema", "comedy_club", "gallery", "museum", "studio",
  "restaurant", "bar", "sports_bar", "brewery", "distillery", "coffee_shop", "food_hall", "farmers_market",
  "club", "nightclub",
  "bookstore", "library", "university", "college", "cooking_school", "coworking",
  "organization", "community_center", "church",
  "arena", "sports_venue", "fitness_center",
  "park", "garden", "outdoor",
  "event_space", "convention_center", "games", "eatertainment", "attraction",
  "hotel", "venue", "other",
];

// Quick filter venue type groups
const QUICK_VENUE_TYPES = [
  { key: "nightlife", label: "Nightlife", types: ["bar", "club", "nightclub", "brewery", "distillery"], color: "#C084FC" },
  { key: "food", label: "Food", types: ["restaurant", "food_hall", "farmers_market"], color: "#FB923C" },
  { key: "music", label: "Music", types: ["music_venue"], color: "#F472B6" },
  { key: "arts", label: "Arts", types: ["theater", "gallery", "museum", "comedy_club"], color: "#A78BFA" },
  { key: "coffee", label: "Coffee", types: ["coffee_shop"], color: "#D4A574" },
  { key: "games", label: "Games", types: ["games", "eatertainment", "arcade"], color: "#86EFAC" },
];

interface Props {
  portalId: string;
  portalSlug: string;
  isExclusive?: boolean;
}

const FEATURED_EVENT_THRESHOLD = 5;

// Spot card component
function SpotCard({ spot, portalSlug }: { spot: Spot; portalSlug: string }) {
  const [imageError, setImageError] = useState(false);
  const categoryColor = spot.venue_type ? getCategoryColor(spot.venue_type) : "var(--coral)";
  const config = SPOT_TYPE_CONFIG[spot.venue_type || "other"] || SPOT_TYPE_CONFIG.other;
  const hasImage = spot.image_url && !imageError;
  const isFeatured = (spot.event_count ?? 0) >= FEATURED_EVENT_THRESHOLD;

  return (
    <Link
      href={`/${portalSlug}?spot=${spot.slug}`}
      scroll={false}
      className="block p-3 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] hover:border-[var(--coral)]/50 hover:bg-[var(--card-bg-hover)] transition-all group"
      style={{ "--glow-color": categoryColor } as React.CSSProperties}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <div
          className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-[var(--twilight)] flex items-center justify-center"
          style={{
            background: hasImage ? undefined : `linear-gradient(135deg, ${categoryColor}20, ${categoryColor}08)`,
          }}
        >
          {hasImage ? (
            <LazyImage
              src={spot.image_url!}
              alt=""
              fill
              sizes="56px"
              className="w-full h-full object-cover"
              placeholderColor={`${categoryColor}15`}
              onError={() => setImageError(true)}
            />
          ) : (
            <CategoryIcon type={spot.venue_type || "venue"} size={24} glow="subtle" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[var(--cream)] group-hover:text-[var(--glow-color)] transition-colors truncate">
              {spot.name}
            </span>
            {spot.is_open !== undefined && (
              <OpenStatusBadge hours={spot.hours || null} is24Hours={spot.is_24_hours || false} />
            )}
            {isFeatured && (
              <span
                className="flex-shrink-0 px-1.5 py-0.5 rounded font-mono text-[0.5rem] font-medium uppercase"
                style={{ backgroundColor: `${categoryColor}25`, color: categoryColor, border: `1px solid ${categoryColor}40` }}
              >
                Hot
              </span>
            )}
          </div>

          {spot.short_description && (
            <p className="text-xs text-[var(--soft)] mt-0.5 line-clamp-1">{spot.short_description}</p>
          )}

          <div className="flex items-center gap-2 font-mono text-[0.65rem] text-[var(--muted)] mt-1 flex-wrap">
            {spot.venue_type && <span style={{ color: config.color }}>{getCategoryLabel(spot.venue_type)}</span>}
            {spot.neighborhood && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate">{spot.neighborhood}</span>
              </>
            )}
            {spot.price_level && (
              <>
                <span className="opacity-40">·</span>
                <span className="text-[var(--gold)]">{formatPriceLevel(spot.price_level)}</span>
              </>
            )}
            {spot.is_open && spot.closes_at && (
              <>
                <span className="opacity-40">·</span>
                <span className="text-[var(--neon-green)]">til {formatCloseTime(spot.closes_at)}</span>
              </>
            )}
            {(spot.event_count ?? 0) > 0 && (
              <>
                <span className="opacity-40">·</span>
                <span className="text-[var(--coral)]">{spot.event_count} event{spot.event_count !== 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        </div>

        <svg
          className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0 mt-1"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

// Filter Control Deck
function FilterDeck({
  filters,
  setFilters,
  openCount,
  neighborhoods,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  openCount: number;
  neighborhoods: string[];
}) {
  const [showMore, setShowMore] = useState(false);

  const hasActiveFilters = filters.openNow || filters.priceLevel.length > 0 ||
    filters.venueTypes.length > 0 || filters.neighborhoods.length > 0 ||
    filters.search || filters.withEvents;

  const clearFilters = () => {
    setFilters({
      openNow: false,
      priceLevel: [],
      venueTypes: [],
      neighborhoods: [],
      search: "",
      withEvents: false,
    });
  };

  const toggleVenueTypeGroup = (types: string[]) => {
    const allSelected = types.every(t => filters.venueTypes.includes(t));
    if (allSelected) {
      setFilters(f => ({ ...f, venueTypes: f.venueTypes.filter(t => !types.includes(t)) }));
    } else {
      setFilters(f => ({ ...f, venueTypes: [...new Set([...f.venueTypes, ...types])] }));
    }
  };

  const togglePriceLevel = (level: number) => {
    setFilters(f => ({
      ...f,
      priceLevel: f.priceLevel.includes(level)
        ? f.priceLevel.filter(l => l !== level)
        : [...f.priceLevel, level],
    }));
  };

  const toggleNeighborhood = (hood: string) => {
    setFilters(f => ({
      ...f,
      neighborhoods: f.neighborhoods.includes(hood)
        ? f.neighborhoods.filter(n => n !== hood)
        : [...f.neighborhoods, hood],
    }));
  };

  return (
    <div className="mb-6 space-y-3">
      {/* Primary Filter Row - Open Now + Search + Price */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Open Now Toggle - Prominent "Power Switch" Style */}
        <button
          onClick={() => setFilters(f => ({ ...f, openNow: !f.openNow }))}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm font-medium transition-all active:scale-[0.98] ${
            filters.openNow
              ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-2 border-[var(--neon-green)]/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
              : "bg-[var(--dusk)] text-[var(--muted)] border-2 border-[var(--twilight)] hover:border-[var(--neon-green)]/30 hover:text-[var(--soft)]"
          }`}
        >
          <span className={`w-2.5 h-2.5 rounded-full transition-all ${
            filters.openNow ? "bg-[var(--neon-green)] shadow-[0_0_8px_var(--neon-green)] animate-pulse" : "bg-[var(--twilight)]"
          }`} />
          <span>Open Now</span>
          {openCount > 0 && (
            <span className={`text-xs ${filters.openNow ? "text-[var(--neon-green)]/70" : "text-[var(--muted)]"}`}>
              ({openCount})
            </span>
          )}
        </button>

        {/* ITP Toggle */}
        <button
          onClick={() => {
            // Toggle ITP: if any ITP neighborhoods are selected, clear them; otherwise select all ITP
            const hasITP = ITP_NEIGHBORHOOD_NAMES.some(n => filters.neighborhoods.includes(n));
            if (hasITP) {
              setFilters(f => ({ ...f, neighborhoods: f.neighborhoods.filter(n => !ITP_NEIGHBORHOOD_NAMES.includes(n)) }));
            } else {
              setFilters(f => ({ ...f, neighborhoods: [...new Set([...f.neighborhoods, ...ITP_NEIGHBORHOOD_NAMES])] }));
            }
          }}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm font-medium transition-all active:scale-[0.98] ${
            ITP_NEIGHBORHOOD_NAMES.some(n => filters.neighborhoods.includes(n))
              ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border-2 border-[var(--neon-cyan)]/50 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
              : "bg-[var(--dusk)] text-[var(--muted)] border-2 border-[var(--twilight)] hover:border-[var(--neon-cyan)]/30 hover:text-[var(--soft)]"
          }`}
          title="Inside the Perimeter"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth={2} />
            <circle cx="12" cy="12" r="3" strokeWidth={2} />
          </svg>
          <span>ITP</span>
        </button>

        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <input
            type="text"
            placeholder="Search destinations..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="w-full px-4 py-2 pl-10 bg-[var(--dusk)] border-2 border-[var(--twilight)] rounded-xl font-mono text-sm text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)]/50 focus:shadow-[0_0_15px_rgba(255,107,107,0.15)] transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {filters.search && (
            <button
              onClick={() => setFilters(f => ({ ...f, search: "" }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--cream)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Price Level Selector */}
        <div className="flex items-center gap-1 bg-[var(--dusk)] border-2 border-[var(--twilight)] rounded-xl p-1">
          {[1, 2, 3, 4].map((level) => (
            <button
              key={level}
              onClick={() => togglePriceLevel(level)}
              className={`px-2.5 py-1 rounded font-mono text-sm transition-all ${
                filters.priceLevel.includes(level)
                  ? "bg-[var(--gold)]/20 text-[var(--gold)] shadow-[0_0_10px_rgba(251,191,36,0.2)]"
                  : "text-[var(--muted)] hover:text-[var(--gold)]"
              }`}
              title={`Price level ${level}`}
            >
              {"$".repeat(level)}
            </button>
          ))}
        </div>

        {/* Has Events Toggle */}
        <button
          onClick={() => setFilters(f => ({ ...f, withEvents: !f.withEvents }))}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-mono text-xs font-medium transition-all active:scale-[0.98] ${
            filters.withEvents
              ? "bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/50"
              : "bg-[var(--dusk)] text-[var(--muted)] border border-[var(--twilight)] hover:border-[var(--coral)]/30"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Events
        </button>

        {/* More Filters Toggle */}
        <button
          onClick={() => setShowMore(!showMore)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-mono text-xs font-medium transition-all active:scale-[0.98] ${
            showMore || filters.venueTypes.length > 0 || filters.neighborhoods.length > 0
              ? "bg-[var(--rose)]/20 text-[var(--rose)] border border-[var(--rose)]/50"
              : "bg-[var(--dusk)] text-[var(--muted)] border border-[var(--twilight)] hover:text-[var(--cream)]"
          }`}
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${showMore ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          More
          {(filters.venueTypes.length > 0 || filters.neighborhoods.length > 0) && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--rose)]/30 text-[0.6rem]">
              {filters.venueTypes.length + filters.neighborhoods.length}
            </span>
          )}
        </button>
      </div>

      {/* Quick Category Chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {QUICK_VENUE_TYPES.map(({ key, label, types, color }) => {
          const isActive = types.every(t => filters.venueTypes.includes(t));
          const isPartial = types.some(t => filters.venueTypes.includes(t)) && !isActive;

          return (
            <button
              key={key}
              onClick={() => toggleVenueTypeGroup(types)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "text-[var(--void)] shadow-[0_0_12px_rgba(255,255,255,0.1)]"
                  : isPartial
                  ? "bg-[var(--dusk)] border-2 border-dashed text-[var(--soft)]"
                  : "bg-[var(--dusk)] text-[var(--muted)] border border-[var(--twilight)] hover:text-[var(--cream)] hover:border-[var(--soft)]"
              }`}
              style={{
                backgroundColor: isActive ? `${color}` : undefined,
                borderColor: isPartial ? color : undefined,
              }}
            >
              <CategoryIcon type={types[0]} size={14} style={{ color: isActive ? "var(--void)" : color }} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Expanded Filters */}
      {showMore && (
        <div className="pt-3 border-t border-[var(--twilight)] space-y-4">
          {/* Neighborhoods */}
          <div>
            <div className="font-mono text-[0.65rem] text-[var(--muted)] uppercase tracking-wider mb-2">
              Neighborhoods
            </div>
            <div className="flex flex-wrap gap-1.5">
              {neighborhoods.map((hood) => (
                <button
                  key={hood}
                  onClick={() => toggleNeighborhood(hood)}
                  className={`px-2.5 py-1 rounded font-mono text-[0.7rem] transition-all ${
                    filters.neighborhoods.includes(hood)
                      ? "bg-[var(--coral)] text-[var(--void)]"
                      : "bg-[var(--dusk)] text-[var(--muted)] border border-[var(--twilight)] hover:text-[var(--cream)] hover:border-[var(--soft)]"
                  }`}
                >
                  {hood}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--twilight)]/50">
          <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider">
            Active:
          </span>
          {filters.openNow && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-mono text-[0.65rem]">
              Open Now
              <button onClick={() => setFilters(f => ({ ...f, openNow: false }))} className="hover:text-white">×</button>
            </span>
          )}
          {filters.withEvents && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--coral)]/20 text-[var(--coral)] font-mono text-[0.65rem]">
              Has Events
              <button onClick={() => setFilters(f => ({ ...f, withEvents: false }))} className="hover:text-white">×</button>
            </span>
          )}
          {filters.priceLevel.map(level => (
            <span key={level} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--gold)]/20 text-[var(--gold)] font-mono text-[0.65rem]">
              {"$".repeat(level)}
              <button onClick={() => togglePriceLevel(level)} className="hover:text-white">×</button>
            </span>
          ))}
          {filters.venueTypes.slice(0, 3).map(type => (
            <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem]">
              {getCategoryLabel(type)}
              <button onClick={() => setFilters(f => ({ ...f, venueTypes: f.venueTypes.filter(t => t !== type) }))} className="hover:text-[var(--coral)]">×</button>
            </span>
          ))}
          {filters.venueTypes.length > 3 && (
            <span className="text-[var(--muted)] font-mono text-[0.65rem]">+{filters.venueTypes.length - 3} more</span>
          )}
          {filters.neighborhoods.map(hood => (
            <span key={hood} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem]">
              {hood}
              <button onClick={() => toggleNeighborhood(hood)} className="hover:text-[var(--coral)]">×</button>
            </span>
          ))}
          <button
            onClick={clearFilters}
            className="font-mono text-[0.6rem] text-[var(--coral)] hover:text-[var(--rose)] transition-colors ml-auto active:scale-95"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export default function PortalSpotsView({ portalId, portalSlug, isExclusive = false }: Props) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("category");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["music_venue", "bar", "restaurant"]));
  const [meta, setMeta] = useState<{ openCount: number; neighborhoods: string[] }>({ openCount: 0, neighborhoods: [] });

  const [filters, setFilters] = useState<FilterState>({
    openNow: false,
    priceLevel: [],
    venueTypes: [],
    neighborhoods: [],
    search: "",
    withEvents: false,
  });

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

  // Build query params from filters
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (portalId) params.set("portal_id", portalId);
    if (isExclusive) params.set("exclusive", "true");
    if (filters.openNow) params.set("open_now", "true");
    if (filters.withEvents) params.set("with_events", "true");
    if (filters.priceLevel.length > 0) params.set("price_level", filters.priceLevel.join(","));
    if (filters.venueTypes.length > 0) params.set("venue_type", filters.venueTypes.join(","));
    if (filters.neighborhoods.length > 0) params.set("neighborhood", filters.neighborhoods.join(","));
    if (filters.search) params.set("q", filters.search);
    return params;
  }, [portalId, isExclusive, filters]);

  useEffect(() => {
    async function fetchSpots() {
      setLoading(true);
      try {
        const params = buildQueryParams();
        const res = await fetch(`/api/spots?${params}`);
        const data = await res.json();
        setSpots(data.spots || []);
        if (data.meta) {
          setMeta(data.meta);
        }
      } catch (error) {
        console.error("Failed to fetch spots:", error);
        setSpots([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSpots();
  }, [buildQueryParams]);

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
      sorted.sort((a, b) => {
        const aType = a.venue_type || "other";
        const bType = b.venue_type || "other";
        const aOrder = SPOT_TYPE_ORDER.indexOf(aType);
        const bOrder = SPOT_TYPE_ORDER.indexOf(bType);
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
  }, [spots, sortBy]);

  // Group spots by category or neighborhood
  const groupedSpots = useMemo(() => {
    if (sortBy === "alphabetical") return null;

    const groups: Record<string, Spot[]> = {};
    for (const spot of sortedSpots) {
      const key = sortBy === "category" ? (spot.venue_type || "other") : (spot.neighborhood || "Other");
      if (!groups[key]) groups[key] = [];
      groups[key].push(spot);
    }

    if (sortBy === "category") {
      return SPOT_TYPE_ORDER
        .filter(type => groups[type]?.length > 0)
        .map(type => ({
          type,
          spots: groups[type],
          config: SPOT_TYPE_CONFIG[type] || SPOT_TYPE_CONFIG.other
        }));
    } else {
      return Object.keys(groups)
        .sort()
        .map(neighborhood => ({
          type: neighborhood,
          spots: groups[neighborhood],
          config: { label: neighborhood, color: "var(--muted)" }
        }));
    }
  }, [sortedSpots, sortBy]);

  if (loading) {
    return <CategorySkeleton count={10} title="Destinations" subtitle="Loading venues..." />;
  }

  return (
    <div className="py-6">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--cream)]">Destinations</h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              <span className="text-[var(--soft)]">{spots.length}</span> places to explore
              <span className="mx-2 opacity-40">·</span>
              <Link href="/submit/venue" className="text-[var(--coral)] hover:text-[var(--rose)] transition-colors">
                Add a venue
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Expand/Collapse All Toggle */}
            {sortBy !== "alphabetical" && groupedSpots && groupedSpots.length > 0 && (
              <button
                onClick={() => {
                  if (expandedCategories.size === groupedSpots.length) {
                    setExpandedCategories(new Set()); // Collapse all
                  } else {
                    setExpandedCategories(new Set(groupedSpots.map(g => g.type))); // Expand all
                  }
                }}
                className="px-2 py-1 rounded font-mono text-[0.65rem] text-[var(--coral)] hover:text-[var(--rose)] transition-colors bg-[var(--twilight)]/30 hover:bg-[var(--twilight)]/50"
              >
                {expandedCategories.size === groupedSpots.length ? "Collapse all" : "Expand all"}
              </button>
            )}

            <div className="flex items-center gap-1">
              <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mr-2 hidden sm:inline">Sort:</span>
              {(["category", "neighborhood", "alphabetical"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setSortBy(option)}
                  className={`px-2 py-1 rounded font-mono text-[0.65rem] transition-all ${
                    sortBy === option
                      ? "bg-[var(--coral)] text-[var(--void)]"
                      : "bg-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  {option === "category" ? "Category" : option === "neighborhood" ? "Area" : "A-Z"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Deck */}
      <FilterDeck
        filters={filters}
        setFilters={setFilters}
        openCount={meta.openCount}
        neighborhoods={meta.neighborhoods}
      />

      {/* Empty state */}
      {spots.length === 0 && !loading && (
        <div className="py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-[var(--cream)] text-lg font-medium mb-1">No destinations found</p>
          <p className="text-[var(--muted)] text-sm mb-4">Try adjusting your filters</p>
          <button
            onClick={() => setFilters({ openNow: false, priceLevel: [], venueTypes: [], neighborhoods: [], search: "", withEvents: false })}
            className="btn-primary btn-md"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Spots list */}
      {groupedSpots ? (
        <div className="space-y-2">
          {groupedSpots.map(({ type, spots: groupSpots, config }) => {
            const isExpanded = expandedCategories.has(type);
            return (
              <div key={type}>
                <button onClick={() => toggleCategory(type)} className="w-full flex items-center gap-2 py-3 px-1 group/header">
                  {sortBy === "category" && <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: config.color }} />}
                  <h3 className="font-mono text-xs font-medium uppercase tracking-wider flex-1 text-left" style={{ color: sortBy === "category" ? config.color : "var(--muted)" }}>
                    {config.label}
                  </h3>
                  <span className="font-mono text-[0.6rem] text-[var(--muted)] mr-2">{groupSpots.length}</span>
                  <svg className={`w-4 h-4 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="space-y-2 pb-4">
                    {groupSpots.map((spot) => <SpotCard key={spot.id} spot={spot} portalSlug={portalSlug} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedSpots.map((spot) => <SpotCard key={spot.id} spot={spot} portalSlug={portalSlug} />)}
        </div>
      )}
    </div>
  );
}
