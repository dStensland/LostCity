"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import FilterChip, { getTagVariant, type FilterChipVariant } from "./FilterChip";
import { CATEGORIES, TAG_GROUPS } from "@/lib/search-constants";
import { VIBE_GROUPS } from "@/lib/spots-constants";
import { MOODS } from "@/lib/moods";
import { formatGenre } from "@/lib/series-utils";

// Date filter display labels
const DATE_LABELS: Record<string, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "Weekend",
  week: "This Week",
};

interface ActiveFilter {
  type: "category" | "tag" | "genre" | "date" | "free" | "vibe" | "mood";
  value: string;
  label: string;
  variant: FilterChipVariant;
}

interface ActiveFiltersRowProps {
  className?: string;
}

export default function ActiveFiltersRow({ className = "" }: ActiveFiltersRowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const vibeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of Object.values(VIBE_GROUPS)) {
      for (const vibe of group) {
        map.set(vibe.value, vibe.label);
      }
    }
    return map;
  }, []);

  const moodLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const mood of MOODS) {
      map.set(mood.id, mood.name);
    }
    return map;
  }, []);

  // Build list of all active filters
  const activeFilters = useMemo(() => {
    const filters: ActiveFilter[] = [];

    // Categories
    const categoriesParam = searchParams.get("categories");
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
    const tagsParam = searchParams.get("tags");
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
    const genresParam = searchParams.get("genres");
    if (genresParam) {
      const genreValues = genresParam.split(",").filter(Boolean);
      for (const value of genreValues) {
        filters.push({
          type: "genre",
          value,
          label: formatGenre(value),
          variant: "subcategory",
        });
      }
    }

    // Date filter
    const dateParam = searchParams.get("date");
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
    const freeParam = searchParams.get("free");
    if (freeParam === "1") {
      filters.push({
        type: "free",
        value: "free",
        label: "Free",
        variant: "free",
      });
    }

    // Venue vibes
    const vibesParam = searchParams.get("vibes");
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

    // Mood
    const moodParam = searchParams.get("mood");
    if (moodParam) {
      filters.push({
        type: "mood",
        value: moodParam,
        label: moodLabelMap.get(moodParam) || moodParam,
        variant: "vibe",
      });
    }

    return filters;
  }, [searchParams, vibeLabelMap, moodLabelMap]);

  // Remove a specific filter
  const removeFilter = useCallback(
    (filter: ActiveFilter) => {
      const params = new URLSearchParams(searchParams.toString());

      switch (filter.type) {
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
        case "mood":
          params.delete("mood");
          break;
      }

      // Reset pagination
      params.delete("page");

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());

    // Remove all filter params
    params.delete("categories");
    params.delete("tags");
    params.delete("genres");
    params.delete("date");
    params.delete("free");
    params.delete("price");
    params.delete("vibes");
    params.delete("mood");
    params.delete("feed");
    params.delete("page");

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newUrl, { scroll: false });
  }, [router, pathname, searchParams]);

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
          className="shrink-0 ml-auto px-2 py-1 font-mono text-[0.6rem] text-[var(--coral)] hover:text-[var(--rose)] whitespace-nowrap transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
