"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import EventCard from "../EventCard";
import type { EventWithLocation } from "@/lib/search";

const COLORS = {
  peachMain: "#FBAB7E",
  peachLight: "#FFCFA7",
  greenMain: "#059669",
  textGreen: "#4A7C59",
  warmCream: "#FFF8F0",
};

interface FamilyDiscoveryViewProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
}

// Quick filter pills for easy access
const QUICK_FILTERS = [
  { id: "weekend", label: "This Weekend", emoji: "📅", param: "date", value: "weekend" },
  { id: "today", label: "Today", emoji: "⚡", param: "date", value: "today" },
  { id: "free", label: "Free", emoji: "🆓", param: "free", value: "1" },
  { id: "indoor", label: "Indoor", emoji: "🏠", param: "tags", value: "indoor" },
  { id: "outdoor", label: "Outdoor", emoji: "🌳", param: "tags", value: "outdoor" },
] as const;

// Age range pills
const AGE_RANGES = [
  { id: "toddler", label: "Toddler (0-3)", emoji: "🍼", tag: "toddler" },
  { id: "preschool", label: "Preschool (3-5)", emoji: "🎨", tag: "preschool" },
  { id: "kids", label: "Kids (6-10)", emoji: "⚽", tag: "kids" },
  { id: "tweens", label: "Tweens (11-13)", emoji: "🎮", tag: "tweens" },
  { id: "teens", label: "Teens (14+)", emoji: "🎸", tag: "teens" },
] as const;

// Category grid for family activities
type FamilyCategory =
  | { id: string; emoji: string; label: string; subcategory: string; category?: never; tag?: never }
  | { id: string; emoji: string; label: string; category: string; subcategory?: never; tag?: never }
  | { id: string; emoji: string; label: string; tag: string; category?: never; subcategory?: never };

const FAMILY_CATEGORIES: readonly FamilyCategory[] = [
  { id: "family.museums", emoji: "🏛️", label: "Museums", subcategory: "learning.museum" },
  { id: "family.outdoor", emoji: "🌳", label: "Outdoor", category: "outdoors" },
  { id: "family.theater", emoji: "🎭", label: "Theater", category: "theater" },
  { id: "family.libraries", emoji: "📚", label: "Libraries", tag: "library" },
  { id: "family.sports", emoji: "⚽", label: "Sports", category: "sports" },
  { id: "family.festivals", emoji: "🎪", label: "Festivals", tag: "festival" },
  { id: "family.birthdays", emoji: "🎂", label: "Birthdays", tag: "birthday" },
  { id: "family.camps", emoji: "🏕️", label: "Camps", tag: "camp" },
] as const;

// Curated collections
const CURATED_COLLECTIONS = [
  {
    id: "rainy-day",
    title: "Rainy Day Rescues",
    subtitle: "Indoor activities when weather's bad",
    emoji: "☔",
    filters: { tags: "indoor", categories: "family,learning,art" }
  },
  {
    id: "free-fun",
    title: "Free Family Fun",
    subtitle: "Great activities that won't cost a thing",
    emoji: "🆓",
    filters: { free: "1" }
  },
  {
    id: "weekend-picks",
    title: "This Weekend's Picks",
    subtitle: "Handpicked events for this weekend",
    emoji: "⭐",
    filters: { date: "weekend" }
  },
] as const;

export function FamilyDiscoveryView({ portalId, portalSlug, portalExclusive }: FamilyDiscoveryViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Get current filters from URL
  const currentDate = searchParams.get("date") || "";
  const currentFree = searchParams.get("free") === "1";
  const currentTags = useMemo(
    () => searchParams.get("tags")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentCategories = useMemo(
    () => searchParams.get("categories")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentSubcategories = useMemo(
    () => searchParams.get("subcategories")?.split(",").filter(Boolean) || [],
    [searchParams]
  );

  // Helper to update URL params
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

  // Quick filter handlers
  const toggleQuickFilter = useCallback(
    (filter: typeof QUICK_FILTERS[number]) => {
      if (filter.param === "date") {
        updateParams({ date: currentDate === filter.value ? null : filter.value });
      } else if (filter.param === "free") {
        updateParams({ free: currentFree ? null : filter.value });
      } else if (filter.param === "tags") {
        const newTags = currentTags.includes(filter.value)
          ? currentTags.filter((t) => t !== filter.value)
          : [...currentTags, filter.value];
        updateParams({ tags: newTags.length > 0 ? newTags.join(",") : null });
      }
    },
    [currentDate, currentFree, currentTags, updateParams]
  );

  // Age range handler
  const toggleAgeRange = useCallback(
    (age: typeof AGE_RANGES[number]) => {
      const newTags = currentTags.includes(age.tag)
        ? currentTags.filter((t) => t !== age.tag)
        : [...currentTags, age.tag];
      updateParams({ tags: newTags.length > 0 ? newTags.join(",") : null });
    },
    [currentTags, updateParams]
  );

  // Category grid handler
  const handleCategoryClick = useCallback(
    (cat: FamilyCategory) => {
      if ("category" in cat && cat.category) {
        const newCategories = currentCategories.includes(cat.category)
          ? currentCategories.filter((c) => c !== cat.category)
          : [cat.category];
        updateParams({
          categories: newCategories.length > 0 ? newCategories.join(",") : null,
          subcategories: null,
          tags: null,
        });
      } else if ("subcategory" in cat && cat.subcategory) {
        const newSubcats = currentSubcategories.includes(cat.subcategory)
          ? currentSubcategories.filter((s) => s !== cat.subcategory)
          : [cat.subcategory];
        updateParams({
          subcategories: newSubcats.length > 0 ? newSubcats.join(",") : null,
          categories: null,
          tags: null,
        });
      } else if ("tag" in cat && cat.tag) {
        const newTags = currentTags.includes(cat.tag)
          ? currentTags.filter((t) => t !== cat.tag)
          : [cat.tag];
        updateParams({
          tags: newTags.length > 0 ? newTags.join(",") : null,
          categories: null,
          subcategories: null,
        });
      }
    },
    [currentCategories, currentSubcategories, currentTags, updateParams]
  );

  // Curated collection handler
  const handleCollectionClick = useCallback(
    (collection: typeof CURATED_COLLECTIONS[number]) => {
      const filterEntries = collection.filters;
      const updates: Record<string, string | null> = {};

      for (const [key, value] of Object.entries(filterEntries)) {
        updates[key] = value;
      }

      updateParams(updates);
    },
    [updateParams]
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    updateParams({
      date: null,
      free: null,
      tags: null,
      categories: null,
      subcategories: null,
    });
  }, [updateParams]);

  // Build API query params for events
  const buildApiParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("portal_id", portalId);
    if (portalExclusive) params.set("exclusive", "1");

    // Always include family-friendly tag as base filter for atlanta-families portal
    const baseTags = ["family-friendly", "all-ages"];
    const allTags = [...new Set([...baseTags, ...currentTags])];
    params.set("tags", allTags.join(","));

    if (currentDate) params.set("date", currentDate);
    if (currentFree) params.set("free", "1");
    if (currentCategories.length > 0) params.set("categories", currentCategories.join(","));
    if (currentSubcategories.length > 0) params.set("subcategories", currentSubcategories.join(","));

    return params;
  }, [portalId, portalExclusive, currentDate, currentFree, currentTags, currentCategories, currentSubcategories]);

  // Fetch events with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["family-events", buildApiParams().toString()],
    queryFn: async ({ pageParam = null }) => {
      const params = buildApiParams();
      if (pageParam) params.set("cursor", pageParam);

      const res = await fetch(`/api/events?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialPageParam: null,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const allEvents = useMemo(
    () => data?.pages.flatMap((page) => page.events || []) || [],
    [data]
  );

  // Group events by day
  const eventsByDay = useMemo(() => {
    const groups: Record<string, EventWithLocation[]> = {};
    for (const event of allEvents) {
      const date = event.start_date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
    }
    return groups;
  }, [allEvents]);

  const hasActiveFilters = !!(currentDate || currentFree || currentTags.length > 0 || currentCategories.length > 0 || currentSubcategories.length > 0);

  // Check if a quick filter is active
  const isQuickFilterActive = (filter: typeof QUICK_FILTERS[number]) => {
    if (filter.param === "date") return currentDate === filter.value;
    if (filter.param === "free") return currentFree;
    if (filter.param === "tags") return currentTags.includes(filter.value);
    return false;
  };

  // Check if age range is active
  const isAgeRangeActive = (age: typeof AGE_RANGES[number]) => {
    return currentTags.includes(age.tag);
  };

  // Check if category is active
  const isCategoryActive = (cat: FamilyCategory) => {
    if ("category" in cat && cat.category) return currentCategories.includes(cat.category);
    if ("subcategory" in cat && cat.subcategory) return currentSubcategories.includes(cat.subcategory);
    if ("tag" in cat && cat.tag) return currentTags.includes(cat.tag);
    return false;
  };

  return (
    <div className="py-4 space-y-6" style={{ backgroundColor: COLORS.warmCream }}>
      {/* Quick Filters - Horizontal scrolling pills */}
      <div>
        <h2 className="text-sm font-bold mb-3 px-4" style={{ color: COLORS.textGreen, fontFamily: "var(--font-nunito), system-ui, sans-serif" }}>
          Quick Filters
        </h2>
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
          {QUICK_FILTERS.map((filter) => {
            const isActive = isQuickFilterActive(filter);
            return (
              <button
                key={filter.id}
                onClick={() => toggleQuickFilter(filter)}
                className="flex-shrink-0 min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm transition-all shadow-sm"
                style={{
                  fontFamily: "var(--font-nunito), system-ui, sans-serif",
                  backgroundColor: isActive ? COLORS.greenMain : "white",
                  color: isActive ? "white" : COLORS.textGreen,
                  border: `2px solid ${isActive ? COLORS.greenMain : "#E8D5C4"}`,
                }}
              >
                <span className="text-lg">{filter.emoji}</span>
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Age Range Pills */}
      <div>
        <h2 className="text-sm font-bold mb-3 px-4" style={{ color: COLORS.textGreen, fontFamily: "var(--font-nunito), system-ui, sans-serif" }}>
          Age Range
        </h2>
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
          {AGE_RANGES.map((age) => {
            const isActive = isAgeRangeActive(age);
            return (
              <button
                key={age.id}
                onClick={() => toggleAgeRange(age)}
                className="flex-shrink-0 min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm transition-all shadow-sm whitespace-nowrap"
                style={{
                  fontFamily: "var(--font-nunito), system-ui, sans-serif",
                  backgroundColor: isActive ? COLORS.peachMain : "white",
                  color: isActive ? "white" : COLORS.textGreen,
                  border: `2px solid ${isActive ? COLORS.peachMain : "#E8D5C4"}`,
                }}
              >
                <span className="text-lg">{age.emoji}</span>
                {age.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Grid */}
      <div>
        <h2 className="text-sm font-bold mb-3 px-4" style={{ color: COLORS.textGreen, fontFamily: "var(--font-nunito), system-ui, sans-serif" }}>
          Activities
        </h2>
        <div className="grid grid-cols-2 gap-3 px-4">
          {FAMILY_CATEGORIES.map((cat) => {
            const isActive = isCategoryActive(cat);
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className="min-h-[80px] flex flex-col items-center justify-center gap-2 p-4 rounded-xl font-bold text-sm transition-all shadow-sm"
                style={{
                  fontFamily: "var(--font-nunito), system-ui, sans-serif",
                  backgroundColor: isActive ? COLORS.peachMain : "white",
                  color: isActive ? "white" : COLORS.textGreen,
                  border: `2px solid ${isActive ? COLORS.peachMain : "#E8D5C4"}`,
                }}
              >
                <span className="text-3xl">{cat.emoji}</span>
                <span className="text-center leading-tight">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Curated Collections */}
      <div>
        <h2 className="text-sm font-bold mb-3 px-4" style={{ color: COLORS.textGreen, fontFamily: "var(--font-nunito), system-ui, sans-serif" }}>
          Curated for You
        </h2>
        <div className="space-y-2 px-4">
          {CURATED_COLLECTIONS.map((collection) => (
            <button
              key={collection.id}
              onClick={() => handleCollectionClick(collection)}
              className="w-full flex items-center gap-3 p-4 rounded-xl transition-all shadow-sm text-left"
              style={{
                backgroundColor: "white",
                border: "2px solid #E8D5C4",
              }}
            >
              <span className="text-3xl flex-shrink-0">{collection.emoji}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm leading-tight" style={{ color: COLORS.textGreen, fontFamily: "var(--font-nunito), system-ui, sans-serif" }}>
                  {collection.title}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "#8B7355", fontFamily: "var(--font-nunito), system-ui, sans-serif" }}>
                  {collection.subtitle}
                </p>
              </div>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke={COLORS.textGreen} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <div className="px-4">
          <button
            onClick={clearAllFilters}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
            style={{
              fontFamily: "var(--font-nunito), system-ui, sans-serif",
              backgroundColor: "white",
              color: COLORS.peachMain,
              border: `2px solid ${COLORS.peachMain}`,
            }}
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Events List - Grouped by day */}
      <div className="px-4 space-y-4">
        <h2 className="text-sm font-bold" style={{ color: COLORS.textGreen, fontFamily: "var(--font-nunito), system-ui, sans-serif" }}>
          {hasActiveFilters ? "Filtered Events" : "All Family Events"}
        </h2>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 rounded-xl" style={{ backgroundColor: "#F5EDE3" }} />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: "#8B7355" }}>
              Failed to load events. Please try again.
            </p>
          </div>
        )}

        {!isLoading && !isError && allEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg font-semibold mb-2" style={{ color: COLORS.textGreen, fontFamily: "var(--font-nunito), system-ui, sans-serif" }}>
              No events found
            </p>
            <p className="text-sm mb-4" style={{ color: "#8B7355" }}>
              Try adjusting your filters to see more results
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="px-6 py-2 rounded-full font-semibold text-sm"
                style={{
                  fontFamily: "var(--font-nunito), system-ui, sans-serif",
                  backgroundColor: COLORS.peachMain,
                  color: "white",
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && allEvents.length > 0 && (
          <div className="space-y-6">
            {Object.entries(eventsByDay).map(([date, events]) => {
              const eventDate = new Date(date);
              const dateLabel = new Intl.DateTimeFormat("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(eventDate);

              return (
                <div key={date}>
                  {/* Day header */}
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-base font-bold" style={{ color: COLORS.textGreen, fontFamily: "var(--font-nunito), system-ui, sans-serif" }}>
                      {dateLabel}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: COLORS.peachLight, color: COLORS.textGreen }}>
                      {events.length}
                    </span>
                  </div>

                  {/* Events for this day */}
                  <div className="space-y-3">
                    {events.map((event, idx) => (
                      <div
                        key={event.id}
                        className="rounded-xl overflow-hidden shadow-sm"
                        style={{ backgroundColor: "white", border: "1px solid #E8D5C4" }}
                      >
                        <EventCard
                          event={event}
                          index={idx}
                          portalSlug={portalSlug}
                          showThumbnail
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Load more button */}
            {hasNextPage && (
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{
                  fontFamily: "var(--font-nunito), system-ui, sans-serif",
                  backgroundColor: COLORS.greenMain,
                  color: "white",
                  opacity: isFetchingNextPage ? 0.6 : 1,
                }}
              >
                {isFetchingNextPage ? "Loading..." : "Load More Events"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
