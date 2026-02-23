"use client";

import { memo, useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import CategoryIcon from "@/components/CategoryIcon";
import { triggerHaptic } from "@/lib/haptics";
import {
  QUICK_VENUE_TYPES,
  QUICK_VIBES,
  SPOTS_TABS,
  type SpotsTab,
} from "@/lib/spots-constants";
import { PREFERENCE_NEIGHBORHOOD_NAMES, getPortalNeighborhoodShortcuts } from "@/config/neighborhoods";
import type { FilterState } from "@/lib/hooks/useVenueDiscovery";
import { DEFAULT_FILTERS } from "@/lib/hooks/useVenueDiscovery";

/** Tier 1+2 neighborhoods — shown by default in the sheet */
const PRIMARY_NEIGHBORHOODS = new Set(PREFERENCE_NEIGHBORHOOD_NAMES);

const PRICE_LEVELS = [
  { value: 1, label: "$" },
  { value: 2, label: "$$" },
  { value: 3, label: "$$$" },
  { value: 4, label: "$$$$" },
] as const;

interface VenueFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  neighborhoods: string[];
  activeTab: SpotsTab;
  resultCount: number;
  portalSlug?: string;
}

export const VenueFilterSheet = memo(function VenueFilterSheet({
  isOpen,
  onClose,
  filters,
  setFilters,
  neighborhoods,
  activeTab,
  resultCount,
  portalSlug,
}: VenueFilterSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showAllHoods, setShowAllHoods] = useState(false);

  // Split neighborhoods into primary (Tier 1+2) and secondary (Tier 3)
  const { primaryHoods, secondaryHoods } = useMemo(() => {
    const primary: string[] = [];
    const secondary: string[] = [];
    for (const hood of neighborhoods) {
      if (PRIMARY_NEIGHBORHOODS.has(hood)) {
        primary.push(hood);
      } else {
        secondary.push(hood);
      }
    }
    return { primaryHoods: primary, secondaryHoods: secondary };
  }, [neighborhoods]);

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for entrance animation timing
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      document.body.style.overflow = "hidden";
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Cleanup body scroll lock on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Close on escape key — only register when open
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        triggerHaptic("light");
        onClose();
      }
    },
    [onClose]
  );

  // Scope category options to active tab
  const tabVenueTypes = useMemo(() => {
    const tab = SPOTS_TABS.find((t) => t.key === activeTab);
    return new Set(tab?.venueTypes ?? []);
  }, [activeTab]);

  const categoryOptions = useMemo(() => {
    return QUICK_VENUE_TYPES
      .filter(({ types }) => types.some((t) => tabVenueTypes.has(t)))
      .map(({ label, types, color }) => ({
        key: types.filter((t) => tabVenueTypes.has(t)).join(","),
        label,
        icon: types[0],
        color,
      }));
  }, [tabVenueTypes]);

  // Portal-aware neighborhood shortcuts
  const shortcuts = useMemo(() => getPortalNeighborhoodShortcuts(portalSlug), [portalSlug]);

  // Neighborhood handling
  const handleNeighborhoodSelect = useCallback(
    (key: string) => {
      triggerHaptic("selection");
      if (key === "all") {
        setFilters((f) => ({ ...f, neighborhoods: [] }));
      } else {
        const shortcut = shortcuts.find((s) => s.key === key);
        if (shortcut) {
          setFilters((f) => ({ ...f, neighborhoods: [...shortcut.neighborhoods] }));
        } else {
          setFilters((f) => {
            // If a shortcut is active, break out of it and select just this hood
            const isShortcutActive = shortcuts.some(
              (s) => s.neighborhoods.length === f.neighborhoods.length &&
                     s.neighborhoods.every((n) => f.neighborhoods.includes(n))
            );
            if (isShortcutActive) {
              return { ...f, neighborhoods: [key] };
            }
            // Normal toggle
            const already = f.neighborhoods.includes(key);
            return {
              ...f,
              neighborhoods: already
                ? f.neighborhoods.filter((n) => n !== key)
                : [...f.neighborhoods, key],
            };
          });
        }
      }
    },
    [setFilters, shortcuts]
  );

  // Category handling
  const handleCategoryToggle = useCallback(
    (key: string) => {
      triggerHaptic("selection");
      const types = key.split(",");
      setFilters((f) => {
        const currentSet = new Set(f.venueTypes);
        const allPresent = types.every((t) => currentSet.has(t));
        if (allPresent) {
          types.forEach((t) => currentSet.delete(t));
        } else {
          types.forEach((t) => currentSet.add(t));
        }
        return { ...f, venueTypes: Array.from(currentSet) };
      });
    },
    [setFilters]
  );

  // Price handling
  const handlePriceToggle = useCallback(
    (level: number) => {
      triggerHaptic("selection");
      setFilters((f) => {
        const has = f.priceLevel.includes(level);
        return {
          ...f,
          priceLevel: has
            ? f.priceLevel.filter((p) => p !== level)
            : [...f.priceLevel, level],
        };
      });
    },
    [setFilters]
  );

  // Vibe handling
  const handleVibeToggle = useCallback(
    (vibe: string) => {
      triggerHaptic("selection");
      setFilters((f) => ({
        ...f,
        vibes: f.vibes.includes(vibe)
          ? f.vibes.filter((v) => v !== vibe)
          : [...f.vibes, vibe],
      }));
    },
    [setFilters]
  );

  // Events toggle
  const handleEventsToggle = useCallback(() => {
    triggerHaptic("selection");
    setFilters((f) => ({ ...f, withEvents: !f.withEvents }));
  }, [setFilters]);

  // Clear filters (scoped to sheet — preserves occasion + openNow)
  const handleClearFilters = useCallback(() => {
    triggerHaptic("medium");
    setFilters((f) => ({
      ...DEFAULT_FILTERS,
      occasion: f.occasion,
      openNow: f.openNow,
    }));
  }, [setFilters]);

  // Apply (close sheet)
  const handleApply = useCallback(() => {
    triggerHaptic("success");
    onClose();
  }, [onClose]);

  // Check if any sheet-controlled filters are active
  const hasSheetFilters =
    filters.neighborhoods.length > 0 ||
    filters.venueTypes.length > 0 ||
    filters.priceLevel.length > 0 ||
    filters.vibes.length > 0 ||
    filters.withEvents;

  // Detect active neighborhood state for pills
  const isAllAreas = filters.neighborhoods.length === 0;
  const activeShortcutKey = useMemo(() => {
    if (filters.neighborhoods.length === 0) return null;
    for (const s of shortcuts) {
      if (s.neighborhoods.length === filters.neighborhoods.length &&
          s.neighborhoods.every((n) => filters.neighborhoods.includes(n))) {
        return s.key;
      }
    }
    return null;
  }, [filters.neighborhoods, shortcuts]);

  // Check if any secondary hood is actively selected (force expand if so)
  const hasActiveSecondaryHood = useMemo(() => {
    return secondaryHoods.some((h) => filters.neighborhoods.includes(h));
  }, [secondaryHoods, filters.neighborhoods]);

  const visibleHoods = showAllHoods || hasActiveSecondaryHood
    ? [...primaryHoods, ...secondaryHoods]
    : primaryHoods;

  if (typeof document === "undefined" || !isVisible) return null;

  const noResults = resultCount === 0;

  return createPortal(
    <div
      className={`fixed inset-0 z-[140] transition-colors duration-300 ${
        isAnimating ? "bg-black/50" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Venue filters"
    >
      <div
        className={`fixed bottom-0 left-0 right-0 bg-[var(--void)] border-t border-[var(--twilight)] rounded-t-2xl shadow-2xl max-h-[85vh] transition-transform duration-300 ${
          isAnimating ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-[var(--soft)]/50" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="font-mono text-lg font-semibold text-[var(--cream)]">Filters</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-11 h-11 -mr-1.5 rounded-full hover:bg-[var(--twilight)] transition-colors"
            aria-label="Close filters"
          >
            <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
          <div className="px-4 pb-6 space-y-6">

            {/* With Events toggle — promoted above area for discoverability */}
            <button
              onClick={handleEventsToggle}
              aria-pressed={filters.withEvents}
              className={`w-full min-h-[44px] flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-sm font-medium transition-all ${
                filters.withEvents
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
              }`}
            >
              <span
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  filters.withEvents
                    ? "border-[var(--void)] bg-[var(--void)]"
                    : "border-[var(--muted)]"
                }`}
              >
                {filters.withEvents && (
                  <svg className="w-3 h-3 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span>With events only</span>
            </button>

            {/* Category Section */}
            <div role="group" aria-label="Category filters">
              <h3 className="font-mono text-sm font-semibold text-[var(--cream)] mb-3">Category</h3>
              <div className="grid grid-cols-2 gap-2">
                {categoryOptions.map((cat) => {
                  const catTypes = cat.key.split(",");
                  const isActive = catTypes.every((t) =>
                    filters.venueTypes.includes(t)
                  );
                  return (
                    <button
                      key={cat.key}
                      onClick={() => handleCategoryToggle(cat.key)}
                      aria-pressed={isActive}
                      className={`min-h-[44px] flex items-center gap-2 px-3 py-2.5 rounded-lg font-mono text-sm font-medium transition-all ${
                        isActive
                          ? "text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                      }`}
                      style={
                        isActive
                          ? { backgroundColor: cat.color, color: "var(--void)" }
                          : undefined
                      }
                    >
                      <CategoryIcon
                        type={cat.icon}
                        size={16}
                        glow="none"
                        className="shrink-0"
                      />
                      <span className="truncate">{cat.label}</span>
                      {isActive && (
                        <svg className="w-4 h-4 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Area Section */}
            <div role="group" aria-label="Area filters">
              <h3 className="font-mono text-sm font-semibold text-[var(--cream)] mb-3">Area</h3>
              <div className="flex flex-wrap gap-2">
                {/* Special options */}
                <button
                  onClick={() => handleNeighborhoodSelect("all")}
                  aria-pressed={isAllAreas}
                  className={`min-h-[44px] px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all ${
                    isAllAreas
                      ? "bg-[var(--coral)] text-[var(--void)]"
                      : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                  }`}
                >
                  All Areas
                </button>
                {shortcuts.map((s) => {
                  const isShortcutActive = activeShortcutKey === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => handleNeighborhoodSelect(s.key)}
                      aria-pressed={isShortcutActive}
                      className={`min-h-[44px] px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all ${
                        isShortcutActive
                          ? "bg-[var(--coral)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                      }`}
                    >
                      {s.label.replace(/ \(.*\)$/, "")}
                    </button>
                  );
                })}
                {/* Individual neighborhoods — Tier 1+2 by default */}
                {visibleHoods.map((hood) => {
                  const isActive = filters.neighborhoods.includes(hood) && !activeShortcutKey;
                  return (
                    <button
                      key={hood}
                      onClick={() => handleNeighborhoodSelect(hood)}
                      aria-pressed={isActive}
                      className={`min-h-[44px] px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all ${
                        isActive
                          ? "bg-[var(--coral)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                      }`}
                    >
                      {hood}
                    </button>
                  );
                })}
                {/* Show more toggle for Tier 3 */}
                {secondaryHoods.length > 0 && !hasActiveSecondaryHood && (
                  <button
                    onClick={() => {
                      triggerHaptic("selection");
                      setShowAllHoods((v) => !v);
                    }}
                    className="min-h-[44px] px-4 py-2.5 rounded-lg font-mono text-xs font-medium text-[var(--muted)] border border-dashed border-[var(--twilight)] hover:text-[var(--soft)] transition-colors"
                  >
                    {showAllHoods ? "Show less" : `+${secondaryHoods.length} more`}
                  </button>
                )}
              </div>
            </div>

            {/* Price Section */}
            <div role="group" aria-label="Price filters">
              <h3 className="font-mono text-sm font-semibold text-[var(--cream)] mb-3">Price</h3>
              <div className="grid grid-cols-4 gap-2">
                {PRICE_LEVELS.map((p) => {
                  const isActive = filters.priceLevel.includes(p.value);
                  return (
                    <button
                      key={p.value}
                      onClick={() => handlePriceToggle(p.value)}
                      aria-pressed={isActive}
                      className={`min-h-[44px] px-4 py-2.5 rounded-lg font-mono text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-[var(--gold)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vibes Section */}
            <div role="group" aria-label="Vibe filters">
              <h3 className="font-mono text-sm font-semibold text-[var(--cream)] mb-3">Vibes</h3>
              <div className="flex flex-wrap gap-2">
                {QUICK_VIBES.map((vibe) => {
                  const isActive = filters.vibes.includes(vibe.value);
                  return (
                    <button
                      key={vibe.value}
                      onClick={() => handleVibeToggle(vibe.value)}
                      aria-pressed={isActive}
                      className={`min-h-[44px] px-3.5 py-2.5 rounded-full font-mono text-sm font-medium transition-all ${
                        isActive
                          ? "text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                      }`}
                      style={
                        isActive
                          ? { backgroundColor: vibe.color, color: "var(--void)" }
                          : undefined
                      }
                    >
                      {vibe.label}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Footer with actions */}
        <div className="sticky bottom-0 border-t border-[var(--twilight)] bg-[var(--void)] px-4 py-3 flex gap-3">
          {hasSheetFilters && (
            <button
              onClick={handleClearFilters}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg font-mono text-sm font-medium bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)] transition-colors"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={handleApply}
            disabled={noResults}
            className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-opacity ${
              noResults
                ? "bg-[var(--twilight)] text-[var(--muted)] cursor-not-allowed"
                : "bg-[var(--coral)] text-[var(--void)] hover:opacity-90"
            }`}
          >
            {noResults ? "No spots match" : `Show ${resultCount} spot${resultCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});
