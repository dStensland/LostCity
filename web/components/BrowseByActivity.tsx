"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import CategoryIcon, { getCategoryColor, CATEGORY_CONFIG } from "./CategoryIcon";
import { CATEGORIES, SUBCATEGORIES } from "@/lib/search";

type DateFilter = "today" | "week" | "month";

interface ActivityWithCount {
  value: string;
  label: string;
  iconType: string;
  count: number;
  type: "subcategory" | "category";
  color: string;
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
  { value: "month", label: "This Month" },
];

export default function BrowseByActivity({ portalSlug }: BrowseByActivityProps) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityWithCount[]>([]);
  const [subcategoryCounts, setSubcategoryCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [showMore, setShowMore] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  const fetchActivityCounts = useCallback(async (filter: DateFilter) => {
    try {
      const response = await fetch(`/api/activities/popular?date_filter=${filter}`);
      if (response.ok) {
        const data = await response.json();
        // Merge counts with our config and add colors
        const withCounts = ALL_ACTIVITY_CONFIG.map((activity) => ({
          ...activity,
          count: data.counts?.[activity.value] || 0,
          color: getCategoryColor(activity.iconType) || "#F97068",
        }));

        setActivities(withCounts);
        setSubcategoryCounts(data.subcategory_counts || {});
      } else {
        // Fallback: show activities without counts
        setActivities(ALL_ACTIVITY_CONFIG.map((a) => ({
          ...a,
          count: 0,
          color: getCategoryColor(a.iconType) || "#F97068",
        })));
      }
    } catch {
      // Fallback: show activities without counts
      setActivities(ALL_ACTIVITY_CONFIG.map((a) => ({
        ...a,
        count: 0,
        color: getCategoryColor(a.iconType) || "#F97068",
      })));
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        return `${count} this month`;
      default:
        return `${count} this week`;
    }
  }

  // Build URL for activity
  function buildUrl(activity: ActivityWithCount, subcats?: string[]): string {
    const params = new URLSearchParams();
    params.set("view", "find");
    params.set("type", "events");

    if (subcats && subcats.length > 0) {
      params.set("subcategories", subcats.join(","));
    } else if (activity.type === "subcategory") {
      params.set("subcategories", activity.value);
    } else {
      params.set("categories", activity.value);
    }

    return `/${portalSlug}?${params.toString()}`;
  }

  // Handle category click - expand subcategories or navigate
  function handleCategoryClick(activity: ActivityWithCount, e: React.MouseEvent) {
    const subcats = SUBCATEGORIES[activity.value];

    // If category has subcategories, expand instead of navigating
    if (subcats && subcats.length > 0) {
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
    // If no subcategories, let the Link navigate normally
  }

  // Toggle subcategory selection
  function toggleSubcategory(subcat: string) {
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

  // Split activities into primary and secondary
  const primaryActivities = activities.filter((a) => PRIMARY_CATEGORIES.includes(a.value));
  const secondaryActivities = activities.filter((a) => !PRIMARY_CATEGORIES.includes(a.value));

  // Get subcategories for expanded category
  const expandedSubcategories = expandedCategory ? SUBCATEGORIES[expandedCategory] || [] : [];
  const expandedActivity = expandedCategory ? activities.find((a) => a.value === expandedCategory) : null;

  return (
    <section className="py-6">
      <h2 className="text-lg font-display font-medium text-[var(--cream)] mb-4">
        What are you in the mood for?
      </h2>

      {/* Date Filter Toggle */}
      <div className="flex gap-2 mb-4">
        {DATE_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              setDateFilter(option.value);
              setIsLoading(true);
            }}
            className={`
              px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-150
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl skeleton-shimmer"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Category Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {primaryActivities.map((activity) => (
              <CategoryCard
                key={activity.value}
                activity={activity}
                countLabel={getCountLabel(activity.count)}
                buildUrl={() => buildUrl(activity)}
                onClick={(e) => handleCategoryClick(activity, e)}
                isExpanded={expandedCategory === activity.value}
              />
            ))}
          </div>

          {/* Expanded Subcategory Panel */}
          {expandedCategory && expandedActivity && (
            <div
              className="mt-3 p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--twilight)] animate-in slide-in-from-top-2 duration-200"
              style={{
                borderColor: `color-mix(in srgb, ${expandedActivity.color} 30%, transparent)`,
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CategoryIcon
                    type={expandedActivity.iconType}
                    size={20}
                    glow="subtle"
                    style={{ color: expandedActivity.color }}
                  />
                  <span className="font-medium text-[var(--cream)]">{expandedActivity.label}</span>
                </div>
                <button
                  onClick={() => {
                    setExpandedCategory(null);
                    setSelectedSubcategories([]);
                  }}
                  className="p-1 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                  aria-label="Close subcategory panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Subcategory Chips */}
              <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
                {/* All option */}
                <button
                  onClick={() => setSelectedSubcategories([])}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-150 whitespace-nowrap
                    ${selectedSubcategories.length === 0
                      ? "bg-[var(--cream)] text-[var(--void)]"
                      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                    }
                  `}
                >
                  All
                </button>
                {expandedSubcategories.map((subcat) => {
                  const isSelected = selectedSubcategories.includes(subcat.value);
                  const count = subcategoryCounts[subcat.value] || 0;
                  return (
                    <button
                      key={subcat.value}
                      onClick={() => toggleSubcategory(subcat.value)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-150 whitespace-nowrap
                        ${isSelected
                          ? "text-[var(--void)] shadow-[0_0_8px_var(--coral)/25]"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                        }
                      `}
                      style={isSelected ? { backgroundColor: expandedActivity.color } : {}}
                    >
                      {subcat.label}
                      {count > 0 && (
                        <span className="ml-1.5 opacity-70">({count})</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* View Events Button */}
              <button
                onClick={handleViewEvents}
                className="w-full py-2.5 rounded-lg font-medium text-sm transition-all duration-150 hover:brightness-110"
                style={{
                  backgroundColor: expandedActivity.color,
                  color: "var(--void)",
                }}
              >
                View Events
              </button>
            </div>
          )}

          {/* Show More / Show Fewer Button */}
          {secondaryActivities.length > 0 && (
            <button
              onClick={() => setShowMore(!showMore)}
              className="w-full mt-3 py-2.5 px-4 rounded-xl bg-[var(--twilight)]/50 border border-[var(--twilight)]
                text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]
                transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium"
            >
              {showMore ? (
                <>
                  Show fewer
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  Show {secondaryActivities.length} more categories
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          )}

          {/* Secondary Categories (expanded) */}
          {showMore && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 animate-in slide-in-from-top-2 duration-200">
              {secondaryActivities.map((activity) => (
                <CategoryCard
                  key={activity.value}
                  activity={activity}
                  countLabel={getCountLabel(activity.count)}
                  buildUrl={() => buildUrl(activity)}
                  onClick={(e) => handleCategoryClick(activity, e)}
                  isExpanded={expandedCategory === activity.value}
                />
              ))}
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
}

function CategoryCard({ activity, countLabel, buildUrl, onClick, isExpanded }: CategoryCardProps) {
  const hasSubcategories = SUBCATEGORIES[activity.value]?.length > 0;

  return (
    <Link
      href={buildUrl()}
      onClick={onClick}
      className={`
        group relative flex flex-col justify-between p-4 rounded-xl
        bg-[var(--card-bg)] border
        hover:border-opacity-60 hover:bg-[var(--twilight)]/30
        transition-all duration-200 overflow-hidden
        ${isExpanded ? "ring-2" : ""}
      `}
      style={{
        "--activity-color": activity.color,
        borderColor: isExpanded
          ? activity.color
          : `color-mix(in srgb, ${activity.color} 20%, transparent)`,
        ...(isExpanded ? { "--tw-ring-color": activity.color } as React.CSSProperties : {}),
      } as React.CSSProperties}
    >
      {/* Subtle glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at 30% 30%, color-mix(in srgb, ${activity.color} 8%, transparent), transparent 70%)`,
        }}
      />

      {/* Icon with glow */}
      <div
        className="relative z-10 w-10 h-10 flex items-center justify-center rounded-lg mb-3 transition-all duration-200 group-hover:scale-110"
        style={{
          backgroundColor: `color-mix(in srgb, ${activity.color} 15%, transparent)`,
        }}
      >
        <CategoryIcon
          type={activity.iconType}
          size={22}
          glow="subtle"
          style={{ color: activity.color }}
        />
      </div>

      {/* Label and count */}
      <div className="relative z-10">
        <h3
          className="font-medium text-[var(--cream)] transition-colors group-hover:text-[var(--activity-color)]"
          style={{ "--activity-color": activity.color } as React.CSSProperties}
        >
          {activity.label}
        </h3>
        {countLabel && (
          <p className="text-xs text-[var(--muted)] mt-0.5 font-mono">
            {countLabel}
          </p>
        )}
      </div>

      {/* Indicator: arrow for direct nav, chevron-down for subcategories */}
      <span
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: activity.color }}
      >
        {hasSubcategories ? (
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
