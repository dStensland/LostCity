"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import CategoryIcon, { CATEGORY_CONFIG } from "./CategoryIcon";
import { CATEGORIES } from "@/lib/search-constants";
import { usePortal } from "@/lib/portal-context";

type DateFilter = "today" | "week" | "month";

// Map subcategory keys to display labels and parent categories
// This handles the various formats in the database
function parseSubcategory(key: string): { parent: string; label: string } | null {
  // Format: "category.subcategory" (e.g., "nightlife.dj", "comedy.standup")
  if (key.includes(".")) {
    const [parent, ...rest] = key.split(".");
    const subKey = rest.join(".");
    return { parent, label: formatLabel(subKey) };
  }

  // Known mappings for non-dotted subcategories
  const parentMappings: Record<string, string> = {
    // Music subcategories
    live_music: "music", concert: "music", rock: "music", jazz: "music",
    pop: "music", hiphop: "music", indie: "music", acoustic: "music",
    electronic: "music", classical: "music", country: "music", metal: "music",
    punk: "music", alternative: "music", rnb: "music", live: "music",
    open_mic: "music",
    // Comedy
    standup: "comedy", improv: "comedy",
    // Film
    cinema: "film", screening: "film", "special-screening": "film",
    // Theater
    play: "theater", ballet: "theater", broadway: "theater", performance: "theater",
    // Nightlife
    club: "nightlife", karaoke: "nightlife", drag: "nightlife",
    // Sports
    baseball: "sports", softball: "sports", mens_basketball: "sports",
    womens_basketball: "sports", cycling: "sports", running: "sports",
    // Community
    volunteer: "community", lgbtq: "community", activism: "community", social: "community",
    // Food & Drink
    dining: "food_drink", farmers_market: "food_drink",
    // Words
    literary: "words", book_club: "words", storytime: "words", podcast: "words",
    // Art
    gallery: "art", museum: "art", exhibition: "art",
    // Learning
    education: "learning", campus: "learning", workshop: "learning",
    // Family
    kids: "family", maternity: "family",
    // Wellness
    spiritual: "wellness", nutrition: "wellness", health: "wellness",
    // Outdoors
    adventure: "outdoors", sightseeing: "outdoors", outdoor: "outdoors",
    // Gaming
    gaming: "gaming",
    // Fitness
    fitness: "fitness", dance: "fitness",
    // Other/special
    special_event: "other", convention: "other", festival: "other", reception: "other",
    experimental: "other", safety: "other", "support-group": "community",
    "health-screening": "wellness",
  };

  const parent = parentMappings[key];
  if (parent) {
    return { parent, label: formatLabel(key) };
  }

  return null;
}

function formatLabel(key: string): string {
  return key
    .replace(/[_-]/g, " ")
    .replace(/\./g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Helper to chunk array into groups of n
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

interface ActivityWithCount {
  value: string;
  label: string;
  iconType: string;
  count: number;
  type: "subcategory" | "category";
}

interface BrowseByActivityProps {
  portalSlug: string;
}

// Primary 6 categories (always visible)
const PRIMARY_CATEGORIES = ["music", "comedy", "nightlife", "art", "food_drink", "community"];

// Build full activity config from CATEGORIES
function buildActivityConfig(): Array<{
  value: string;
  label: string;
  iconType: string;
  type: "subcategory" | "category";
}> {
  return CATEGORIES.map((cat) => ({
    value: cat.value,
    label: CATEGORY_CONFIG[cat.value as keyof typeof CATEGORY_CONFIG]?.label || cat.label,
    iconType: cat.value,
    type: "category" as const,
  }));
}

const ALL_ACTIVITY_CONFIG = buildActivityConfig();

// Date filter options
const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "Next 30 Days" },
];

export default function BrowseByActivity({ portalSlug }: BrowseByActivityProps) {
  const router = useRouter();
  const { portal } = usePortal();
  const [activities, setActivities] = useState<ActivityWithCount[]>([]);
  const [subcategoryCounts, setSubcategoryCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [showMore, setShowMore] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  // Build subcategories grouped by parent category from API data
  const subcategoriesByParent = useMemo(() => {
    const grouped: Record<string, { value: string; label: string; count: number }[]> = {};

    for (const [key, count] of Object.entries(subcategoryCounts)) {
      if (count === 0) continue;

      const parsed = parseSubcategory(key);
      if (!parsed) continue;

      if (!grouped[parsed.parent]) {
        grouped[parsed.parent] = [];
      }
      grouped[parsed.parent].push({
        value: key,
        label: parsed.label,
        count: count as number,
      });
    }

    // Sort each group by count descending
    for (const parent of Object.keys(grouped)) {
      grouped[parent].sort((a, b) => b.count - a.count);
    }

    return grouped;
  }, [subcategoryCounts]);

  const fetchActivityCounts = useCallback(async (filter: DateFilter) => {
    try {
      const params = new URLSearchParams({ date_filter: filter });
      if (portal.id) params.set("portal_id", portal.id);
      const response = await fetch(`/api/activities/popular?${params}`);
      if (response.ok) {
        const data = await response.json();
        // Merge counts with our config and add colors
        const withCounts = ALL_ACTIVITY_CONFIG.map((activity) => ({
          ...activity,
          count: data.counts?.[activity.value] || 0,
        }));

        setActivities(withCounts);
        setSubcategoryCounts(data.subcategory_counts || {});
      } else {
        // Fallback: show activities without counts
        setActivities(ALL_ACTIVITY_CONFIG.map((a) => ({
          ...a,
          count: 0,
        })));
      }
    } catch {
      // Fallback: show activities without counts
      setActivities(ALL_ACTIVITY_CONFIG.map((a) => ({
        ...a,
        count: 0,
      })));
    } finally {
      setIsLoading(false);
    }
  }, [portal.id]);

  useEffect(() => {
    fetchActivityCounts(dateFilter);
  }, [dateFilter, fetchActivityCounts]);

  // Get count label based on date filter
  function getCountLabel(count: number): string {
    if (count === 0) return "";
    switch (dateFilter) {
      case "today":
        return `${count} today`;
      case "week":
        return `${count} this week`;
      case "month":
        return `${count} upcoming`;
      default:
        return `${count} this week`;
    }
  }

  // Build URL for activity
  function buildUrl(activity: ActivityWithCount, subcats?: string[]): string {
    const params = new URLSearchParams();
    params.set("view", "find");
    params.set("type", "events");

    // Apply date filter
    if (dateFilter === "today") {
      params.set("date", "today");
    } else if (dateFilter === "week") {
      params.set("date", "week");
    } else if (dateFilter === "month") {
      params.set("date", "month");
    }

    if (subcats && subcats.length > 0) {
      params.set("subcategories", subcats.join(","));
    } else if (activity.type === "subcategory") {
      params.set("subcategories", activity.value);
    } else {
      params.set("categories", activity.value);
    }

    return `/${portalSlug}?${params.toString()}`;
  }

  // Check if a category has subcategories with events
  function hasSubcategoriesWithEvents(categoryValue: string): boolean {
    const subcats = subcategoriesByParent[categoryValue];
    return subcats && subcats.length > 0;
  }

  // Handle category click - expand subcategories or navigate
  function handleCategoryClick(activity: ActivityWithCount, e: React.MouseEvent) {
    // Only expand if category has subcategories with events
    if (hasSubcategoriesWithEvents(activity.value)) {
      e.preventDefault();
      if (expandedCategory === activity.value) {
        // Clicking again closes
        setExpandedCategory(null);
        setSelectedSubcategories([]);
      } else {
        setExpandedCategory(activity.value);
        setSelectedSubcategories([]);
      }
    }
    // If no subcategories with events, let the Link navigate normally
  }

  // Toggle subcategory selection
  function toggleSubcategory(subcat: string) {
    if (subcat === "__all__") {
      setSelectedSubcategories([]);
      return;
    }
    setSelectedSubcategories((prev) => {
      if (prev.includes(subcat)) {
        return prev.filter((s) => s !== subcat);
      } else {
        return [...prev, subcat];
      }
    });
  }

  // Handle "View Events" click
  function handleViewEvents() {
    if (!expandedCategory) return;

    const activity = activities.find((a) => a.value === expandedCategory);
    if (!activity) return;

    const url = buildUrl(activity, selectedSubcategories.length > 0 ? selectedSubcategories : undefined);
    router.push(url);
  }

  // Split activities into primary and secondary - only show categories with events
  const primaryActivities = activities
    .filter((a) => PRIMARY_CATEGORIES.includes(a.value))
    .filter((a) => a.count > 0);
  const secondaryActivities = activities
    .filter((a) => !PRIMARY_CATEGORIES.includes(a.value))
    .filter((a) => a.count > 0);

  return (
    <section>
      {/* Section header with improved visual hierarchy */}
      <div className="mb-3">
        <h2 className="text-base font-display font-semibold text-[var(--cream)] mb-1 tracking-tight">
          What are you in the mood for?
        </h2>
        <p className="font-mono text-[0.7rem] text-[var(--muted)]">
          Browse events by category and vibe
        </p>
      </div>

      {/* Date Filter Toggle */}
      <div className="flex gap-2 mb-3">
        {DATE_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              setDateFilter(option.value);
              setIsLoading(true);
            }}
            className={`
              px-2.5 py-1 rounded-full text-[0.7rem] font-mono font-medium transition-all duration-150
              ${dateFilter === option.value
                ? "bg-[var(--coral)] text-[var(--void)] shadow-[0_0_8px_var(--coral)/25]"
                : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/80"
              }
            `}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl skeleton-shimmer"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Category Grid - render in rows with expand panel after each row */}
          <div className="flex flex-col gap-2">
            {chunkArray(primaryActivities, 2).map((row, rowIndex) => {
              const expandedInRow = row.find(a => a.value === expandedCategory);
              return (
                <div key={rowIndex}>
                  <div className="grid grid-cols-2 gap-2">
                    {row.map((activity) => (
                      <CategoryCard
                        key={activity.value}
                        activity={activity}
                        countLabel={getCountLabel(activity.count)}
                        buildUrl={() => buildUrl(activity)}
                        onClick={(e) => handleCategoryClick(activity, e)}
                        isExpanded={expandedCategory === activity.value}
                        hasSubcategories={hasSubcategoriesWithEvents(activity.value)}
                      />
                    ))}
                  </div>
                  {/* Expanded panel appears directly below this row */}
                  {expandedInRow && (
                    <ExpandedCategoryPanel
                      activity={expandedInRow}
                      countLabel={getCountLabel(expandedInRow.count)}
                      subcategories={subcategoriesByParent[expandedCategory!] || []}
                      selectedSubcategories={selectedSubcategories}
                      onToggleSubcategory={toggleSubcategory}
                      onViewEvents={handleViewEvents}
                      onClose={() => {
                        setExpandedCategory(null);
                        setSelectedSubcategories([]);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Show More / Show Fewer Button */}
          {secondaryActivities.length > 0 && (
            <button
              onClick={() => setShowMore(!showMore)}
              className="w-full mt-3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[var(--twilight)]/60 to-[var(--twilight)]/40 border border-[var(--twilight)]
                text-[var(--cream)] hover:text-[var(--cream)] hover:bg-gradient-to-r hover:from-[var(--twilight)]/80 hover:to-[var(--twilight)]/60 hover:border-[var(--coral)]/40
                transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold shadow-lg hover:shadow-[var(--coral)]/10 group"
            >
              {showMore ? (
                <>
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                  Show fewer categories
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Show {secondaryActivities.length} more categories
                  <svg className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          )}

          {/* Secondary Categories (expanded) */}
          {showMore && (
            <div className="flex flex-col gap-2 mt-2 animate-in slide-in-from-top-2 duration-200">
              {chunkArray(secondaryActivities, 2).map((row, rowIndex) => {
                const expandedInRow = row.find(a => a.value === expandedCategory);
                return (
                  <div key={rowIndex}>
                    <div className="grid grid-cols-2 gap-2">
                      {row.map((activity) => (
                        <CategoryCard
                          key={activity.value}
                          activity={activity}
                          countLabel={getCountLabel(activity.count)}
                          buildUrl={() => buildUrl(activity)}
                          onClick={(e) => handleCategoryClick(activity, e)}
                          isExpanded={expandedCategory === activity.value}
                          hasSubcategories={hasSubcategoriesWithEvents(activity.value)}
                        />
                      ))}
                    </div>
                    {/* Expanded panel appears directly below this row */}
                    {expandedInRow && (
                      <ExpandedCategoryPanel
                        activity={expandedInRow}
                        countLabel={getCountLabel(expandedInRow.count)}
                        subcategories={subcategoriesByParent[expandedCategory!] || []}
                        selectedSubcategories={selectedSubcategories}
                        onToggleSubcategory={toggleSubcategory}
                        onViewEvents={handleViewEvents}
                        onClose={() => {
                          setExpandedCategory(null);
                          setSelectedSubcategories([]);
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Extracted card component for reuse
interface CategoryCardProps {
  activity: ActivityWithCount;
  countLabel: string;
  buildUrl: () => string;
  onClick: (e: React.MouseEvent) => void;
  isExpanded: boolean;
  hasSubcategories: boolean;
}

function CategoryCard({
  activity,
  countLabel,
  buildUrl,
  onClick,
  isExpanded,
  hasSubcategories,
}: CategoryCardProps) {
  return (
    <Link
      href={buildUrl()}
      onClick={onClick}
      className={`group relative flex items-center gap-3 p-3 rounded-xl bg-[var(--card-bg)] border hover:border-opacity-60 hover:bg-[var(--twilight)]/30 transition-all duration-200 overflow-hidden activity-card ${
        isExpanded ? "ring-2 ring-[var(--category-color)] ring-offset-1 ring-offset-[var(--void)]" : ""
      }`}
      data-category={activity.iconType}
      data-expanded={isExpanded ? "true" : "false"}
    >
      {/* Subtle glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 activity-card-glow"
      />

      {/* Icon with glow */}
      <div
        className="relative z-10 w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg transition-all duration-200 group-hover:scale-110 activity-card-icon"
      >
        <CategoryIcon
          type={activity.iconType}
          size={18}
          glow="subtle"
          className="text-[var(--category-color)]"
        />
      </div>

      {/* Label and count */}
      <div className="relative z-10 flex-1 min-w-0">
        <h3 className="font-medium text-sm text-[var(--cream)] transition-colors group-hover:text-[var(--category-color)] truncate">
          {activity.label}
        </h3>
        {countLabel && (
          <p className="text-xs text-[var(--muted)] font-mono truncate">
            {countLabel}
          </p>
        )}
      </div>

      {/* Indicator: chevron-up when expanded, chevron-down for subcategories, arrow for direct nav */}
      <span className="relative z-10 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-all text-[var(--category-color)]">
        {isExpanded ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : hasSubcategories ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </span>
    </Link>
  );
}

// Expanded panel that appears below the grid
interface ExpandedCategoryPanelProps {
  activity: ActivityWithCount;
  countLabel: string;
  subcategories: { value: string; label: string; count: number }[];
  selectedSubcategories: string[];
  onToggleSubcategory: (value: string) => void;
  onViewEvents: () => void;
  onClose: () => void;
}

function ExpandedCategoryPanel({
  activity,
  countLabel,
  subcategories,
  selectedSubcategories,
  onToggleSubcategory,
  onViewEvents,
  onClose,
}: ExpandedCategoryPanelProps) {
  return (
    <div
      className="mt-2 p-3 rounded-xl bg-[var(--card-bg)] border transition-all duration-300 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 activity-panel"
      data-category={activity.iconType}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg activity-panel-icon"
        >
          <CategoryIcon
            type={activity.iconType}
            size={18}
            glow="subtle"
            className="text-[var(--category-color)]"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-[var(--category-color)]">
            {activity.label}
          </h3>
          {countLabel && (
            <p className="text-xs text-[var(--muted)] font-mono">{countLabel}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors rounded-lg hover:bg-[var(--twilight)]"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Subcategory chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {/* All option */}
        <button
          onClick={() => onToggleSubcategory("__all__")}
          className={`
            px-2.5 py-1 rounded-full text-xs font-mono font-medium transition-all duration-150
            ${selectedSubcategories.length === 0
              ? "bg-[var(--cream)] text-[var(--void)]"
              : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
            }
          `}
        >
          All ({activity.count})
        </button>
        {subcategories.map((subcat) => {
          const isSelected = selectedSubcategories.includes(subcat.value);
          return (
            <button
              key={subcat.value}
              onClick={() => onToggleSubcategory(subcat.value)}
              className={`
                px-2.5 py-1 rounded-full text-xs font-mono font-medium transition-all duration-150
                ${isSelected
                  ? "bg-[var(--category-color)] text-[var(--void)]"
                  : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                }
              `}
            >
              {subcat.label} ({subcat.count})
            </button>
          );
        })}
      </div>

      {/* View Events button */}
      <button
        onClick={onViewEvents}
        className="w-full py-2 rounded-lg font-medium text-sm transition-all duration-150 hover:brightness-110 bg-[var(--category-color)] text-[var(--void)]"
      >
        View Events
      </button>
    </div>
  );
}
