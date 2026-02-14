"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import CategoryIcon, { getCategoryColor, getCategoryLabel } from "./CategoryIcon";
import CategorySkeleton from "./CategorySkeleton";
import LazyImage from "./LazyImage";
import { OpenStatusBadge } from "./HoursSection";
import { formatCloseTime, type HoursData } from "@/lib/hours";
import { formatPriceLevel } from "@/lib/spots-constants";
import { ITP_NEIGHBORHOODS } from "@/config/neighborhoods";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

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
  const hasImage = spot.image_url && !imageError;
  const isFeatured = (spot.event_count ?? 0) >= FEATURED_EVENT_THRESHOLD;
  const categoryKey = spot.venue_type || "other";
  const accentColor = getCategoryColor(categoryKey);
  const placeTypeLabel = getCategoryLabel(categoryKey);

  return (
    <Link
      href={`/${portalSlug}?spot=${spot.slug}`}
      scroll={false}
      data-category={categoryKey}
      className="find-row-card block rounded-2xl border border-[var(--twilight)]/75 border-l-[2px] border-l-[var(--accent-color)] overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
      style={
        {
          "--accent-color": accentColor,
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
        } as CSSProperties
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
        <div className="min-w-0 p-3.5 sm:p-4">
          <div className="flex gap-3 sm:gap-4">
            <div
              className={`hidden sm:flex flex-shrink-0 self-stretch relative w-[124px] -ml-3.5 sm:-ml-4 -my-3.5 sm:-my-4 overflow-hidden list-rail-media border-r border-[var(--twilight)]/60 ${
                hasImage ? "" : "bg-[color-mix(in_srgb,var(--night)_84%,transparent)]"
              }`}
            >
              {hasImage ? (
                <>
                  <LazyImage
                    src={spot.image_url!}
                    alt={spot.name}
                    fill
                    sizes="124px"
                    className="w-full h-full object-cover scale-[1.03]"
                    placeholderColor="color-mix(in srgb, var(--accent-color) 15%, transparent)"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/56 to-black/20 pointer-events-none" />
                </>
              ) : null}
              <div className="relative z-10 flex h-full flex-col items-start justify-center gap-1.5 pl-3 pr-2 py-3 sm:py-4">
                <span className="font-mono text-[0.62rem] font-semibold leading-none uppercase tracking-[0.12em] text-[var(--accent-color)]">
                  {placeTypeLabel}
                </span>
                <span className={`font-mono text-[0.66rem] leading-none uppercase tracking-[0.1em] ${hasImage ? "text-white/82" : "text-[var(--soft)]"}`}>
                  {spot.neighborhood || "Atlanta"}
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="sm:hidden flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent-20 border border-[var(--twilight)]/50">
                  <CategoryIcon type={spot.venue_type || "venue"} size={14} glow="subtle" />
                </span>
                <span className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent-color)] truncate">
                  {placeTypeLabel}
                </span>
              </div>

              <div className="flex items-center gap-2.5 mb-1">
                <span className="hidden sm:inline-flex flex-shrink-0 items-center justify-center w-9 h-9 rounded-lg bg-accent-20 border border-[var(--twilight)]/55">
                  <CategoryIcon type={spot.venue_type || "venue"} size={18} glow="subtle" />
                </span>
                <span className="text-[var(--cream)] font-semibold text-[1.05rem] sm:text-[1.2rem] transition-colors line-clamp-1 group-hover:text-[var(--accent-color)] leading-tight">
                  {spot.name}
                </span>
                {spot.is_open !== undefined && (
                  <span className="hidden sm:inline-flex">
                    <OpenStatusBadge hours={spot.hours || null} is24Hours={spot.is_24_hours || false} />
                  </span>
                )}
                {isFeatured && (
                  <span className="inline-flex flex-shrink-0 px-1.5 py-0.5 rounded font-mono text-[0.5rem] font-medium uppercase bg-accent-25 text-accent border border-accent-40">
                    Hot
                  </span>
                )}
              </div>

              {spot.short_description && (
                <p className="text-xs text-[var(--soft)] mt-0.5 line-clamp-1">{spot.short_description}</p>
              )}

              <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed flex-wrap">
                {spot.neighborhood && (
                  <span className="truncate max-w-[65%] sm:max-w-[45%] font-medium text-[var(--text-base)]">{spot.neighborhood}</span>
                )}
                {spot.price_level && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="text-[var(--gold)] font-mono text-[0.72rem]">{formatPriceLevel(spot.price_level)}</span>
                  </>
                )}
                {spot.is_open && spot.closes_at && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="text-[var(--neon-green)] font-mono text-[0.72rem]">til {formatCloseTime(spot.closes_at)}</span>
                  </>
                )}
                {(spot.event_count ?? 0) > 0 && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="text-[var(--coral)] font-mono text-[0.72rem]">
                      {spot.event_count} event{spot.event_count !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 pt-3 pr-3 pb-3 sm:pt-4 sm:pr-4 sm:pb-4 flex-shrink-0">
          {spot.is_open !== undefined && (
            <span className="sm:hidden inline-flex">
              <OpenStatusBadge hours={spot.hours || null} is24Hours={spot.is_24_hours || false} />
            </span>
          )}
          <span className="inline-flex w-9 h-9 items-center justify-center rounded-lg border border-[var(--twilight)]/75 bg-[var(--dusk)]/72 text-[var(--muted)] group-hover:text-[var(--cream)] group-hover:border-[var(--accent-color)]/55 transition-all">
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v8a1 1 0 001 1h8" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

// Reusable dropdown for filter controls
function FilterDropdown<T extends string>({
  label,
  value,
  options,
  onSelect,
  renderOption,
  renderSelected,
}: {
  label: string;
  value: T;
  options: { key: T; label: string; icon?: string }[];
  onSelect: (key: T) => void;
  renderOption?: (opt: { key: T; label: string; icon?: string }, isActive: boolean) => React.ReactNode;
  renderSelected?: (opt: { key: T; label: string; icon?: string }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.key === value) || options[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2 font-mono text-xs cursor-pointer hover:border-[var(--coral)]/50 transition-colors"
      >
        {renderSelected ? renderSelected(selected) : (
          <>
            {selected.icon && (
              <span data-category={selected.icon} className="category-icon">
                <CategoryIcon type={selected.icon} size={14} glow="subtle" />
              </span>
            )}
            <span className="text-[var(--cream)]">{selected.label}</span>
          </>
        )}
        <svg
          className={`w-3 h-3 text-[var(--muted)] transition-transform duration-200 ml-1 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-52 max-h-72 overflow-y-auto bg-[var(--night)] border border-[var(--twilight)] rounded-lg shadow-xl shadow-black/40">
          {options.map((opt) => {
            const isActive = value === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => { onSelect(opt.key); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left font-mono text-xs transition-colors ${
                  isActive
                    ? "bg-[var(--coral)]/15 text-[var(--coral)]"
                    : "text-[var(--soft)] hover:bg-[var(--twilight)]/30 hover:text-[var(--cream)]"
                }`}
              >
                {renderOption ? renderOption(opt, isActive) : (
                  <>
                    {opt.icon && (
                      <span data-category={opt.icon} className="category-icon flex-shrink-0">
                        <CategoryIcon type={opt.icon} size={14} glow={isActive ? "default" : "none"} />
                      </span>
                    )}
                    <span>{opt.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Filter Control Deck — compact dropdowns
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
  // Build neighborhood options: "All", "ITP", then individual neighborhoods
  const neighborhoodOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [
      { key: "all", label: "All Areas" },
      { key: "itp", label: "ITP (Inside Perimeter)" },
      ...neighborhoods.map((n) => ({ key: n, label: n })),
    ];
    return opts;
  }, [neighborhoods]);

  // Derive current neighborhood selection as a single key for the dropdown
  const neighborhoodValue = useMemo(() => {
    if (filters.neighborhoods.length === 0) return "all";
    const hasAllITP = ITP_NEIGHBORHOOD_NAMES.every((n) => filters.neighborhoods.includes(n));
    if (hasAllITP && filters.neighborhoods.length === ITP_NEIGHBORHOOD_NAMES.length) return "itp";
    if (filters.neighborhoods.length === 1) return filters.neighborhoods[0];
    // Multiple specific neighborhoods — show first one
    return filters.neighborhoods[0];
  }, [filters.neighborhoods]);

  const handleNeighborhoodSelect = (key: string) => {
    if (key === "all") {
      setFilters((f) => ({ ...f, neighborhoods: [] }));
    } else if (key === "itp") {
      setFilters((f) => ({ ...f, neighborhoods: [...ITP_NEIGHBORHOOD_NAMES] }));
    } else {
      setFilters((f) => ({ ...f, neighborhoods: [key] }));
    }
  };

  // Price options
  const priceOptions = [
    { key: "all", label: "Any Price" },
    { key: "1", label: "$" },
    { key: "2", label: "$$" },
    { key: "1,2", label: "$ – $$" },
    { key: "3", label: "$$$" },
    { key: "4", label: "$$$$" },
    { key: "3,4", label: "$$$ – $$$$" },
  ];

  const priceValue = filters.priceLevel.length === 0
    ? "all"
    : filters.priceLevel.sort().join(",");

  const handlePriceSelect = (key: string) => {
    if (key === "all") {
      setFilters((f) => ({ ...f, priceLevel: [] }));
    } else {
      setFilters((f) => ({ ...f, priceLevel: key.split(",").map(Number) }));
    }
  };

  // Category options built from QUICK_VENUE_TYPES + "All"
  const categoryOptions = [
    { key: "all", label: "All Types", icon: "other" as string },
    ...QUICK_VENUE_TYPES.map(({ label, types }) => ({
      key: types.join(","),
      label,
      icon: types[0],
    })),
  ];

  const categoryValue = filters.venueTypes.length === 0
    ? "all"
    : filters.venueTypes.sort().join(",");

  const handleCategorySelect = (key: string) => {
    if (key === "all") {
      setFilters((f) => ({ ...f, venueTypes: [] }));
    } else {
      setFilters((f) => ({ ...f, venueTypes: key.split(",") }));
    }
  };

  const hasActiveFilters = filters.openNow || filters.priceLevel.length > 0 ||
    filters.venueTypes.length > 0 || filters.neighborhoods.length > 0 ||
    filters.search || filters.withEvents;

  return (
    <div className="space-y-3">
      {/* Filter Row: Dropdowns + Toggles + Search */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Neighborhood Dropdown */}
        <FilterDropdown
          label="Area"
          value={neighborhoodValue}
          options={neighborhoodOptions}
          onSelect={handleNeighborhoodSelect}
          renderSelected={(opt) => (
            <>
              <svg className="w-3.5 h-3.5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[var(--cream)]">{opt.label}</span>
            </>
          )}
        />

        {/* Price Dropdown */}
        <FilterDropdown
          label="Price"
          value={priceValue}
          options={priceOptions}
          onSelect={handlePriceSelect}
          renderSelected={(opt) => (
            <>
              <span className="text-[var(--gold)]">$</span>
              <span className="text-[var(--cream)]">{opt.label}</span>
            </>
          )}
          renderOption={(opt, isActive) => (
            <span className={isActive ? "text-[var(--gold)]" : ""}>{opt.label}</span>
          )}
        />

        {/* Category Dropdown */}
        <FilterDropdown
          label="Category"
          value={categoryValue}
          options={categoryOptions}
          onSelect={handleCategorySelect}
        />

        {/* Open Now Toggle */}
        <button
          onClick={() => setFilters((f) => ({ ...f, openNow: !f.openNow }))}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-all active:scale-[0.98] ${
            filters.openNow
              ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/50"
              : "bg-[var(--night)] text-[var(--muted)] border border-[var(--twilight)] hover:border-[var(--neon-green)]/30"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${
            filters.openNow ? "bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]" : "bg-[var(--twilight)]"
          }`} />
          Open{openCount > 0 ? ` (${openCount})` : ""}
        </button>

        {/* Has Events Toggle */}
        <button
          onClick={() => setFilters((f) => ({ ...f, withEvents: !f.withEvents }))}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-all active:scale-[0.98] ${
            filters.withEvents
              ? "bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/50"
              : "bg-[var(--night)] text-[var(--muted)] border border-[var(--twilight)] hover:border-[var(--coral)]/30"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Events
        </button>

        {/* Search Input */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <input
            type="text"
            placeholder="Search..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="w-full px-3 py-2 pl-8 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-mono text-xs text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)]/50 transition-colors"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {filters.search && (
            <button
              onClick={() => setFilters((f) => ({ ...f, search: "" }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--cream)]"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={() => setFilters({ openNow: false, priceLevel: [], venueTypes: [], neighborhoods: [], search: "", withEvents: false })}
            className="font-mono text-[0.65rem] text-[var(--coral)] hover:text-[var(--rose)] transition-colors active:scale-95"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export default function PortalSpotsView({ portalId, portalSlug, isExclusive = false }: Props) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Debounce search input — wait 300ms after typing stops before hitting API
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [filters.search]);

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
    if (debouncedSearch) params.set("q", debouncedSearch);
    return params;
  }, [portalId, isExclusive, filters.openNow, filters.withEvents, filters.priceLevel, filters.venueTypes, filters.neighborhoods, debouncedSearch]);

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
    <div className="py-3">
      <section className="mb-4 rounded-2xl border border-[var(--twilight)]/80 bg-[var(--void)]/70 backdrop-blur-md p-3 sm:p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--cream)]">Destinations</h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              <span className="text-[var(--soft)]">{spots.length}</span> places to explore
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
        <div className="mt-3 pt-3 border-t border-[var(--twilight)]/65">
          <FilterDeck
            filters={filters}
            setFilters={setFilters}
            openCount={meta.openCount}
            neighborhoods={meta.neighborhoods}
          />
        </div>
      </section>

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
        <div className="space-y-3">
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
                  <span className="font-mono text-[0.6rem] text-[var(--muted)] mr-2">{groupSpots.length}</span>
                  <svg className={`w-4 h-4 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="space-y-3 pb-4">
                    {groupSpots.map((spot) => <SpotCard key={spot.id} spot={spot} portalSlug={portalSlug} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSpots.map((spot) => <SpotCard key={spot.id} spot={spot} portalSlug={portalSlug} />)}
        </div>
      )}

    </div>
  );
}
