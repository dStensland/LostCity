"use client";

import { useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import FilterChip from "./FilterChip";
import { SUBCATEGORIES, CATEGORIES } from "@/lib/search";

interface SubcategoryRowProps {
  className?: string;
}

export default function SubcategoryRow({ className = "" }: SubcategoryRowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get selected categories from URL
  const selectedCategories = useMemo(() => {
    const categoriesParam = searchParams.get("categories");
    return categoriesParam ? categoriesParam.split(",").filter(Boolean) : [];
  }, [searchParams]);

  // Get selected subcategories from URL
  const selectedSubcategories = useMemo(() => {
    const subcatParam = searchParams.get("subcategories");
    return subcatParam ? subcatParam.split(",").filter(Boolean) : [];
  }, [searchParams]);

  // Get subcategories for selected categories, grouped by category
  const subcategoriesByCategory = useMemo(() => {
    const result: { category: string; categoryLabel: string; subcategories: { value: string; label: string }[] }[] = [];

    for (const catValue of selectedCategories) {
      const categoryData = CATEGORIES.find((c) => c.value === catValue);
      const subs = SUBCATEGORIES[catValue];

      if (subs && subs.length > 0) {
        result.push({
          category: catValue,
          categoryLabel: categoryData?.label || catValue,
          subcategories: subs,
        });
      }
    }

    return result;
  }, [selectedCategories]);

  // Toggle a subcategory on/off
  const toggleSubcategory = useCallback(
    (subcatValue: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const newSubcats = selectedSubcategories.includes(subcatValue)
        ? selectedSubcategories.filter((s) => s !== subcatValue)
        : [...selectedSubcategories, subcatValue];

      if (newSubcats.length > 0) {
        params.set("subcategories", newSubcats.join(","));
      } else {
        params.delete("subcategories");
      }

      // Reset pagination when filters change
      params.delete("page");

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [router, pathname, searchParams, selectedSubcategories]
  );

  // Don't render if no categories selected or no subcategories available
  if (selectedCategories.length === 0 || subcategoriesByCategory.length === 0) {
    return null;
  }

  const hasMultipleCategories = subcategoriesByCategory.length > 1;

  return (
    <div
      className={`animate-in slide-in-from-top-2 fade-in duration-200 ${className}`}
    >
      {/* Horizontal scrolling container */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory md:snap-none py-1 -mx-1 px-1"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Label */}
        <span className="shrink-0 text-[0.55rem] uppercase tracking-wider text-[var(--muted)] font-mono pl-1">
          Genre:
        </span>

        {subcategoriesByCategory.map((group, groupIndex) => (
          <div key={group.category} className="contents">
            {/* Category label divider for multiple categories */}
            {hasMultipleCategories && groupIndex > 0 && (
              <span className="shrink-0 text-[var(--twilight)] mx-1">|</span>
            )}
            {hasMultipleCategories && (
              <span className="shrink-0 text-[0.55rem] uppercase tracking-wider text-[var(--soft)] font-mono">
                {group.categoryLabel}:
              </span>
            )}

            {/* Subcategory chips */}
            {group.subcategories.map((subcat) => {
              const isActive = selectedSubcategories.includes(subcat.value);

              return (
                <div key={subcat.value} className="snap-start shrink-0">
                  <FilterChip
                    label={subcat.label}
                    variant="subcategory"
                    active={isActive}
                    size="sm"
                    onClick={() => toggleSubcategory(subcat.value)}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Fade gradient on right edge (desktop only) */}
      <div
        className="hidden md:block absolute right-0 top-0 bottom-0 w-8 pointer-events-none"
        style={{
          background: "linear-gradient(to right, transparent, var(--night))",
        }}
      />
    </div>
  );
}
