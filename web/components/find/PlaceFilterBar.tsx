"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import CategoryIcon from "@/components/CategoryIcon";
import {
  QUICK_VENUE_TYPES,
  QUICK_VIBES,
  CUISINE_TYPES,
  SPOTS_TABS,
  getTabChips,
  type SpotsTab,
} from "@/lib/spots-constants";
import { getPortalNeighborhoodShortcuts } from "@/config/neighborhoods";
import type { FilterState } from "@/lib/hooks/useVenueDiscovery";
import { DEFAULT_FILTERS } from "@/lib/hooks/useVenueDiscovery";
import { PlaceFilterSheet } from "@/components/find/PlaceFilterSheet";
import { triggerHaptic } from "@/lib/haptics";

const FindSearchInput = dynamic(() => import("@/components/find/FindSearchInput"), {
  loading: () => (
    <div className="h-10 rounded-xl bg-[var(--dusk)]/60 border border-[var(--twilight)]/50 animate-pulse" />
  ),
});


// ---------------------------------------------------------------------------
// FilterDropdown — reusable compact dropdown
// ---------------------------------------------------------------------------

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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label} filter`}
        className="flex items-center gap-2 bg-[var(--dusk)]/80 border border-[var(--twilight)]/80 rounded-full px-3 py-2 font-mono text-xs cursor-pointer hover:border-[var(--coral)]/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)]"
      >
        {renderSelected ? (
          renderSelected(selected)
        ) : (
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
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={`${label} options`}
          className="absolute z-50 mt-1 w-52 max-h-72 overflow-y-auto bg-[var(--void)]/95 backdrop-blur-md border border-[var(--twilight)] rounded-xl shadow-xl animate-dropdown-in"
        >
          {options.map((opt) => {
            const isActive = value === opt.key;
            return (
              <button
                key={opt.key}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onSelect(opt.key);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left font-mono text-xs transition-colors ${
                  isActive
                    ? "bg-[var(--coral)]/15 text-[var(--coral)]"
                    : "text-[var(--soft)] hover:bg-[var(--twilight)]/30 hover:text-[var(--cream)]"
                }`}
              >
                {renderOption ? (
                  renderOption(opt, isActive)
                ) : (
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

// ---------------------------------------------------------------------------
// FilterDeck — the full filter bar
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tab-aware occasion / category / nightlife chip row
// ---------------------------------------------------------------------------

function TabChips({
  activeTab,
  occasion,
  onOccasionChange,
}: {
  activeTab: SpotsTab;
  occasion: string | null;
  onOccasionChange: (key: string | null) => void;
}) {
  const chips = getTabChips(activeTab);

  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
      {chips.map((chip) => {
        const isActive = occasion === chip.key;
        return (
          <button
            key={chip.key}
            onClick={() => onOccasionChange(isActive ? null : chip.key)}
            aria-pressed={isActive}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] whitespace-nowrap border ${
              isActive
                ? "font-semibold"
                : "bg-[var(--dusk)]/80 text-[var(--soft)] border-[var(--twilight)]/80 hover:text-[var(--cream)] hover:border-[var(--twilight)]"
            }`}
            style={
              isActive
                ? {
                    backgroundColor: `${chip.color}25`,
                    borderColor: `${chip.color}60`,
                    color: chip.color,
                  }
                : undefined
            }
          >
            {chip.icon && (
              <CategoryIcon type={chip.icon} size={12} glow="none" weight="regular" />
            )}
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterDeck — the full filter bar
// ---------------------------------------------------------------------------

function FilterDeck({
  filters,
  setFilters,
  openCount,
  neighborhoods,
  userLocation,
  onLocationChange,
  activeTab,
  geoLoading,
  requestLocation,
  portalSlug,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  openCount: number;
  neighborhoods: string[];
  userLocation: { lat: number; lng: number } | null;
  onLocationChange: (loc: { lat: number; lng: number } | null) => void;
  activeTab: SpotsTab;
  geoLoading: boolean;
  requestLocation: () => void;
  portalSlug: string;
}) {
  const shortcuts = useMemo(() => getPortalNeighborhoodShortcuts(portalSlug), [portalSlug]);

  const neighborhoodOptions = useMemo(() => {
    const opts: { key: string; label: string }[] = [
      { key: "all", label: "All Areas" },
      ...shortcuts.map((s) => ({ key: s.key, label: s.label })),
      ...neighborhoods.map((n) => ({ key: n, label: n })),
    ];
    return opts;
  }, [neighborhoods, shortcuts]);

  const neighborhoodValue = useMemo(() => {
    if (filters.neighborhoods.length === 0) return "all";
    // Check each shortcut to see if filters match
    for (const s of shortcuts) {
      const names = s.neighborhoods;
      if (names.every((n) => filters.neighborhoods.includes(n)) && filters.neighborhoods.length === names.length) {
        return s.key;
      }
    }
    if (filters.neighborhoods.length === 1) return filters.neighborhoods[0];
    return filters.neighborhoods[0];
  }, [filters.neighborhoods, shortcuts]);

  const handleNeighborhoodSelect = (key: string) => {
    if (key === "all") {
      setFilters((f) => ({ ...f, neighborhoods: [] }));
    } else {
      const shortcut = shortcuts.find((s) => s.key === key);
      if (shortcut) {
        setFilters((f) => ({ ...f, neighborhoods: [...shortcut.neighborhoods] }));
      } else {
        setFilters((f) => ({ ...f, neighborhoods: [key] }));
      }
    }
  };

  const priceOptions = [
    { key: "all", label: "Any Price" },
    { key: "1", label: "$" },
    { key: "2", label: "$$" },
    { key: "1,2", label: "$ – $$" },
    { key: "3", label: "$$$" },
    { key: "4", label: "$$$$" },
    { key: "3,4", label: "$$$ – $$$$" },
  ];

  const priceValue = filters.priceLevel.length === 0 ? "all" : filters.priceLevel.sort().join(",");

  const handlePriceSelect = (key: string) => {
    if (key === "all") {
      setFilters((f) => ({ ...f, priceLevel: [] }));
    } else {
      setFilters((f) => ({ ...f, priceLevel: key.split(",").map(Number) }));
    }
  };

  // Scope category dropdown to the active tab's venue types
  const tabVenueTypes = useMemo(() => {
    const tab = SPOTS_TABS.find((t) => t.key === activeTab);
    return new Set(tab?.venueTypes ?? []);
  }, [activeTab]);

  const categoryOptions = useMemo(() => {
    const tabFiltered = QUICK_VENUE_TYPES
      .filter(({ types }) => types.some((t) => tabVenueTypes.has(t)))
      .map(({ label, types }) => ({
        key: types.filter((t) => tabVenueTypes.has(t)).join(","),
        label,
        icon: types[0],
      }));
    return [
      { key: "all", label: "All Types", icon: "other" as string },
      ...tabFiltered,
    ];
  }, [tabVenueTypes]);

  const categoryValue = filters.venueTypes.length === 0 ? "all" : filters.venueTypes.sort().join(",");

  const handleCategorySelect = (key: string) => {
    if (key === "all") {
      setFilters((f) => ({ ...f, venueTypes: [] }));
    } else {
      setFilters((f) => ({ ...f, venueTypes: key.split(",") }));
    }
  };

  const hasActiveFilters =
    filters.openNow ||
    filters.priceLevel.length > 0 ||
    filters.venueTypes.length > 0 ||
    filters.neighborhoods.length > 0 ||
    filters.vibes.length > 0 ||
    filters.cuisine.length > 0 ||
    filters.withEvents ||
    filters.occasion != null;

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const advancedFilterCount = (filters.priceLevel.length > 0 ? 1 : 0) + filters.vibes.length + filters.cuisine.length;
  const hasAdvancedFiltersActive = advancedFilterCount > 0;

  return (
    <div className="space-y-2.5">
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[var(--cream)]">{opt.label}</span>
            </>
          )}
        />

        {/* Category Dropdown */}
        <FilterDropdown label="Category" value={categoryValue} options={categoryOptions} onSelect={handleCategorySelect} />

        {/* Open Now Toggle */}
        <button
          onClick={() => setFilters((f) => ({ ...f, openNow: !f.openNow }))}
          aria-pressed={filters.openNow}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
            filters.openNow
              ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/50"
              : "bg-[var(--dusk)]/80 text-[var(--muted)] border border-[var(--twilight)]/80 hover:border-[var(--neon-green)]/30"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              filters.openNow ? "bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]" : "bg-[var(--twilight)]"
            }`}
          />
          Open{openCount > 0 ? ` (${openCount})` : ""}
        </button>

        {/* Has Events Toggle */}
        <button
          onClick={() => setFilters((f) => ({ ...f, withEvents: !f.withEvents }))}
          aria-pressed={filters.withEvents}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
            filters.withEvents
              ? "bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/50"
              : "bg-[var(--dusk)]/80 text-[var(--muted)] border border-[var(--twilight)]/80 hover:border-[var(--coral)]/30"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Events
        </button>

        {/* Near Me Toggle */}
        {userLocation ? (
          <button
            onClick={() => onLocationChange(null)}
            aria-pressed={true}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon-cyan)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/45"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 0v4m0-4h4m-4 0H8" />
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
            </svg>
            Near Me
            <svg className="w-3 h-3 ml-0.5 opacity-70 hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <button
            onClick={requestLocation}
            disabled={geoLoading}
            aria-pressed={false}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon-cyan)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] bg-[var(--dusk)]/80 text-[var(--muted)] border border-[var(--twilight)]/80 hover:border-[var(--neon-cyan)]/30 disabled:opacity-50 disabled:cursor-wait animate-near-me-hint`}
          >
            {geoLoading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v3m0 12v3M3 12h3m12 0h3" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            )}
            Near Me
          </button>
        )}

        <button
          onClick={() => setShowAdvancedFilters((current) => !current)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
            showAdvancedFilters || hasAdvancedFiltersActive
              ? "bg-[var(--twilight)]/75 text-[var(--cream)] border border-[var(--coral)]/35"
              : "bg-[var(--dusk)]/80 text-[var(--muted)] border border-[var(--twilight)]/80 hover:text-[var(--cream)]"
          }`}
          aria-expanded={showAdvancedFilters}
          aria-controls="destinations-advanced-filters"
        >
          More filters
          {advancedFilterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[var(--coral)]/20 text-[var(--coral)] text-[10px] leading-none">
              {advancedFilterCount}
            </span>
          )}
        </button>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors active:scale-95"
          >
            Clear
          </button>
        )}
      </div>

      {/* Advanced filters */}
      {(showAdvancedFilters || hasAdvancedFiltersActive) && (
        <div
          id="destinations-advanced-filters"
          className="rounded-xl border border-[var(--twilight)]/65 bg-[var(--night)]/55 p-2.5 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">Advanced filters</span>
            {showAdvancedFilters && (
              <button
                onClick={() => setShowAdvancedFilters(false)}
                className="font-mono text-xs text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
              >
                Hide
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              renderOption={(opt, isActive) => <span className={isActive ? "text-[var(--gold)]" : ""}>{opt.label}</span>}
            />
          </div>

          {/* Cuisine chips — eat-drink tab only */}
          {activeTab === "eat-drink" && (
            <div>
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)] mb-1.5 block">Cuisine</span>
              <div className="flex flex-wrap gap-1.5">
                {CUISINE_TYPES.map((c) => {
                  const isActive = filters.cuisine.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      role="checkbox"
                      aria-checked={isActive}
                      aria-label={`Filter by ${c.label} cuisine`}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          cuisine: isActive ? f.cuisine.filter((v) => v !== c.value) : [...f.cuisine, c.value],
                        }))
                      }
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] whitespace-nowrap ${
                        isActive
                          ? "bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/50"
                          : "bg-[var(--dusk)]/80 text-[var(--muted)] border border-[var(--twilight)]/80 hover:text-[var(--soft)]"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {QUICK_VIBES.map((vibe) => {
              const isActive = filters.vibes.includes(vibe.value);
              return (
                <button
                  key={vibe.value}
                  role="checkbox"
                  aria-checked={isActive}
                  aria-label={`Filter by ${vibe.label}`}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      vibes: isActive ? f.vibes.filter((v) => v !== vibe.value) : [...f.vibes, vibe.value],
                    }))
                  }
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] whitespace-nowrap ${
                    isActive
                      ? "text-[var(--cream)] border"
                      : "bg-[var(--dusk)]/80 text-[var(--muted)] border border-[var(--twilight)]/80 hover:text-[var(--soft)]"
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: `${vibe.color}20`,
                          borderColor: `${vibe.color}50`,
                          color: vibe.color,
                        }
                      : undefined
                  }
                >
                  {vibe.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlaceFilterBar — exported composite (search + filters + context label)
// ---------------------------------------------------------------------------

interface PlaceFilterBarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  openCount: number;
  neighborhoods: string[];
  portalSlug: string;
  portalId: string;
  contextLabel?: string | null;
  userLocation?: { lat: number; lng: number } | null;
  onLocationChange?: (loc: { lat: number; lng: number } | null) => void;
  activeTab?: SpotsTab;
  filteredCount?: number;
}

// ---------------------------------------------------------------------------
// MobileFilterStrip — compact filter strip for mobile (below sm)
// ---------------------------------------------------------------------------

function MobileFilterStrip({
  filters,
  setFilters,
  openCount,
  neighborhoods,
  userLocation,
  onLocationChange,
  activeTab,
  filteredCount,
  geoLoading,
  requestLocation,
  portalSlug,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  openCount: number;
  neighborhoods: string[];
  userLocation: { lat: number; lng: number } | null;
  onLocationChange: (loc: { lat: number; lng: number } | null) => void;
  activeTab: SpotsTab;
  filteredCount: number;
  geoLoading: boolean;
  requestLocation: () => void;
  portalSlug: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Count active filter *sections* inside the sheet (max 6, bounded and predictable)
  const activeFilterCount =
    (filters.neighborhoods.length > 0 ? 1 : 0) +
    (filters.venueTypes.length > 0 ? 1 : 0) +
    (filters.priceLevel.length > 0 ? 1 : 0) +
    (filters.vibes.length > 0 ? 1 : 0) +
    (filters.cuisine.length > 0 ? 1 : 0) +
    (filters.withEvents ? 1 : 0);

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {/* Filters button — opens sheet */}
        <button
          onClick={() => {
            triggerHaptic("selection");
            setSheetOpen(true);
          }}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] ${
            activeFilterCount > 0
              ? "bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/50"
              : "bg-[var(--dusk)]/80 text-[var(--soft)] border border-[var(--twilight)]/80"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--coral)] text-[var(--void)] text-[10px] font-bold leading-none">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Open Now toggle */}
        <button
          onClick={() => {
            triggerHaptic("selection");
            setFilters((f) => ({ ...f, openNow: !f.openNow }));
          }}
          aria-pressed={filters.openNow}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] ${
            filters.openNow
              ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/50"
              : "bg-[var(--dusk)]/80 text-[var(--muted)] border border-[var(--twilight)]/80"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              filters.openNow ? "bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]" : "bg-[var(--twilight)]"
            }`}
          />
          Open{openCount > 0 ? ` (${openCount})` : ""}
        </button>

        {/* Near Me toggle */}
        {userLocation ? (
          <button
            onClick={() => {
              triggerHaptic("selection");
              onLocationChange(null);
            }}
            aria-pressed={true}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/45"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
            Near Me
          </button>
        ) : (
          <button
            onClick={() => {
              triggerHaptic("selection");
              requestLocation();
            }}
            disabled={geoLoading}
            aria-pressed={false}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full font-mono text-xs font-medium transition-all active:scale-[0.98] bg-[var(--dusk)]/80 text-[var(--muted)] border border-[var(--twilight)]/80 disabled:opacity-50 disabled:cursor-wait animate-near-me-hint"
          >
            {geoLoading ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v3m0 12v3M3 12h3m12 0h3" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            )}
            Near Me
          </button>
        )}
      </div>

      <PlaceFilterSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        setFilters={setFilters}
        neighborhoods={neighborhoods}
        activeTab={activeTab}
        resultCount={filteredCount}
        portalSlug={portalSlug}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// PlaceFilterBar — exported composite (search + filters + context label)
// ---------------------------------------------------------------------------

export default function PlaceFilterBar({
  filters,
  setFilters,
  openCount,
  neighborhoods,
  portalSlug,
  portalId,
  contextLabel,
  userLocation = null,
  onLocationChange,
  activeTab = "eat-drink",
  filteredCount = 0,
}: PlaceFilterBarProps) {
  const handleLocationChange = onLocationChange ?? (() => {});

  // Shared geolocation state — single source for both mobile and desktop
  const [geoLoading, setGeoLoading] = useState(false);
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        handleLocationChange(loc);
        try { localStorage.setItem("userLocation", JSON.stringify(loc)); } catch { /* quota */ }
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        try { localStorage.removeItem("userLocation"); } catch { /* quota */ }
        handleLocationChange(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [handleLocationChange]);

  const handleOccasionChange = useCallback(
    (key: string | null) => {
      setFilters((f) => ({ ...f, occasion: key }));
    },
    [setFilters]
  );

  return (
    <div className="mb-3 pb-3 border-b border-[var(--twilight)]/65">
      {/* Context label from dashboard quick links */}
      {contextLabel && (
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/35 font-mono text-xs font-medium">
            {contextLabel}
            <button
              onClick={() => {
                setFilters(DEFAULT_FILTERS);
              }}
              className="ml-0.5 hover:text-[var(--rose)] transition-colors"
              aria-label={`Clear ${contextLabel} filter`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>
      )}
      <div className="mb-3">
        <FindSearchInput portalSlug={portalSlug} portalId={portalId} findType="destinations" placeholder="Search spots..." />
      </div>

      {/* Tab chips — visible on all breakpoints */}
      <div className="mb-2.5">
        <TabChips
          activeTab={activeTab}
          occasion={filters.occasion}
          onOccasionChange={handleOccasionChange}
        />
      </div>

      {/* Mobile: compact filter strip + sheet (below sm) */}
      <div className="sm:hidden">
        <MobileFilterStrip
          filters={filters}
          setFilters={setFilters}
          openCount={openCount}
          neighborhoods={neighborhoods}
          userLocation={userLocation}
          onLocationChange={handleLocationChange}
          activeTab={activeTab}
          filteredCount={filteredCount}
          geoLoading={geoLoading}
          requestLocation={requestLocation}
          portalSlug={portalSlug}
        />
      </div>

      {/* Desktop: full FilterDeck (sm and up) */}
      <div className="hidden sm:block">
        <FilterDeck
          filters={filters}
          setFilters={setFilters}
          openCount={openCount}
          neighborhoods={neighborhoods}
          userLocation={userLocation}
          onLocationChange={handleLocationChange}
          activeTab={activeTab}
          geoLoading={geoLoading}
          requestLocation={requestLocation}
          portalSlug={portalSlug}
        />
      </div>
    </div>
  );
}
