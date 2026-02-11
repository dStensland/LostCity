"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useEffect, useRef, useTransition } from "react";
import { CATEGORIES, TAG_GROUPS } from "@/lib/search-constants";
import { VIBE_GROUPS } from "@/lib/spots-constants";
import { MOODS } from "@/lib/moods";
import CategoryIcon from "@/components/CategoryIcon";
import { MobileFilterSheet } from "@/components/MobileFilterSheet";
import { formatGenre } from "@/lib/series-utils";

type FindFilterBarProps = {
  variant?: "full" | "compact";
};

type GroupedOption = {
  group: string;
  options: { value: string; label: string }[];
};

const DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "Weekend" },
  { value: "week", label: "This Week" },
] as const;

const TAG_GROUP_OPTIONS: GroupedOption[] = Object.entries(TAG_GROUPS)
  .map(([group, options]) => ({
    group,
    options: options.filter((option) => option.value !== "free"),
  }))
  .filter((group) => group.options.length > 0);

const VIBE_GROUP_OPTIONS: GroupedOption[] = Object.entries(VIBE_GROUPS).map(([group, options]) => ({
  group,
  options: [...options],
}));

const MOOD_OPTIONS = MOODS.map((mood) => ({ value: mood.id, label: mood.name }));

function humanize(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

const MOOD_LABELS = new Map(MOOD_OPTIONS.map((option) => [option.value, option.label]));

export default function FindFilterBar({ variant = "full" }: FindFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [moodDropdownOpen, setMoodDropdownOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [genreOptions, setGenreOptions] = useState<{ genre: string; display_order: number | null; is_format: boolean | null }[]>([]);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const moodDropdownRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const prevCategoriesRef = useRef<string[]>([]);

  const currentCategories = useMemo(
    () => searchParams.get("categories")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentGenres = useMemo(
    () => searchParams.get("genres")?.split(",").filter(Boolean) || [],
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
  const currentMood = searchParams.get("mood") || "";
  const currentDateFilter = searchParams.get("date") || "";
  const currentFreeOnly = searchParams.get("free") === "1";

  const hasFilters =
    currentCategories.length > 0 ||
    currentGenres.length > 0 ||
    currentTags.length > 0 ||
    currentVibes.length > 0 ||
    Boolean(currentMood) ||
    Boolean(currentDateFilter) ||
    currentFreeOnly;

  const filterCount =
    currentCategories.length +
    currentGenres.length +
    currentTags.length +
    currentVibes.length +
    (currentMood ? 1 : 0) +
    (currentDateFilter ? 1 : 0) +
    (currentFreeOnly ? 1 : 0);

  const isSpecificDate = /^\d{4}-\d{2}-\d{2}$/.test(currentDateFilter);

  const formatDateLabel = useCallback((dateStr: string): string => {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, []);

  const dateFilterLabel =
    !currentDateFilter
      ? "When"
      : isSpecificDate
      ? formatDateLabel(currentDateFilter)
      : DATE_OPTIONS.find((d) => d.value === currentDateFilter)?.label || "When";

  const categoryLabel =
    currentCategories.length === 0
      ? "Category"
      : currentCategories.length === 1
      ? CATEGORIES.find((c) => c.value === currentCategories[0])?.label || "Category"
      : `${currentCategories.length} categories`;

  const moodLabel = !currentMood ? "Mood" : MOOD_LABELS.get(currentMood) || humanize(currentMood);

  const visibleGenreOptions = currentCategories.length === 1 ? genreOptions : [];

  const closeAllDropdowns = useCallback(() => {
    setCategoryDropdownOpen(false);
    setDateDropdownOpen(false);
    setMoodDropdownOpen(false);
  }, []);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }

      // Keep routing in Find mode and reset pagination.
      params.set("view", "find");
      params.delete("page");

      const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      startTransition(() => {
        router.push(url, { scroll: false });
      });
    },
    [router, pathname, searchParams, startTransition]
  );

  const toggleCategory = useCallback(
    (category: string) => {
      const next = currentCategories.includes(category)
        ? currentCategories.filter((c) => c !== category)
        : [...currentCategories, category];

      updateParams({
        categories: next.length > 0 ? next.join(",") : null,
      });
    },
    [currentCategories, updateParams]
  );

  const toggleGenre = useCallback(
    (genre: string) => {
      const next = currentGenres.includes(genre)
        ? currentGenres.filter((g) => g !== genre)
        : [...currentGenres, genre];

      updateParams({
        genres: next.length > 0 ? next.join(",") : null,
      });
    },
    [currentGenres, updateParams]
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const next = currentTags.includes(tag)
        ? currentTags.filter((value) => value !== tag)
        : [...currentTags, tag];

      updateParams({
        tags: next.length > 0 ? next.join(",") : null,
      });
    },
    [currentTags, updateParams]
  );

  const toggleVibe = useCallback(
    (vibe: string) => {
      const next = currentVibes.includes(vibe)
        ? currentVibes.filter((value) => value !== vibe)
        : [...currentVibes, vibe];

      updateParams({
        vibes: next.length > 0 ? next.join(",") : null,
      });
    },
    [currentVibes, updateParams]
  );

  const setMoodFilter = useCallback(
    (mood: string) => {
      updateParams({
        mood: currentMood === mood ? null : mood,
      });
      setMoodDropdownOpen(false);
    },
    [currentMood, updateParams]
  );

  const setDateFilter = useCallback(
    (date: string) => {
      updateParams({
        date: currentDateFilter === date ? null : date,
      });
      setDateDropdownOpen(false);
    },
    [currentDateFilter, updateParams]
  );

  const toggleFreeOnly = useCallback(() => {
    updateParams({
      free: currentFreeOnly ? null : "1",
      price: currentFreeOnly ? null : "free",
    });
  }, [currentFreeOnly, updateParams]);

  const clearAll = useCallback(() => {
    updateParams({
      categories: null,
      genres: null,
      date: null,
      free: null,
      price: null,
      tags: null,
      vibes: null,
      subcategories: null,
      mood: null,
    });
  }, [updateParams]);

  // Close dropdowns on outside click.
  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setCategoryDropdownOpen(false);
      }
      if (
        dateDropdownRef.current &&
        !dateDropdownRef.current.contains(event.target as Node)
      ) {
        setDateDropdownOpen(false);
      }
      if (
        moodDropdownRef.current &&
        !moodDropdownRef.current.contains(event.target as Node)
      ) {
        setMoodDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Fetch genre options when exactly one category is selected.
  useEffect(() => {
    const prev = prevCategoriesRef.current;
    prevCategoriesRef.current = currentCategories;

    if (currentCategories.length === 1) {
      const category = currentCategories[0];
      fetch(`/api/genres?category=${encodeURIComponent(category)}`)
        .then((res) => res.json())
        .then((data) => {
          setGenreOptions(data.genres || []);
        })
        .catch(() => setGenreOptions([]));
      return;
    }

    if (prev.length === 1 && currentGenres.length > 0) {
      updateParams({ genres: null });
    }
  }, [currentCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="hidden sm:block relative z-[140]">
        <div className={`${variant === "compact" ? "py-1.5" : "py-2"}`}>
          <div className={`flex items-center flex-wrap ${variant === "compact" ? "gap-1.5" : "gap-2"}`}>
            <div className="relative" ref={categoryDropdownRef}>
              <button
                onClick={() => {
                  const wasOpen = categoryDropdownOpen;
                  closeAllDropdowns();
                  setCategoryDropdownOpen(!wasOpen);
                }}
                className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all border ${
                  currentCategories.length > 0
                    ? "bg-[var(--action-primary)] text-[var(--btn-primary-text)] border-[var(--action-primary)]/40 shadow-sm"
                    : "bg-[var(--dusk)]/80 text-[var(--cream)]/80 border-[var(--twilight)]/80 hover:text-[var(--cream)]"
                }`}
              >
                {categoryLabel}
                <svg className={`w-3 h-3 transition-transform ${categoryDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {categoryDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 max-h-80 overflow-y-auto rounded-xl border border-[var(--twilight)] shadow-xl z-[220] bg-[var(--void)]">
                  <div className="p-2">
                    {CATEGORIES.map((cat) => {
                      const isActive = currentCategories.includes(cat.value);
                      return (
                        <button
                          key={cat.value}
                          onClick={() => toggleCategory(cat.value)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-[var(--action-primary)] text-[var(--btn-primary-text)]"
                              : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                          }`}
                        >
                          <CategoryIcon
                            type={cat.value}
                            size={14}
                            className={isActive ? "text-[var(--void)]" : "text-[var(--category-color,var(--muted))]"}
                            glow={isActive ? "none" : "subtle"}
                          />
                          <span className="truncate">{cat.label}</span>
                          {isActive && (
                            <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {variant === "full" && (
              <div className="relative" ref={dateDropdownRef}>
                <button
                  onClick={() => {
                    const wasOpen = dateDropdownOpen;
                    closeAllDropdowns();
                    setDateDropdownOpen(!wasOpen);
                  }}
                  className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all border ${
                    currentDateFilter
                      ? "bg-[var(--gold)] text-[var(--void)] border-[var(--gold)]/40 shadow-sm"
                      : "bg-[var(--dusk)]/80 text-[var(--cream)]/80 border-[var(--twilight)]/80 hover:text-[var(--cream)]"
                  }`}
                >
                  {dateFilterLabel}
                  <svg className={`w-3 h-3 transition-transform ${dateDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dateDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-44 rounded-xl border border-[var(--twilight)] shadow-xl z-[220] bg-[var(--void)]">
                    <div className="p-2">
                      {DATE_OPTIONS.map((df) => {
                        const isActive = currentDateFilter === df.value;
                        return (
                          <button
                            key={df.value}
                            onClick={() => setDateFilter(df.value)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-colors ${
                              isActive
                                ? "bg-[var(--gold)] text-[var(--void)]"
                                : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                            }`}
                          >
                            {df.label}
                          </button>
                        );
                      })}
                      <div className="h-px bg-[var(--twilight)] my-1" />
                      <button
                        onClick={() => dateInputRef.current?.showPicker()}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-colors ${
                          isSpecificDate
                            ? "bg-[var(--gold)] text-[var(--void)]"
                            : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {isSpecificDate ? formatDateLabel(currentDateFilter) : "Pick date"}
                      </button>
                      <input
                        ref={dateInputRef}
                        type="date"
                        className="sr-only"
                        min={new Date().toISOString().split("T")[0]}
                        value={isSpecificDate ? currentDateFilter : ""}
                        onChange={(e) => {
                          if (e.target.value) setDateFilter(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="relative" ref={moodDropdownRef}>
              <button
                onClick={() => {
                  const wasOpen = moodDropdownOpen;
                  closeAllDropdowns();
                  setMoodDropdownOpen(!wasOpen);
                }}
                className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all border ${
                  currentMood
                    ? "bg-[#7C3AED] text-[var(--cream)] border-[#7C3AED]/40 shadow-sm"
                    : "bg-[var(--dusk)]/80 text-[var(--cream)]/80 border-[var(--twilight)]/80 hover:text-[var(--cream)]"
                }`}
              >
                {moodLabel}
                <svg className={`w-3 h-3 transition-transform ${moodDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {moodDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 rounded-xl border border-[var(--twilight)] shadow-xl z-[220] bg-[var(--void)]">
                  <div className="p-2">
                    {MOOD_OPTIONS.map((mood) => {
                      const isActive = currentMood === mood.value;
                      return (
                        <button
                          key={mood.value}
                          onClick={() => setMoodFilter(mood.value)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-[#7C3AED] text-[var(--cream)]"
                              : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                          }`}
                        >
                          {mood.label}
                          {isActive && (
                            <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setMobileSheetOpen(true)}
              className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all border ${
                hasFilters
                  ? "bg-[var(--action-primary)] text-[var(--btn-primary-text)] border-[var(--action-primary)]/40 shadow-sm"
                  : "bg-[var(--twilight)]/70 text-[var(--cream)] border-[var(--twilight)]/80 hover:bg-[var(--twilight)]"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Filters
              {filterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-black/20 text-[10px] font-bold">
                  {filterCount}
                </span>
              )}
            </button>

            {hasFilters && (
              <button
                onClick={clearAll}
                className="btn-press flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-[11px] font-medium border border-[var(--twilight)]/85 bg-[var(--dusk)]/70 text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--soft)]/45 whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {visibleGenreOptions.length > 0 && (
        <div className="hidden sm:block">
          <div className="py-1.5">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              <span className="flex-shrink-0 text-[0.6rem] font-mono uppercase tracking-wider text-[var(--muted)] mr-1">Genre</span>
              {visibleGenreOptions.map((opt) => {
                const isActive = currentGenres.includes(opt.genre);
                return (
                  <button
                    key={opt.genre}
                    onClick={() => toggleGenre(opt.genre)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all border ${
                      isActive
                        ? "bg-[var(--action-primary)] text-[var(--btn-primary-text)] border-[var(--action-primary)]/40 shadow-sm"
                        : "bg-[var(--dusk)]/80 text-[var(--cream)]/70 border-[var(--twilight)]/60 hover:text-[var(--cream)]"
                    }`}
                  >
                    {formatGenre(opt.genre)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="sm:hidden">
        <div className={`${variant === "compact" ? "py-1.5" : "py-2"}`}>
          <div className="flex items-center gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide scroll-smooth">
            <button
              onClick={() => setMobileSheetOpen(true)}
              className={`flex-shrink-0 min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-full font-mono text-xs font-medium border transition-all ${
                hasFilters
                  ? "bg-[var(--action-primary)] text-[var(--btn-primary-text)] border-[var(--action-primary)]/40"
                  : "bg-[var(--twilight)] text-[var(--cream)] border-[var(--twilight)]"
              }`}
            >
              Filters
              {hasFilters && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-black/20 text-[10px] font-bold">
                  {filterCount}
                </span>
              )}
            </button>

            {variant === "full" && (
              <button
                onClick={() => setDateFilter("weekend")}
                className={`flex-shrink-0 min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-full font-mono text-xs font-medium transition-all ${
                  currentDateFilter === "weekend"
                    ? "bg-[var(--gold)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--cream)]"
                }`}
              >
                Weekend
              </button>
            )}

          </div>
        </div>
      </div>

      <MobileFilterSheet
        isOpen={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        currentCategories={currentCategories}
        currentDateFilter={currentDateFilter}
        currentFreeOnly={currentFreeOnly}
        currentTags={currentTags}
        currentVibes={currentVibes}
        currentMood={currentMood}
        tagGroups={TAG_GROUP_OPTIONS}
        vibeGroups={VIBE_GROUP_OPTIONS}
        moodOptions={MOOD_OPTIONS}
        onToggleCategory={toggleCategory}
        onSetDateFilter={setDateFilter}
        onToggleFreeOnly={toggleFreeOnly}
        onToggleTag={toggleTag}
        onToggleVibe={toggleVibe}
        onSetMood={setMoodFilter}
        onClearAll={clearAll}
      />
    </>
  );
}
