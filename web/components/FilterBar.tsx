"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CATEGORIES, SUBCATEGORIES, DATE_FILTERS, PRICE_FILTERS, TAG_GROUPS, ALL_TAGS } from "@/lib/search";
import { PREFERENCE_VIBES, PREFERENCE_NEIGHBORHOODS } from "@/lib/preferences";
import CategoryIcon, { CATEGORY_CONFIG, type CategoryType } from "./CategoryIcon";

export default function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentCategories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
  const currentSubcategories = searchParams.get("subcategories")?.split(",").filter(Boolean) || [];
  const currentTags = searchParams.get("tags")?.split(",").filter(Boolean) || [];
  const currentVibes = searchParams.get("vibes")?.split(",").filter(Boolean) || [];
  const currentNeighborhoods = searchParams.get("neighborhoods")?.split(",").filter(Boolean) || [];
  const currentPriceFilter = searchParams.get("price") || "";
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

      // Clear subcategories for this category when toggling off
      const clearedSubcategories = currentCategories.includes(category)
        ? currentSubcategories.filter((s) => !s.startsWith(category + "."))
        : currentSubcategories;

      updateParams({
        categories: newCategories.length > 0 ? newCategories.join(",") : null,
        subcategories: clearedSubcategories.length > 0 ? clearedSubcategories.join(",") : null,
      });
    },
    [currentCategories, currentSubcategories, updateParams]
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

  const toggleTag = useCallback(
    (tag: string) => {
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];

      updateParams({
        tags: newTags.length > 0 ? newTags.join(",") : null,
      });
    },
    [currentTags, updateParams]
  );

  const toggleVibe = useCallback(
    (vibe: string) => {
      const newVibes = currentVibes.includes(vibe)
        ? currentVibes.filter((v) => v !== vibe)
        : [...currentVibes, vibe];

      updateParams({
        vibes: newVibes.length > 0 ? newVibes.join(",") : null,
      });
    },
    [currentVibes, updateParams]
  );

  const toggleNeighborhood = useCallback(
    (neighborhood: string) => {
      const newNeighborhoods = currentNeighborhoods.includes(neighborhood)
        ? currentNeighborhoods.filter((n) => n !== neighborhood)
        : [...currentNeighborhoods, neighborhood];

      updateParams({
        neighborhoods: newNeighborhoods.length > 0 ? newNeighborhoods.join(",") : null,
      });
    },
    [currentNeighborhoods, updateParams]
  );

  const clearAll = useCallback(() => {
    updateParams({
      categories: null,
      subcategories: null,
      tags: null,
      vibes: null,
      neighborhoods: null,
      date: null,
      price: null,
    });
  }, [updateParams]);

  const setPriceFilter = useCallback(
    (price: string) => {
      updateParams({ price: currentPriceFilter === price ? null : price });
    },
    [currentPriceFilter, updateParams]
  );

  const setDateFilter = useCallback(
    (date: string) => {
      updateParams({ date: currentDateFilter === date ? null : date });
    },
    [currentDateFilter, updateParams]
  );

  // Get all subcategories for selected categories
  const availableSubcategories = currentCategories.flatMap((cat) =>
    SUBCATEGORIES[cat]?.map((sub) => ({ ...sub, category: cat })) || []
  );

  const hasFilters = currentCategories.length > 0 || currentSubcategories.length > 0 || currentTags.length > 0 || currentVibes.length > 0 || currentNeighborhoods.length > 0 || currentPriceFilter || currentDateFilter;

  return (
    <div className="sticky top-0 z-30 bg-[var(--night)]">
      {/* Category Filter Row */}
      <div className="border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            <button
              onClick={clearAll}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium whitespace-nowrap transition-colors ${
                !hasFilters
                  ? "bg-[var(--cream)] text-[var(--void)]"
                  : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => toggleCategory(cat.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium whitespace-nowrap transition-colors ${
                  currentCategories.includes(cat.value)
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
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
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Subcategory Filter Row - only shown when categories with subcategories are selected */}
      {availableSubcategories.length > 0 && (
        <div className="border-b border-[var(--twilight)]">
          <div className="max-w-3xl mx-auto px-4 py-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 items-center">
              <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider flex-shrink-0 mr-1">
                Genre
              </span>
              {availableSubcategories.map((sub) => {
                const isActive = currentSubcategories.includes(sub.value);
                return (
                  <button
                    key={sub.value}
                    onClick={() => toggleSubcategory(sub.value)}
                    className={`px-2.5 py-1 rounded-full font-mono text-[0.65rem] font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-[var(--coral)] text-[var(--void)]"
                        : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                    }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Date / Price Filter Row */}
      <div className="border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 items-center">
            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider flex-shrink-0 mr-1">
              When
            </span>
            {DATE_FILTERS.map((df) => (
              <button
                key={df.value}
                onClick={() => setDateFilter(df.value)}
                className={`px-2.5 py-1 rounded-full font-mono text-[0.65rem] font-medium whitespace-nowrap transition-colors ${
                  currentDateFilter === df.value
                    ? "bg-[var(--gold)] text-[var(--void)]"
                    : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                }`}
              >
                {df.label}
              </button>
            ))}

            {/* Divider */}
            <div className="h-4 w-px bg-[var(--twilight)] mx-1 flex-shrink-0" />

            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider flex-shrink-0 mr-1">
              Price
            </span>
            {PRICE_FILTERS.map((pf) => (
              <button
                key={pf.value}
                onClick={() => setPriceFilter(pf.value)}
                className={`px-2.5 py-1 rounded-full font-mono text-[0.65rem] font-medium whitespace-nowrap transition-colors ${
                  currentPriceFilter === pf.value
                    ? "bg-[var(--rose)] text-[var(--void)]"
                    : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                }`}
              >
                {pf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tag Filter Row */}
      <div className="border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 items-center">
            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider flex-shrink-0">
              Tags
            </span>
            {Object.entries(TAG_GROUPS).map(([group, tags]) => (
              <div key={group} className="flex gap-1.5 items-center">
                <span className="font-mono text-[0.55rem] text-[var(--twilight)] uppercase tracking-wider">
                  {group}:
                </span>
                {tags.map((tag) => {
                  const isActive = currentTags.includes(tag.value);
                  return (
                    <button
                      key={tag.value}
                      onClick={() => toggleTag(tag.value)}
                      className={`px-2 py-0.5 rounded-full font-mono text-[0.6rem] font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-[var(--lavender)] text-[var(--void)]"
                          : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vibes Filter Row */}
      <div className="border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 items-center">
            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider flex-shrink-0">
              Vibes
            </span>
            {["Atmosphere", "Amenities", "Access"].map((group) => (
              <div key={group} className="flex gap-1.5 items-center">
                <span className="font-mono text-[0.55rem] text-[var(--twilight)] uppercase tracking-wider">
                  {group}:
                </span>
                {PREFERENCE_VIBES.filter((v) => v.group === group).map((vibe) => {
                  const isActive = currentVibes.includes(vibe.value);
                  return (
                    <button
                      key={vibe.value}
                      onClick={() => toggleVibe(vibe.value)}
                      className={`px-2 py-0.5 rounded-full font-mono text-[0.6rem] font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-[var(--sage)] text-[var(--void)]"
                          : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                      }`}
                    >
                      {vibe.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Neighborhoods Filter Row */}
      <div className="border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 items-center">
            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider flex-shrink-0 mr-1">
              Where
            </span>
            {PREFERENCE_NEIGHBORHOODS.map((neighborhood) => {
              const isActive = currentNeighborhoods.includes(neighborhood);
              return (
                <button
                  key={neighborhood}
                  onClick={() => toggleNeighborhood(neighborhood)}
                  className={`px-2.5 py-1 rounded-full font-mono text-[0.65rem] font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-[var(--coral)] text-[var(--void)]"
                      : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                  }`}
                >
                  {neighborhood}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasFilters && (
        <div className="border-b border-[var(--twilight)] bg-[var(--void)]">
          <div className="max-w-3xl mx-auto px-4 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider">
                Filtering:
              </span>
              {currentCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem] hover:bg-[var(--dusk)] transition-colors"
                >
                  <CategoryIcon type={cat} size={12} />
                  {CATEGORIES.find((c) => c.value === cat)?.label || cat}
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              {currentSubcategories.map((sub) => (
                <button
                  key={sub}
                  onClick={() => toggleSubcategory(sub)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem] hover:bg-[var(--dusk)] transition-colors"
                >
                  {availableSubcategories.find((s) => s.value === sub)?.label ||
                   Object.values(SUBCATEGORIES).flat().find((s) => s.value === sub)?.label ||
                   sub}
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              {currentTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--lavender)] text-[var(--void)] font-mono text-[0.65rem] hover:opacity-80 transition-colors"
                >
                  {ALL_TAGS.find((t) => t.value === tag)?.label || tag}
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              {currentVibes.map((vibe) => (
                <button
                  key={vibe}
                  onClick={() => toggleVibe(vibe)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--sage)] text-[var(--void)] font-mono text-[0.65rem] hover:opacity-80 transition-colors"
                >
                  {PREFERENCE_VIBES.find((v) => v.value === vibe)?.label || vibe}
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              {currentNeighborhoods.map((neighborhood) => (
                <button
                  key={neighborhood}
                  onClick={() => toggleNeighborhood(neighborhood)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--coral)] text-[var(--void)] font-mono text-[0.65rem] hover:opacity-80 transition-colors"
                >
                  {neighborhood}
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              {currentDateFilter && (
                <button
                  onClick={() => setDateFilter(currentDateFilter)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem] hover:bg-[var(--dusk)] transition-colors"
                >
                  {DATE_FILTERS.find((d) => d.value === currentDateFilter)?.label}
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {currentPriceFilter && (
                <button
                  onClick={() => setPriceFilter(currentPriceFilter)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem] hover:bg-[var(--dusk)] transition-colors"
                >
                  {PRICE_FILTERS.find((p) => p.value === currentPriceFilter)?.label}
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                onClick={clearAll}
                className="font-mono text-[0.6rem] text-[var(--coral)] hover:text-[var(--rose)] transition-colors ml-auto"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
