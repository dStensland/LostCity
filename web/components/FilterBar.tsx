"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { CATEGORIES, SUBCATEGORIES, DATE_FILTERS, PRICE_FILTERS, TAG_GROUPS, ALL_TAGS } from "@/lib/search";
import { PREFERENCE_VIBES, PREFERENCE_NEIGHBORHOODS } from "@/lib/preferences";
import { MOODS, getMoodById, type MoodId } from "@/lib/moods";
import CategoryIcon, { CATEGORY_CONFIG, type CategoryType } from "./CategoryIcon";
import ScrollableRow from "./ui/ScrollableRow";

export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentCategories = useMemo(
    () => searchParams.get("categories")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentSubcategories = useMemo(
    () => searchParams.get("subcategories")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentTags = useMemo(
    () => searchParams.get("tags")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentVibes = useMemo(
    () => searchParams.get("vibes")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentNeighborhoods = useMemo(
    () => searchParams.get("neighborhoods")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentPriceFilter = searchParams.get("price") || "";
  const currentDateFilter = searchParams.get("date") || "";
  const currentMood = (searchParams.get("mood") as MoodId) || null;

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

      params.delete("page");

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const toggleCategory = useCallback(
    (category: string) => {
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter((c) => c !== category)
        : [...currentCategories, category];

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

  const setMood = useCallback(
    (mood: MoodId | null) => {
      if (mood === currentMood) {
        updateParams({ mood: null });
      } else {
        updateParams({ mood });
      }
    },
    [currentMood, updateParams]
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
      mood: null,
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

  const availableSubcategories = currentCategories.flatMap((cat) =>
    SUBCATEGORIES[cat]?.map((sub) => ({ ...sub, category: cat })) || []
  );

  const hasFilters = currentMood || currentCategories.length > 0 || currentSubcategories.length > 0 || currentTags.length > 0 || currentVibes.length > 0 || currentNeighborhoods.length > 0 || currentPriceFilter || currentDateFilter;

  // Count of advanced filters (drawer filters)
  const advancedFilterCount = currentTags.length + currentVibes.length + currentNeighborhoods.length;

  return (
    <div className="sticky top-16 z-30 bg-[var(--night)]">
      {/* Row 1: Mood + Categories (combined, compact) */}
      <div className="border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-2.5">
          <ScrollableRow className="-mx-4 px-4">
            {/* Mood pills inline with categories */}
            {MOODS.map((mood) => {
              const isSelected = currentMood === mood.id;
              return (
                <button
                  key={mood.id}
                  onClick={() => setMood(mood.id)}
                  className={`
                    px-2.5 py-1.5 rounded-full font-mono text-xs font-medium
                    transition-all duration-200 flex items-center gap-1 whitespace-nowrap
                    ${
                      isSelected
                        ? "text-[var(--void)]"
                        : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                    }
                  `}
                  style={
                    isSelected
                      ? {
                          backgroundColor: mood.color,
                          boxShadow: `0 0 12px ${mood.color}80`,
                        }
                      : undefined
                  }
                  title={mood.description}
                >
                  <span aria-hidden="true">{mood.emoji}</span>
                  <span className="hidden sm:inline">{mood.name}</span>
                </button>
              );
            })}

            {/* Divider */}
            <div className="h-5 w-px bg-[var(--twilight)] mx-1 flex-shrink-0" />

            {/* Categories */}
            <button
              onClick={clearAll}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-xs font-medium whitespace-nowrap transition-all ${
                !hasFilters
                  ? "bg-[var(--neon-magenta)] text-[var(--void)] glow-sm"
                  : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => toggleCategory(cat.value)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-xs font-medium whitespace-nowrap transition-all ${
                  currentCategories.includes(cat.value)
                    ? "bg-[var(--neon-magenta)] text-[var(--void)] glow-sm"
                    : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                }`}
              >
                <CategoryIcon
                  type={cat.value}
                  size={12}
                  style={{
                    color: currentCategories.includes(cat.value)
                      ? "var(--void)"
                      : CATEGORY_CONFIG[cat.value as CategoryType]?.color
                  }}
                />
                <span className="hidden sm:inline">{cat.label}</span>
              </button>
            ))}
          </ScrollableRow>
        </div>
      </div>

      {/* Row 2: Quick filters (When/Price) + More button */}
      <div className="border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex items-center gap-2">
            <ScrollableRow className="flex-1 -mx-1 px-1">
              {/* Date filters */}
              {DATE_FILTERS.map((df) => (
                <button
                  key={df.value}
                  onClick={() => setDateFilter(df.value)}
                  className={`px-2 py-1 rounded-full font-mono text-[0.65rem] font-medium whitespace-nowrap transition-colors ${
                    currentDateFilter === df.value
                      ? "bg-[var(--gold)] text-[var(--void)]"
                      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  {df.label}
                </button>
              ))}

              <div className="h-4 w-px bg-[var(--twilight)] mx-0.5 flex-shrink-0" />

              {/* Price filters */}
              {PRICE_FILTERS.map((pf) => (
                <button
                  key={pf.value}
                  onClick={() => setPriceFilter(pf.value)}
                  className={`px-2 py-1 rounded-full font-mono text-[0.65rem] font-medium whitespace-nowrap transition-colors ${
                    currentPriceFilter === pf.value
                      ? "bg-[var(--rose)] text-[var(--void)]"
                      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  {pf.label}
                </button>
              ))}
            </ScrollableRow>

            {/* More Filters button */}
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[0.65rem] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                drawerOpen || advancedFilterCount > 0
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${drawerOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              More
              {advancedFilterCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[var(--void)]/20 text-[0.55rem]">
                  {advancedFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Subcategory Row - only shown when categories with subcategories are selected */}
      {availableSubcategories.length > 0 && (
        <div className="border-b border-[var(--twilight)]">
          <div className="max-w-3xl mx-auto px-4 py-2">
            <ScrollableRow className="-mx-4 px-4 items-center">
              <span className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-wider flex-shrink-0 mr-2">
                Genre
              </span>
              {availableSubcategories.map((sub) => {
                const isActive = currentSubcategories.includes(sub.value);
                return (
                  <button
                    key={sub.value}
                    onClick={() => toggleSubcategory(sub.value)}
                    className={`px-2 py-0.5 rounded-full font-mono text-[0.6rem] font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-[var(--coral)] text-[var(--void)]"
                        : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                    }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </ScrollableRow>
          </div>
        </div>
      )}

      {/* Drawer: Tags, Vibes, Neighborhoods */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          drawerOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-b border-[var(--twilight)] bg-[var(--void)]/50">
          <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
            {/* Neighborhoods */}
            <div>
              <div className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-wider mb-1.5">
                Neighborhood
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PREFERENCE_NEIGHBORHOODS.map((neighborhood) => {
                  const isActive = currentNeighborhoods.includes(neighborhood);
                  return (
                    <button
                      key={neighborhood}
                      onClick={() => toggleNeighborhood(neighborhood)}
                      className={`px-2 py-1 rounded-full font-mono text-[0.6rem] font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-[var(--coral)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                      }`}
                    >
                      {neighborhood}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vibes */}
            <div>
              <div className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-wider mb-1.5">
                Vibe
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PREFERENCE_VIBES.map((vibe) => {
                  const isActive = currentVibes.includes(vibe.value);
                  return (
                    <button
                      key={vibe.value}
                      onClick={() => toggleVibe(vibe.value)}
                      className={`px-2 py-1 rounded-full font-mono text-[0.6rem] font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-[var(--sage)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                      }`}
                    >
                      {vibe.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags */}
            <div>
              <div className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-wider mb-1.5">
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TAGS.map((tag) => {
                  const isActive = currentTags.includes(tag.value);
                  return (
                    <button
                      key={tag.value}
                      onClick={() => toggleTag(tag.value)}
                      className={`px-2 py-1 rounded-full font-mono text-[0.6rem] font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-[var(--lavender)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Filters Summary - compact chip display */}
      {hasFilters && (
        <div className="border-b border-[var(--twilight)] bg-[var(--void)]">
          <div className="max-w-3xl mx-auto px-4 py-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {currentMood && (() => {
                const mood = getMoodById(currentMood);
                return mood ? (
                  <button
                    onClick={() => setMood(null)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[var(--void)] font-mono text-[0.6rem] hover:opacity-80 transition-colors"
                    style={{ backgroundColor: mood.color }}
                  >
                    {mood.emoji} {mood.name}
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null;
              })()}
              {currentCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--neon-magenta)] text-[var(--void)] font-mono text-[0.6rem] hover:opacity-80 transition-colors"
                >
                  <CategoryIcon type={cat} size={10} />
                  {CATEGORIES.find((c) => c.value === cat)?.label || cat}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              {currentSubcategories.map((sub) => (
                <button
                  key={sub}
                  onClick={() => toggleSubcategory(sub)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--coral)] text-[var(--void)] font-mono text-[0.6rem] hover:opacity-80 transition-colors"
                >
                  {availableSubcategories.find((s) => s.value === sub)?.label ||
                   Object.values(SUBCATEGORIES).flat().find((s) => s.value === sub)?.label ||
                   sub}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              {currentDateFilter && (
                <button
                  onClick={() => setDateFilter(currentDateFilter)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--gold)] text-[var(--void)] font-mono text-[0.6rem] hover:opacity-80 transition-colors"
                >
                  {DATE_FILTERS.find((d) => d.value === currentDateFilter)?.label}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {currentPriceFilter && (
                <button
                  onClick={() => setPriceFilter(currentPriceFilter)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--rose)] text-[var(--void)] font-mono text-[0.6rem] hover:opacity-80 transition-colors"
                >
                  {PRICE_FILTERS.find((p) => p.value === currentPriceFilter)?.label}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {currentTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--lavender)] text-[var(--void)] font-mono text-[0.6rem] hover:opacity-80 transition-colors"
                >
                  {ALL_TAGS.find((t) => t.value === tag)?.label || tag}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              {currentVibes.map((vibe) => (
                <button
                  key={vibe}
                  onClick={() => toggleVibe(vibe)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--sage)] text-[var(--void)] font-mono text-[0.6rem] hover:opacity-80 transition-colors"
                >
                  {PREFERENCE_VIBES.find((v) => v.value === vibe)?.label || vibe}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              {currentNeighborhoods.map((neighborhood) => (
                <button
                  key={neighborhood}
                  onClick={() => toggleNeighborhood(neighborhood)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--coral)] text-[var(--void)] font-mono text-[0.6rem] hover:opacity-80 transition-colors"
                >
                  {neighborhood}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              <button
                onClick={clearAll}
                className="font-mono text-[0.55rem] text-[var(--coral)] hover:text-[var(--rose)] transition-colors ml-auto"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
