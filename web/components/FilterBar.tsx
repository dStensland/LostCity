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
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-3 space-y-3">
        {/* Category chips row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={clearCategories}
            className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
              currentCategories.length === 0
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => toggleCategory(cat.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                currentCategories.includes(cat.value)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Date and Free filters row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date filters */}
          <div className="flex items-center gap-1.5">
            {DATE_FILTERS.map((df) => (
              <button
                key={df.value}
                onClick={() => setDateFilter(df.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                  currentDateFilter === df.value
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {df.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200 mx-1" />

          {/* Free toggle */}
          <button
            onClick={toggleFree}
            className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              isFreeOnly
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {isFreeOnly && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
    </div>
  );
}
