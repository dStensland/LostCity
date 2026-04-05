"use client";

import { useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import FilterChip, { getTagVariant, type FilterChipVariant } from "./FilterChip";
import { CATEGORIES, TAG_GROUPS, PRICE_FILTERS } from "@/lib/search-constants";
import { VIBE_GROUPS } from "@/lib/spots-constants";
import { formatGenre } from "@/lib/series-utils";
import { useReplaceStateParams } from "@/lib/hooks/useReplaceStateParams";

// Date filter display labels
const DATE_LABELS: Record<string, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "Weekend",
  week: "This Week",
};

interface ActiveFilter {
  type: "search" | "category" | "tag" | "genre" | "date" | "free" | "price" | "vibe" | "neighborhood";
  value: string;
  label: string;
  variant: FilterChipVariant; // "search" chips use --action-primary token
}

interface ActiveFiltersRowProps {
  className?: string;
}

export default function ActiveFiltersRow({ className = "" }: ActiveFiltersRowProps) {
  const pathname = usePathname();
  const searchParams = useReplaceStateParams();
  const effectiveParams = searchParams;

  const vibeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of Object.values(VIBE_GROUPS)) {
      for (const vibe of group) {
        map.set(vibe.value, vibe.label);
      }
    }
    return map;
  }, []);

  // Build list of all active filters
  const activeFilters = useMemo(() => {
    const filters: ActiveFilter[] = [];
    const shortSearchLabel = (value: string) => {
      const normalized = value.trim();
      if (!normalized) return null;
      return normalized.length > 28
        ? `Search: "${normalized.slice(0, 28)}..."`
        : `Search: "${normalized}"`;
    };

    const searchParam = effectiveParams.get("search");
    const searchLabel = searchParam ? shortSearchLabel(searchParam) : null;
    if (searchLabel) {
      filters.push({
        type: "search",
        value: searchParam!,
        label: searchLabel,
        variant: "search",
      });
    }

    // Categories
    const categoriesParam = effectiveParams.get("categories");
    if (categoriesParam) {
      const categoryValues = categoriesParam.split(",").filter(Boolean);
      for (const value of categoryValues) {
        const categoryData = CATEGORIES.find((c) => c.value === value);
        filters.push({
          type: "category",
          value,
          label: categoryData?.label || value,
          variant: "category",
        });
      }
    }

    // Tags
    const tagsParam = effectiveParams.get("tags");
    if (tagsParam) {
      const tagValues = tagsParam.split(",").filter(Boolean);
      for (const value of tagValues) {
        // Find the tag label from TAG_GROUPS
        let label = value;
        for (const tags of Object.values(TAG_GROUPS)) {
          const found = tags.find((t) => t.value === value);
          if (found) {
            label = found.label;
            break;
          }
        }
        filters.push({
          type: "tag",
          value,
          label,
          variant: getTagVariant(value),
        });
      }
    }

    // Genres
    const genresParam = effectiveParams.get("genres");
    if (genresParam) {
      const genreValues = genresParam.split(",").filter(Boolean);
      for (const value of genreValues) {
        filters.push({
          type: "genre",
          value,
          label: formatGenre(value),
          variant: "genre",
        });
      }
    }

    // Date filter
    const dateParam = effectiveParams.get("date");
    if (dateParam) {
      let dateLabel = DATE_LABELS[dateParam];
      if (!dateLabel && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const d = new Date(dateParam + "T12:00:00");
        dateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      }
      if (dateLabel) {
        filters.push({
          type: "date",
          value: dateParam,
          label: dateLabel,
          variant: "date",
        });
      }
    }

    // Free only
    const freeParam = effectiveParams.get("free");
    if (freeParam === "1") {
      filters.push({
        type: "free",
        value: "free",
        label: "Free",
        variant: "free",
      });
    } else {
      const priceParam = effectiveParams.get("price");
      if (priceParam && priceParam !== "free") {
        const priceOption = PRICE_FILTERS.find((p) => p.value === priceParam);
        filters.push({
          type: "price",
          value: priceParam,
          label: priceOption?.label || priceParam,
          variant: "date",
        });
      }
    }

    // Neighborhoods
    const neighborhoodsParam = effectiveParams.get("neighborhoods");
    if (neighborhoodsParam) {
      const neighborhoodValues = neighborhoodsParam.split(",").filter(Boolean);
      for (const value of neighborhoodValues) {
        filters.push({
          type: "neighborhood",
          value,
          label: value,
          variant: "default",
        });
      }
    }

    // Venue vibes
    const vibesParam = effectiveParams.get("vibes");
    if (vibesParam) {
      const vibeValues = vibesParam.split(",").filter(Boolean);
      for (const value of vibeValues) {
        filters.push({
          type: "vibe",
          value,
          label: vibeLabelMap.get(value) || value.replace(/[-_]/g, " "),
          variant: "vibe",
        });
      }
    }

    return filters;
  }, [effectiveParams, vibeLabelMap]);

  // Remove a specific filter
  const removeFilter = useCallback(
    (filter: ActiveFilter) => {
      const params = new URLSearchParams(effectiveParams.toString());

      switch (filter.type) {
        case "search":
          params.delete("search");
          break;
        case "category": {
          const categories = params.get("categories")?.split(",").filter(Boolean) || [];
          const newCategories = categories.filter((c) => c !== filter.value);
          if (newCategories.length > 0) {
            params.set("categories", newCategories.join(","));
          } else {
            params.delete("categories");
          }
          break;
        }
        case "tag": {
          const tags = params.get("tags")?.split(",").filter(Boolean) || [];
          const newTags = tags.filter((t) => t !== filter.value);
          if (newTags.length > 0) {
            params.set("tags", newTags.join(","));
          } else {
            params.delete("tags");
          }
          break;
        }
        case "genre": {
          const genres = params.get("genres")?.split(",").filter(Boolean) || [];
          const newGenres = genres.filter((g) => g !== filter.value);
          if (newGenres.length > 0) {
            params.set("genres", newGenres.join(","));
          } else {
            params.delete("genres");
          }
          break;
        }
        case "date":
          params.delete("date");
          break;
        case "free":
          params.delete("free");
          params.delete("price");
          break;
        case "price":
          params.delete("price");
          break;
        case "neighborhood": {
          const neighborhoods = params.get("neighborhoods")?.split(",").filter(Boolean) || [];
          const newNeighborhoods = neighborhoods.filter((n) => n !== filter.value);
          if (newNeighborhoods.length > 0) {
            params.set("neighborhoods", newNeighborhoods.join(","));
          } else {
            params.delete("neighborhoods");
          }
          break;
        }
        case "vibe": {
          const vibes = params.get("vibes")?.split(",").filter(Boolean) || [];
          const newVibes = vibes.filter((v) => v !== filter.value);
          if (newVibes.length > 0) {
            params.set("vibes", newVibes.join(","));
          } else {
            params.delete("vibes");
          }
          break;
        }
      }

      // Reset pagination
      params.delete("page");

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      window.history.replaceState(window.history.state, "", newUrl);
    },
    [pathname, effectiveParams]
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(effectiveParams.toString());

    // Remove all filter params
    params.delete("categories");
    params.delete("tags");
    params.delete("genres");
    params.delete("search");
    params.delete("neighborhoods");
    params.delete("date");
    params.delete("free");
    params.delete("price");
    params.delete("vibes");
    params.delete("mood");
    params.delete("feed");
    params.delete("page");

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    window.history.replaceState(window.history.state, "", newUrl);
  }, [pathname, effectiveParams]);

  // Don't render if no active filters
  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-200 ${className}`}
    >
      {/* Filter chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {activeFilters.map((filter) => (
          <FilterChip
            key={`${filter.type}-${filter.value}`}
            label={filter.label}
            variant={filter.variant}
            active={true}
            removable={true}
            size="sm"
            onRemove={() => removeFilter(filter)}
            onClick={() => removeFilter(filter)}
          />
        ))}
      </div>

      {/* Clear all button */}
      {activeFilters.length > 1 && (
        <button
          onClick={clearAllFilters}
          className="shrink-0 ml-auto px-2 py-1 font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] whitespace-nowrap transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
