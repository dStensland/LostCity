"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import FilterChip, { getTagVariant, type FilterChipVariant } from "./FilterChip";
import { CATEGORIES, SUBCATEGORIES, TAG_GROUPS } from "@/lib/search-constants";

// Date filter display labels
const DATE_LABELS: Record<string, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "Weekend",
  week: "This Week",
};

interface ActiveFilter {
  type: "category" | "subcategory" | "tag" | "date" | "free";
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

    // Subcategories
    const subcatParam = searchParams.get("subcategories");
    if (subcatParam) {
      const subcatValues = subcatParam.split(",").filter(Boolean);
      for (const value of subcatValues) {
        // Find the subcategory label from SUBCATEGORIES
        let label = value;
        for (const subs of Object.values(SUBCATEGORIES)) {
          const found = subs.find((s) => s.value === value);
          if (found) {
            label = found.label;
            break;
          }
        }
        filters.push({
          type: "subcategory",
          value,
          label,
          variant: "subcategory",
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

    // Date filter
    const dateParam = searchParams.get("date");
    if (dateParam && DATE_LABELS[dateParam]) {
      filters.push({
        type: "date",
        value: dateParam,
        label: DATE_LABELS[dateParam],
        variant: "date",
      });
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

    return filters;
  }, [searchParams]);

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
          // Also clear subcategories for this category when category is removed
          const subcats = params.get("subcategories")?.split(",").filter(Boolean) || [];
          const filteredSubcats = subcats.filter((s) => !s.startsWith(`${filter.value}.`));
          if (filteredSubcats.length > 0) {
            params.set("subcategories", filteredSubcats.join(","));
          } else {
            params.delete("subcategories");
          }
          break;
        }
        case "subcategory": {
          const subcats = params.get("subcategories")?.split(",").filter(Boolean) || [];
          const newSubcats = subcats.filter((s) => s !== filter.value);
          if (newSubcats.length > 0) {
            params.set("subcategories", newSubcats.join(","));
          } else {
            params.delete("subcategories");
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
        case "date":
          params.delete("date");
          break;
        case "free":
          params.delete("free");
          params.delete("price");
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
    params.delete("subcategories");
    params.delete("tags");
    params.delete("date");
    params.delete("free");
    params.delete("price");
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
