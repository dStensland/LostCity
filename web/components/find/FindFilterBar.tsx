"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CategoryIcon from "@/components/CategoryIcon";
import { MobileFilterSheet } from "@/components/MobileFilterSheet";
import { formatGenre } from "@/lib/series-utils";
import { useFilterEngine } from "@/lib/hooks/useFilterEngine";
import { triggerHaptic } from "@/lib/haptics";

type FindFilterBarProps = {
  variant?: "full" | "compact";
  /** Hide all date-related filters (used in calendar mode where dates are navigated directly) */
  hideDate?: boolean;
  portalId?: string;
  portalExclusive?: boolean;
  portalSlug?: string;
  vertical?: string | null;
};

// ─── Filter counts hook ─────────────────────────────────────────────────────

function useFilterCounts(portalSlug?: string) {
  const [counts, setCounts] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    if (!portalSlug) return;

    const controller = new AbortController();
    fetch(`/api/portals/${portalSlug}/filter-counts`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCounts(data);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [portalSlug]);

  return counts;
}

const DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "Weekend" },
  { value: "week", label: "This Week" },
] as const;

type DropdownId = "category" | "date" | null;

// ─── Mobile strip configuration ──────────────────────────────────────────────

// The 8 categories most likely to surface relevant results on mobile.
// "Free" is not a category — it maps to the freeOnly filter toggle.
const MOBILE_CATEGORIES = [
  { value: "music",       label: "Music" },
  { value: "food_drink",  label: "Food & Drink" },
  { value: "comedy",      label: "Comedy" },
  { value: "nightlife",   label: "Nightlife" },
  { value: "art",         label: "Art" },
  { value: "sports",      label: "Sports" },
  { value: "recreation",  label: "Recreation" },
  { value: "exercise",    label: "Exercise" },
  { value: "family",      label: "Family" },
] as const;

// Civic portals show only relevant categories on mobile
const CIVIC_MOBILE_CATEGORIES = [
  { value: "government",  label: "Government" },
  { value: "community",   label: "Community" },
  { value: "volunteer",   label: "Volunteer" },
  { value: "family",      label: "Family" },
] as const;

// Resolves the CSS variable for a category's accent color.
// Tailwind can't generate dynamic arbitrary values at build time, so we use
// inline styles here. Falls back to --muted if no variable exists.
function catColor(value: string): string {
  return `var(--cat-${value}, var(--muted))`;
}

// ─── MobileFilterStrip ───────────────────────────────────────────────────────

type MobileFilterStripProps = {
  f: ReturnType<typeof useFilterEngine>;
  onOpenSheet: () => void;
  vertical?: string | null;
};

function MobileFilterStrip({ f, onOpenSheet, vertical }: MobileFilterStripProps) {
  const mobileCategories = vertical === "community" ? CIVIC_MOBILE_CATEGORIES : MOBILE_CATEGORIES;
  const handleCategoryTap = useCallback((value: string) => {
    triggerHaptic("selection");
    f.toggleCategory(value);
  }, [f]);

  const handleFreeTap = useCallback(() => {
    triggerHaptic("selection");
    f.toggleFreeOnly();
  }, [f]);

  const handleOpenSheet = useCallback(() => {
    triggerHaptic("light");
    onOpenSheet();
  }, [onOpenSheet]);

  const handleClearAll = useCallback(() => {
    triggerHaptic("medium");
    f.clearAll();
  }, [f]);

  return (
    <div className="sm:hidden">
      <div
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 pb-1"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorX: "contain" } as React.CSSProperties}
      >
        {/* Filters button — always first, fixed reference point */}
        <button
          onClick={handleOpenSheet}
          className={`flex-shrink-0 min-h-[44px] flex items-center gap-1.5 px-3.5 rounded-full font-mono text-xs font-medium border transition-transform active:scale-95 ${
            f.hasFilters
              ? "bg-[var(--action-primary)] text-[var(--btn-primary-text)] border-[var(--action-primary)]/40"
              : "bg-white/5 backdrop-blur-sm text-[var(--soft)] border-white/10"
          }`}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Filters
          {f.filterCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-black/20 text-[10px] font-bold leading-none">
              {f.filterCount}
            </span>
          )}
        </button>

        {/* Thin vertical divider */}
        <div className="flex-shrink-0 w-px h-5 bg-white/10" />

        {/* Category pills */}
        {mobileCategories.map((cat) => {
          const isActive = f.currentCategories.includes(cat.value);
          const color = catColor(cat.value);
          return (
            <button
              key={cat.value}
              onClick={() => handleCategoryTap(cat.value)}
              className="flex-shrink-0 min-h-[44px] flex items-center gap-1.5 px-3.5 rounded-full font-mono text-xs font-medium border transition-transform active:scale-95"
              style={
                isActive
                  ? {
                      backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
                      color: color,
                      borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
                    }
                  : {
                      backgroundColor: "rgba(255,255,255,0.05)",
                      backdropFilter: "blur(4px)",
                      color: "var(--soft)",
                      borderColor: "rgba(255,255,255,0.10)",
                    }
              }
            >
              <CategoryIcon
                type={cat.value}
                size={13}
                glow="none"
                className={`flex-shrink-0 ${isActive ? "" : "text-[var(--muted)]"}`}
              />
              {cat.label}
            </button>
          );
        })}

        {/* Free pill — separate from category pills, maps to freeOnly filter */}
        <button
          onClick={handleFreeTap}
          className={`flex-shrink-0 min-h-[44px] px-3.5 rounded-full font-mono text-xs font-medium border transition-transform active:scale-95 ${
            f.currentFreeOnly
              ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)]/35"
              : "bg-white/5 backdrop-blur-sm text-[var(--soft)] border-white/10"
          }`}
        >
          Free
        </button>

        {/* Clear — only visible when filters are active, trailing pill */}
        {f.hasFilters && (
          <button
            onClick={handleClearAll}
            className="flex-shrink-0 min-h-[44px] flex items-center gap-1 px-3 rounded-full font-mono text-xs font-medium border border-white/10 bg-white/5 text-[var(--muted)] active:scale-95 transition-transform whitespace-nowrap"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export default function FindFilterBar({ variant = "full", hideDate = false, portalId, portalExclusive = false, portalSlug, vertical }: FindFilterBarProps) {
  const f = useFilterEngine({ portalId, portalExclusive });
  const filterCounts = useFilterCounts(portalSlug);
  const categoryCounts = filterCounts.category || {};
  const isCommunity = vertical === "community";

  // For civic portals, filter desktop category dropdown to relevant options
  const CIVIC_CATEGORY_VALUES = new Set(["government", "community", "volunteer", "family", "education"]);
  const desktopCategoryOptions = isCommunity
    ? f.categoryOptions.filter((c) => CIVIC_CATEGORY_VALUES.has(c.value))
    : f.categoryOptions;

  // ─── Dropdown state (single active dropdown) ──────────────────────────────
  const [activeDropdown, setActiveDropdown] = useState<DropdownId>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const toggleDropdown = useCallback((id: DropdownId) => {
    setActiveDropdown((prev) => (prev === id ? null : id));
  }, []);

  // Close dropdown on outside click — use "click" (not "mousedown") so the
  // closing click is consumed by the handler and doesn't pass through to
  // elements beneath the dropdown (e.g. event cards).
  useEffect(() => {
    if (!activeDropdown) return;
    const onDocClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      if (
        categoryDropdownRef.current?.contains(target) ||
        dateDropdownRef.current?.contains(target)
      ) return;
      setActiveDropdown(null);
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [activeDropdown]);

  // ─── Derived labels ────────────────────────────────────────────────────────
  const isSpecificDate = /^\d{4}-\d{2}-\d{2}$/.test(f.currentDateFilter);

  const formatDateLabel = useCallback((dateStr: string): string => {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, []);

  const dateFilterLabel =
    !f.effectiveDateFilter
      ? "Upcoming"
      : isSpecificDate
      ? formatDateLabel(f.currentDateFilter)
      : DATE_OPTIONS.find((d) => d.value === f.effectiveDateFilter)?.label || "Upcoming";

  const categoryLabel =
    f.currentCategories.length === 0
      ? "Category"
      : f.currentCategories.length === 1
      ? f.categoryOptions.find((c) => c.value === f.currentCategories[0])?.label || "Category"
      : `${f.currentCategories.length} categories`;

  const visibleGenreOptions = f.currentCategories.length === 1 ? f.genreOptions : [];

  // Wrap date/mood setters to also close dropdown
  const handleSetDate = useCallback((date: string) => {
    f.setDateFilter(date);
    setActiveDropdown(null);
  }, [f]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Desktop filter bar */}
      <div className="hidden sm:block relative z-10">
        <div className={`${variant === "compact" ? "py-1.5" : "py-2"}`}>
          <div className={`flex items-center flex-wrap ${variant === "compact" ? "gap-1.5" : "gap-2"}`}>
            {/* Category dropdown */}
            <div className="relative" ref={categoryDropdownRef}>
              <button
                onClick={() => toggleDropdown("category")}
                className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
                  f.currentCategories.length > 0
                    ? "bg-[var(--action-primary)] text-[var(--btn-primary-text)] border-[var(--action-primary)]/40 shadow-sm"
                    : "bg-[var(--dusk)]/80 text-[var(--cream)]/80 border-[var(--twilight)]/80 hover:text-[var(--cream)] hover:bg-[var(--twilight)]/40 hover:border-[var(--twilight)]"
                }`}
              >
                {categoryLabel}
                <svg className={`w-3 h-3 transition-transform ${activeDropdown === "category" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {activeDropdown === "category" && (
                <div className="absolute top-full left-0 mt-1 w-64 max-h-80 overflow-y-auto rounded-xl border border-[var(--twilight)] shadow-xl z-50 bg-[var(--void)]/95 backdrop-blur-md animate-dropdown-in">
                  <div className="p-2">
                    {desktopCategoryOptions.map((cat) => {
                      const isActive = f.currentCategories.includes(cat.value);
                      const count = categoryCounts[cat.value];
                      const isEmpty = count === 0;
                      return (
                        <button
                          key={cat.value}
                          onClick={() => f.toggleCategory(cat.value)}
                          disabled={isEmpty}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-colors ${
                            isEmpty
                              ? "opacity-40 pointer-events-none text-[var(--muted)]"
                              : isActive
                              ? "bg-[var(--action-primary)] text-[var(--btn-primary-text)]"
                              : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                          }`}
                        >
                          <CategoryIcon
                            type={cat.value}
                            size={14}
                            className={isActive ? "text-[var(--void)]" : "text-[var(--category-color,var(--muted))]"}
                            glow={isActive ? "none" : "subtle"}
                          />
                          <span className="truncate">{cat.label}</span>
                          {count != null && count > 0 && !isActive && (
                            <span className="ml-auto text-2xs text-[var(--muted)]">
                              {count}
                            </span>
                          )}
                          {isActive && (
                            <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Date dropdown — hidden in calendar mode */}
            {variant === "full" && !hideDate && (
              <div className="relative" ref={dateDropdownRef}>
                <button
                  onClick={() => toggleDropdown("date")}
                  className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
                    f.effectiveDateFilter
                      ? "bg-[var(--gold)] text-[var(--void)] border-[var(--gold)]/40 shadow-sm"
                      : "bg-[var(--dusk)]/80 text-[var(--cream)]/80 border-[var(--twilight)]/80 hover:text-[var(--cream)] hover:bg-[var(--twilight)]/40 hover:border-[var(--twilight)]"
                  }`}
                >
                  {dateFilterLabel}
                  <svg className={`w-3 h-3 transition-transform ${activeDropdown === "date" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {activeDropdown === "date" && (
                  <div className="absolute top-full left-0 mt-1 w-44 rounded-xl border border-[var(--twilight)] shadow-xl z-50 bg-[var(--void)]/95 backdrop-blur-md animate-dropdown-in">
                    <div className="p-2">
                      <button
                        onClick={() => handleSetDate("")}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-colors ${
                          !f.effectiveDateFilter
                            ? "bg-[var(--gold)] text-[var(--void)]"
                            : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                        }`}
                      >
                        Upcoming
                      </button>
                      <div className="h-px bg-[var(--twilight)] my-1" />
                      {DATE_OPTIONS.map((df) => {
                        const isActive = f.effectiveDateFilter === df.value;
                        return (
                          <button
                            key={df.value}
                            onClick={() => handleSetDate(df.value)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-colors ${
                              isActive
                                ? "bg-[var(--gold)] text-[var(--void)]"
                                : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                            }`}
                          >
                            {df.label}
                          </button>
                        );
                      })}
                      <div className="h-px bg-[var(--twilight)] my-1" />
                      <button
                        onClick={() => dateInputRef.current?.showPicker()}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-colors ${
                          isSpecificDate
                            ? "bg-[var(--gold)] text-[var(--void)]"
                            : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {isSpecificDate ? formatDateLabel(f.currentDateFilter) : "Pick date"}
                      </button>
                      <input
                        ref={dateInputRef}
                        type="date"
                        className="sr-only"
                        min={new Date().toISOString().split("T")[0]}
                        value={isSpecificDate ? f.currentDateFilter : ""}
                        onChange={(e) => {
                          if (e.target.value) handleSetDate(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Filters button (opens mobile sheet) */}
            <button
              onClick={() => setMobileSheetOpen(true)}
              className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
                f.hasFilters
                  ? "bg-[var(--action-primary)] text-[var(--btn-primary-text)] border-[var(--action-primary)]/40 shadow-sm"
                  : "bg-[var(--twilight)]/70 text-[var(--cream)] border-[var(--twilight)]/80 hover:bg-[var(--twilight)]"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Filters
              {f.filterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-black/20 text-[10px] font-bold">
                  {f.filterCount}
                </span>
              )}
            </button>

            {f.hasFilters && (
              <button
                onClick={f.clearAll}
                className="btn-press flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-[11px] font-medium border border-[var(--twilight)]/85 bg-[var(--dusk)]/70 text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--soft)]/45 whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Genre sub-bar */}
      {visibleGenreOptions.length > 0 && (
        <div className="hidden sm:block">
          <div className="py-1.5 relative">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pr-6">
              <span className="flex-shrink-0 text-xs font-mono uppercase tracking-wider text-[var(--muted)] mr-1">Genre</span>
              {visibleGenreOptions.map((opt) => {
                const isActive = f.currentGenres.includes(opt.genre);
                return (
                  <button
                    key={opt.genre}
                    onClick={() => f.toggleGenre(opt.genre)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all border ${
                      isActive
                        ? "bg-[var(--action-primary)] text-[var(--btn-primary-text)] border-[var(--action-primary)]/40 shadow-sm"
                        : "bg-[var(--dusk)]/80 text-[var(--cream)]/70 border-[var(--twilight)]/60 hover:text-[var(--cream)]"
                    }`}
                  >
                    {formatGenre(opt.genre)}
                  </button>
                );
              })}
            </div>
            {/* Fade mask to show strip is scrollable */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--night)] to-transparent pointer-events-none" />
          </div>
        </div>
      )}

      {/* Mobile filter strip */}
      <MobileFilterStrip
        f={f}
        onOpenSheet={() => setMobileSheetOpen(true)}
        vertical={vertical}
      />

      {/* Mobile filter sheet */}
      <MobileFilterSheet
        isOpen={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        currentCategories={f.currentCategories}
        currentDateFilter={f.currentDateFilter}
        currentFreeOnly={f.currentFreeOnly}
        currentTags={f.currentTags}
        currentVibes={f.currentVibes}
        categoryOptions={f.categoryOptions}
        tagGroups={f.tagGroupOptions}
        vibeGroups={f.vibeGroupOptions}
        hideDate={hideDate}
        onToggleCategory={f.toggleCategory}
        onSetDateFilter={handleSetDate}
        onToggleFreeOnly={f.toggleFreeOnly}
        onToggleTag={f.toggleTag}
        onToggleVibe={f.toggleVibe}
        onClearAll={f.clearAll}
      />
    </>
  );
}
