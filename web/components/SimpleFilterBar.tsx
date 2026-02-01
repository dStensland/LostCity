"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useEffect, useRef, useTransition } from "react";
import { CATEGORIES } from "@/lib/search";
import CategoryIcon, { CATEGORY_CONFIG, type CategoryType } from "./CategoryIcon";
import { useAuth } from "@/lib/auth-context";
import { MobileFilterSheet } from "./MobileFilterSheet";

// Group categories into logical sections
const CATEGORY_GROUPS = {
  "Popular": ["music", "food_drink", "nightlife"],
  "Arts & Culture": ["art", "theater", "comedy", "film", "dance", "words"],
  "Activities": ["sports", "fitness", "gaming", "outdoors", "family", "tours"],
  "Community": ["community", "meetup", "learning", "religious", "markets", "wellness"],
} as const;

// Get all categories that are in groups
const GROUPED_CATEGORY_VALUES = Object.values(CATEGORY_GROUPS).flat() as readonly string[];

// Get categories that aren't in any group (for "Other" section)
const UNGROUPED_CATEGORIES = CATEGORIES.filter(
  cat => !GROUPED_CATEGORY_VALUES.includes(cat.value)
);

type SimpleFilterBarProps = {
  variant?: "full" | "compact";
};

// Simple date filters for the simplified bar
export const SIMPLE_DATE_FILTERS = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "Weekend" },
  { value: "week", label: "This Week" },
] as const;

export default function SimpleFilterBar({ variant = "full" }: SimpleFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { user } = useAuth();

  // Dropdown states
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll fade indicators state
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Optimistic view state for instant UI feedback
  const [optimisticView, setOptimisticView] = useState<string | null>(null);

  // View mode (list or map) - use optimistic state when pending for instant feedback
  const urlView = searchParams.get("view") || "events";
  const currentView = optimisticView || urlView;

  // Reset optimistic state when URL catches up
  useEffect(() => {
    if (optimisticView && urlView === optimisticView) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync optimistic state with URL
      setOptimisticView(null);
    }
  }, [urlView, optimisticView]);

  // Current filter values
  const currentCategories = useMemo(
    () => searchParams.get("categories")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentDateFilter = searchParams.get("date") || "";
  const currentFreeOnly = searchParams.get("free") === "1";
  const currentFeedMode = searchParams.get("feed") || "all";

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setDateDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update scroll fade indicators
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    function updateFadeIndicators() {
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      const isAtStart = scrollLeft <= 2; // Small threshold for floating point errors
      const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 2;

      setShowLeftFade(!isAtStart);
      setShowRightFade(!isAtEnd);
    }

    // Check on mount and when content changes
    updateFadeIndicators();

    // Update on scroll
    container.addEventListener("scroll", updateFadeIndicators);

    // Update on resize (viewport changes might affect scroll position)
    window.addEventListener("resize", updateFadeIndicators);

    return () => {
      container.removeEventListener("scroll", updateFadeIndicators);
      window.removeEventListener("resize", updateFadeIndicators);
    };
  }, [currentCategories, currentDateFilter, currentFreeOnly]); // Re-run when pills change

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      params.delete("page");
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      startTransition(() => {
        router.push(newUrl, { scroll: false });
      });
    },
    [router, pathname, searchParams, startTransition]
  );

  const toggleCategory = useCallback(
    (category: string) => {
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter((c) => c !== category)
        : [...currentCategories, category];
      updateParams({
        categories: newCategories.length > 0 ? newCategories.join(",") : null,
      });
    },
    [currentCategories, updateParams]
  );

  const setDateFilter = useCallback(
    (date: string) => {
      updateParams({
        date: currentDateFilter === date ? null : date,
      });
      setDateDropdownOpen(false);
    },
    [currentDateFilter, updateParams]
  );

  const toggleFreeOnly = useCallback(() => {
    updateParams({
      free: currentFreeOnly ? null : "1",
      price: currentFreeOnly ? null : "free",
    });
  }, [currentFreeOnly, updateParams]);

  const toggleFeedMode = useCallback(
    (mode: "all" | "following") => {
      updateParams({
        feed: mode === "all" ? null : mode,
      });
    },
    [updateParams]
  );

  const setViewMode = useCallback(
    (view: "events" | "map" | "calendar") => {
      setOptimisticView(view);
      updateParams({ view });
    },
    [updateParams]
  );

  const hasFilters = currentCategories.length > 0 || currentDateFilter || currentFreeOnly || currentFeedMode !== "all";

  const clearAll = useCallback(() => {
    updateParams({
      categories: null,
      date: null,
      free: null,
      price: null,
      feed: null,
    });
  }, [updateParams]);

  // Get display label for current date filter
  const dateFilterLabel = currentDateFilter
    ? SIMPLE_DATE_FILTERS.find(d => d.value === currentDateFilter)?.label || "When"
    : "When";

  // Get display label for categories
  const categoryLabel = currentCategories.length === 0
    ? "Category"
    : currentCategories.length === 1
    ? CATEGORIES.find(c => c.value === currentCategories[0])?.label || "Category"
    : `${currentCategories.length} selected`;

  return (
    <>
      {/* Desktop view (>= 640px) */}
      <div className="hidden sm:block sticky top-[112px] z-10 bg-[var(--night)] border-b border-[var(--twilight)]">
        <div className={`max-w-5xl mx-auto px-4 ${variant === "compact" ? "py-1.5" : "py-2"}`}>
          <div className="flex items-center gap-2">
            {/* Category dropdown */}
            <div className="relative" ref={categoryDropdownRef}>
              <button
                onClick={() => {
                  setCategoryDropdownOpen(!categoryDropdownOpen);
                  setDateDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                  currentCategories.length > 0
                    ? "bg-[var(--coral)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                {categoryLabel}
                <svg className={`w-3 h-3 transition-transform ${categoryDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Category dropdown menu */}
              {categoryDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 max-h-80 overflow-y-auto rounded-lg border border-[var(--twilight)] shadow-xl z-50" style={{ backgroundColor: "var(--void)" }}>
                  <div className="p-2">
                    {Object.entries(CATEGORY_GROUPS).map(([groupName, categoryValues], groupIdx) => (
                      <div key={groupName}>
                        {/* Section Header */}
                        <div className="px-3 py-1.5 text-[0.6rem] font-mono uppercase tracking-wider text-[var(--muted)]">
                          {groupName}
                        </div>

                        {/* Categories in this group */}
                        {categoryValues.map((catValue) => {
                          const cat = CATEGORIES.find(c => c.value === catValue);
                          if (!cat) return null;
                          const isActive = currentCategories.includes(cat.value);
                          return (
                            <button
                              key={cat.value}
                              onClick={() => toggleCategory(cat.value)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-colors ${
                                isActive
                                  ? "bg-[var(--coral)] text-[var(--void)]"
                                  : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                              }`}
                            >
                              <CategoryIcon
                                type={cat.value}
                                size={14}
                                style={{ color: isActive ? "var(--void)" : CATEGORY_CONFIG[cat.value as CategoryType]?.color }}
                                glow={isActive ? "none" : "subtle"}
                              />
                              {cat.label}
                              {isActive && (
                                <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })}

                        {/* Separator between groups (except after last group) */}
                        {groupIdx < Object.keys(CATEGORY_GROUPS).length - 1 && (
                          <div className="h-px bg-[var(--twilight)] my-1" />
                        )}
                      </div>
                    ))}

                    {/* Other section for ungrouped categories */}
                    {UNGROUPED_CATEGORIES.length > 0 && (
                      <div>
                        <div className="h-px bg-[var(--twilight)] my-1" />
                        <div className="px-3 py-1.5 text-[0.6rem] font-mono uppercase tracking-wider text-[var(--muted)]">
                          Other
                        </div>
                        {UNGROUPED_CATEGORIES.map((cat) => {
                          const isActive = currentCategories.includes(cat.value);
                          return (
                            <button
                              key={cat.value}
                              onClick={() => toggleCategory(cat.value)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-colors ${
                                isActive
                                  ? "bg-[var(--coral)] text-[var(--void)]"
                                  : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                              }`}
                            >
                              <CategoryIcon
                                type={cat.value}
                                size={14}
                                style={{ color: isActive ? "var(--void)" : CATEGORY_CONFIG[cat.value as CategoryType]?.color }}
                                glow={isActive ? "none" : "subtle"}
                              />
                              {cat.label}
                              {isActive && (
                                <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* When dropdown */}
            <div className="relative" ref={dateDropdownRef}>
              <button
                onClick={() => {
                  setDateDropdownOpen(!dateDropdownOpen);
                  setCategoryDropdownOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                  currentDateFilter
                    ? "bg-[var(--gold)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                {dateFilterLabel}
                <svg className={`w-3 h-3 transition-transform ${dateDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Date dropdown menu */}
              {dateDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-40 rounded-lg border border-[var(--twilight)] shadow-xl z-50" style={{ backgroundColor: "var(--void)" }}>
                  <div className="p-2">
                    {SIMPLE_DATE_FILTERS.map((df) => {
                      const isActive = currentDateFilter === df.value;
                      return (
                        <button
                          key={df.value}
                          onClick={() => setDateFilter(df.value)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-[var(--gold)] text-[var(--void)]"
                              : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                          }`}
                        >
                          {df.label}
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

            {/* Following toggle - only for logged in users */}
            {user && (
              <button
                onClick={() => toggleFeedMode(currentFeedMode === "following" ? "all" : "following")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                  currentFeedMode === "following"
                    ? "bg-[var(--neon-cyan)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Following
              </button>
            )}

            {/* Free only toggle */}
            <button
              onClick={toggleFreeOnly}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                currentFreeOnly
                  ? "bg-[var(--neon-green)] text-[var(--void)]"
                  : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                currentFreeOnly
                  ? "border-[var(--void)] bg-[var(--void)]"
                  : "border-current"
              }`}>
                {currentFreeOnly && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)]" />
                )}
              </span>
              Free only
            </button>

            {/* Active filter chips - desktop only */}
            {hasFilters && (
              <div className="flex items-center gap-1.5 ml-2">
                {/* Category chips - show first 2 */}
                {currentCategories.slice(0, 2).map((cat) => {
                  const category = CATEGORIES.find((c) => c.value === cat);
                  return (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--coral)]/20 text-[var(--coral)] text-xs font-mono"
                    >
                      {category?.label || cat}
                      <button
                        onClick={() => toggleCategory(cat)}
                        className="hover:bg-[var(--coral)]/30 rounded-full p-0.5 transition-colors"
                        aria-label={`Remove ${category?.label || cat} filter`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  );
                })}
                {/* "+N more" indicator if many category filters */}
                {currentCategories.length > 2 && (
                  <span className="text-xs text-[var(--muted)] font-mono">
                    +{currentCategories.length - 2}
                  </span>
                )}
                {/* Date chip */}
                {currentDateFilter && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--gold)]/20 text-[var(--gold)] text-xs font-mono">
                    {dateFilterLabel}
                    <button
                      onClick={() => setDateFilter(currentDateFilter)}
                      className="hover:bg-[var(--gold)]/30 rounded-full p-0.5 transition-colors"
                      aria-label={`Remove ${dateFilterLabel} filter`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {/* Free only chip */}
                {currentFreeOnly && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] text-xs font-mono">
                    Free
                    <button
                      onClick={toggleFreeOnly}
                      className="hover:bg-[var(--neon-green)]/30 rounded-full p-0.5 transition-colors"
                      aria-label="Remove free only filter"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {/* Following chip */}
                {currentFeedMode === "following" && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] text-xs font-mono">
                    Following
                    <button
                      onClick={() => toggleFeedMode("all")}
                      className="hover:bg-[var(--neon-cyan)]/30 rounded-full p-0.5 transition-colors"
                      aria-label="Remove following filter"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Clear filters (only show when filters active) */}
            {hasFilters && (
              <button
                onClick={clearAll}
                className="px-2 py-1 font-mono text-[0.65rem] text-[var(--coral)] hover:text-[var(--rose)] whitespace-nowrap"
              >
                Clear
              </button>
            )}

            {/* List/Calendar/Map view toggle */}
            <div className="flex rounded-full bg-[var(--twilight)] p-0.5">
              <button
                onClick={() => setViewMode("events")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all ${
                  currentView === "events" || currentView === "list"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
                aria-label="List view"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all ${
                  currentView === "calendar"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
                aria-label="Calendar view"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Cal</span>
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all ${
                  currentView === "map"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
                aria-label="Map view"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className="hidden sm:inline">Map</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile view (< 640px) - Horizontal scrolling pills */}
      <div className="sm:hidden sticky top-[112px] z-10 bg-[var(--night)] border-b border-[var(--twilight)]">
        <div className={`${variant === "compact" ? "py-1.5" : "py-2"}`}>
          {/* Horizontal scrolling filter pills with fade indicators */}
          <div className="relative">
            {/* Left fade indicator */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--night)] to-transparent pointer-events-none z-10 transition-opacity duration-300 ${
                showLeftFade ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Scrollable pills container */}
            <div
              ref={scrollContainerRef}
              className="flex items-center gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide scroll-smooth"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
                scrollSnapType: "x proximity",
              }}
            >
              {/* Weekend pill */}
              <button
                onClick={() => setDateFilter("weekend")}
                className={`flex-shrink-0 min-h-[44px] flex items-center gap-1.5 px-4 py-2.5 rounded-full font-mono text-xs font-medium transition-all ${
                  currentDateFilter === "weekend"
                    ? "bg-[var(--gold)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--cream)]"
                }`}
                style={{ scrollSnapAlign: "start" }}
              >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              This Weekend
            </button>

              {/* Free only pill */}
              <button
                onClick={toggleFreeOnly}
                className={`flex-shrink-0 min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-full font-mono text-xs font-medium transition-all ${
                  currentFreeOnly
                    ? "bg-[var(--neon-green)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--cream)]"
                }`}
                style={{ scrollSnapAlign: "start" }}
              >
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                currentFreeOnly
                  ? "border-[var(--void)] bg-[var(--void)]"
                  : "border-current"
              }`}>
                {currentFreeOnly && (
                  <span className="w-2 h-2 rounded-full bg-[var(--neon-green)]" />
                )}
              </span>
              Free
            </button>

            {/* Quick category pills - show first selected or most popular */}
            {currentCategories.length > 0 ? (
              currentCategories.slice(0, 2).map((catValue) => {
                const cat = CATEGORIES.find(c => c.value === catValue);
                if (!cat) return null;
                return (
                  <button
                    key={catValue}
                    onClick={() => toggleCategory(catValue)}
                    className="flex-shrink-0 min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-full font-mono text-xs font-medium bg-[var(--coral)] text-[var(--void)] transition-all"
                    style={{ scrollSnapAlign: "start" }}
                  >
                    <CategoryIcon
                      type={catValue}
                      size={14}
                      glow="none"
                      style={{ color: "var(--void)" }}
                    />
                    {cat.label}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                );
              })
            ) : (
              <>
                <button
                  onClick={() => toggleCategory("music")}
                  className="flex-shrink-0 min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-full font-mono text-xs font-medium bg-[var(--twilight)] text-[var(--cream)] transition-all"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <CategoryIcon type="music" size={14} glow="none" />
                  Music
                </button>
                <button
                  onClick={() => toggleCategory("food_drink")}
                  className="flex-shrink-0 min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-full font-mono text-xs font-medium bg-[var(--twilight)] text-[var(--cream)] transition-all"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <CategoryIcon type="food_drink" size={14} glow="none" />
                  Food
                </button>
              </>
            )}

              {/* More button - opens bottom sheet */}
              <button
                onClick={() => setMobileSheetOpen(true)}
                className="flex-shrink-0 min-h-[44px] flex items-center gap-1.5 px-4 py-2.5 rounded-full font-mono text-xs font-medium bg-[var(--twilight)] text-[var(--cream)] border border-[var(--twilight)] transition-all"
                style={{ scrollSnapAlign: "start" }}
              >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              More
              {hasFilters && (
                <span className="ml-1.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--coral)] text-[var(--void)] text-[0.6rem] font-bold animate-pulse">
                  {currentCategories.length + (currentDateFilter ? 1 : 0) + (currentFreeOnly ? 1 : 0)}
                </span>
              )}
            </button>

              {/* Spacer for scroll padding */}
              <div className="flex-shrink-0 w-1" />
            </div>

            {/* Right fade indicator */}
            <div
              className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--night)] to-transparent pointer-events-none z-10 transition-opacity duration-300 ${
                showRightFade ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>

          {/* View toggle at the bottom on mobile */}
          <div className="flex items-center justify-center gap-1 mt-2 px-4">
            <div className="flex rounded-full bg-[var(--twilight)] p-0.5">
              <button
                onClick={() => setViewMode("events")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                  currentView === "events" || currentView === "list"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)]"
                }`}
                aria-label="List view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                  currentView === "calendar"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)]"
                }`}
                aria-label="Calendar view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Cal
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                  currentView === "map"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)]"
                }`}
                aria-label="Map view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Map
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile filter bottom sheet */}
      <MobileFilterSheet
        isOpen={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        currentCategories={currentCategories}
        currentDateFilter={currentDateFilter}
        currentFreeOnly={currentFreeOnly}
        onToggleCategory={toggleCategory}
        onSetDateFilter={(date) => {
          setDateFilter(date);
        }}
        onToggleFreeOnly={toggleFreeOnly}
        onClearAll={clearAll}
      />
    </>
  );
}
