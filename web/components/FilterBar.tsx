"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useRef, useEffect, type ReactNode } from "react";
import { CATEGORIES, SUBCATEGORIES, DATE_FILTERS, type VenueWithCount } from "@/lib/search";
import VenueFilter from "./VenueFilter";
import CategoryIcon, { CATEGORY_CONFIG, type CategoryType } from "./CategoryIcon";

interface Props {
  venues: VenueWithCount[];
}

function ScrollableRow({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setShowLeftFade(scrollLeft > 0);
      setShowRightFade(scrollLeft < scrollWidth - clientWidth - 1);
    };

    checkScroll();
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  return (
    <div className="relative">
      {/* Left fade */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[var(--night)] to-transparent z-10 pointer-events-none transition-opacity ${
          showLeftFade ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Right fade */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[var(--night)] to-transparent z-10 pointer-events-none transition-opacity ${
          showRightFade ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1"
      >
        {children}
      </div>
    </div>
  );
}

export default function FilterBar({ venues }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentCategories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
  const currentSubcategories = searchParams.get("subcategories")?.split(",").filter(Boolean) || [];
  const isFreeOnly = searchParams.get("free") === "true";
  const currentDateFilter = searchParams.get("date") || "";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    (category: string, keepDropdownOpen = false) => {
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter((c) => c !== category)
        : [...currentCategories, category];

      // Clear subcategories when category changes
      updateParams({
        categories: newCategories.length > 0 ? newCategories.join(",") : null,
        subcategories: null,
      });
      if (!keepDropdownOpen) {
        setOpenDropdown(null);
      }
    },
    [currentCategories, updateParams]
  );

  const toggleSubcategory = useCallback(
    (subcategory: string) => {
      const newSubcategories = currentSubcategories.includes(subcategory)
        ? currentSubcategories.filter((s) => s !== subcategory)
        : [...currentSubcategories, subcategory];

      updateParams({
        subcategories: newSubcategories.length > 0 ? newSubcategories.join(",") : null,
      });
    },
    [currentSubcategories, updateParams]
  );

  const clearCategories = useCallback(() => {
    updateParams({ categories: null, subcategories: null });
    setOpenDropdown(null);
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

  // Check if a category has subcategories
  const hasSubcategories = (category: string) => {
    return SUBCATEGORIES[category] && SUBCATEGORIES[category].length > 0;
  };

  return (
    <div className="flex-1 space-y-2" ref={dropdownRef}>
      {/* Category filters row */}
      <ScrollableRow>
        <button
          type="button"
          onClick={clearCategories}
          className={`filter-btn ${currentCategories.length === 0 && currentSubcategories.length === 0 ? "active" : ""}`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <div key={cat.value} className="relative">
            <button
              type="button"
              onClick={() => {
                if (hasSubcategories(cat.value)) {
                  // Toggle dropdown, also select the category
                  if (!currentCategories.includes(cat.value)) {
                    toggleCategory(cat.value, true); // Keep dropdown open
                  }
                  setOpenDropdown(openDropdown === cat.value ? null : cat.value);
                } else {
                  toggleCategory(cat.value);
                }
              }}
              className={`filter-btn flex items-center gap-1.5 ${currentCategories.includes(cat.value) ? "active" : ""}`}
            >
              <CategoryIcon
                type={cat.value}
                size={14}
                style={{
                  color: currentCategories.includes(cat.value)
                    ? "var(--void)"
                    : CATEGORY_CONFIG[cat.value as CategoryType]?.color
                }}
              />
              {cat.label}
              {hasSubcategories(cat.value) && (
                <svg
                  className={`w-3 h-3 transition-transform ${openDropdown === cat.value ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {/* Subcategory dropdown */}
            {openDropdown === cat.value && hasSubcategories(cat.value) && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden">
                <div className="max-h-64 overflow-y-auto py-1">
                  {SUBCATEGORIES[cat.value].map((sub) => (
                    <button
                      key={sub.value}
                      type="button"
                      onClick={() => toggleSubcategory(sub.value)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                        currentSubcategories.includes(sub.value)
                          ? "bg-[var(--ember)] text-[var(--cream)]"
                          : "text-[var(--soft)] hover:bg-[var(--twilight)] hover:text-[var(--cream)]"
                      }`}
                    >
                      {currentSubcategories.includes(sub.value) && (
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      <span className={currentSubcategories.includes(sub.value) ? "" : "ml-5"}>{sub.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </ScrollableRow>

      {/* Date, Venue, and Free filters row */}
      <ScrollableRow>
        {/* Date filters */}
        {DATE_FILTERS.map((df) => (
          <button
            type="button"
            key={df.value}
            onClick={() => setDateFilter(df.value)}
            className={`time-tab ${currentDateFilter === df.value ? "active" : ""}`}
          >
            {df.label}
          </button>
        ))}

        {/* Divider */}
        <div className="h-5 w-px bg-[var(--twilight)] mx-1 flex-shrink-0" />

        {/* Venue filter */}
        <VenueFilter venues={venues} />

        {/* Free toggle */}
        <button
          type="button"
          onClick={toggleFree}
          className={`filter-btn flex items-center gap-1.5 ${isFreeOnly ? "active" : ""}`}
        >
          {isFreeOnly && (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
          Free
        </button>
      </ScrollableRow>
    </div>
  );
}
