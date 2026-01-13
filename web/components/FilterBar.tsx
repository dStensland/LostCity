"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CATEGORIES, DATE_FILTERS } from "@/lib/search";

export default function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
  const isFreeOnly = searchParams.get("free") === "true";
  const currentDateFilter = searchParams.get("date") || "";

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

      // Reset to page 1 when filters change
      params.delete("page");

      const newUrl = params.toString() ? `/?${params.toString()}` : "/";
      router.push(newUrl, { scroll: false });
    },
    [router, searchParams]
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

  const clearCategories = useCallback(() => {
    updateParams({ categories: null });
  }, [updateParams]);

  const toggleFree = useCallback(() => {
    updateParams({ free: isFreeOnly ? null : "true" });
  }, [isFreeOnly, updateParams]);

  const setDateFilter = useCallback(
    (date: string | null) => {
      updateParams({ date: currentDateFilter === date ? null : date });
    },
    [currentDateFilter, updateParams]
  );

  return (
    <div className="flex-1 space-y-1.5 sm:space-y-2">
      {/* Category chips row - single scrollable row on mobile */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        <button
          onClick={clearCategories}
          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-full whitespace-nowrap transition-all ${
            currentCategories.length === 0
              ? "chip-active"
              : "chip hover:bg-white/15"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => toggleCategory(cat.value)}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-full whitespace-nowrap transition-all ${
              currentCategories.includes(cat.value)
                ? "chip-active"
                : "chip hover:bg-white/15"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Date and Free filters row */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {/* Date filters */}
        {DATE_FILTERS.map((df) => (
          <button
            key={df.value}
            onClick={() => setDateFilter(df.value)}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-full whitespace-nowrap transition-all ${
              currentDateFilter === df.value
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20"
                : "chip hover:bg-white/15"
            }`}
          >
            {df.label}
          </button>
        ))}

        {/* Divider - hidden on very small screens */}
        <div className="hidden xs:block h-4 sm:h-5 w-px bg-white/20 mx-0.5 sm:mx-1 flex-shrink-0" />

        {/* Free toggle */}
        <button
          onClick={toggleFree}
          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-full whitespace-nowrap transition-all flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ${
            isFreeOnly
              ? "bg-gradient-to-r from-emerald-400 to-teal-400 text-white shadow-lg shadow-emerald-500/20"
              : "chip hover:bg-white/15"
          }`}
        >
          {isFreeOnly && (
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
          Free
        </button>
      </div>
    </div>
  );
}
