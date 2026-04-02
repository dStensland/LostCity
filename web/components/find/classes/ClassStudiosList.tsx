"use client";

import { useState, useCallback, useRef } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import FilterChip from "@/components/filters/FilterChip";
import { ClassStudioCard } from "./ClassStudioCard";
import type { StudioSummary as CardStudioSummary } from "./ClassStudioCard";
import { CLASS_CATEGORIES } from "@/lib/class-categories";
import type { StudiosResponse, StudioSummary } from "@/lib/hooks/useClassesData";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassStudiosListProps {
  studios: StudiosResponse | null;
  portalSlug: string;
  loading: boolean;
  error: string | null;
  category: string | null;
  dateWindow: string | null;
  skillLevel: string | null;
  search: string | null;
  onFilterChange: (params: Record<string, string | null>) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATE_WINDOW_OPTIONS = [
  { label: "This Week", value: null },
  { label: "Weekend", value: "weekend" },
  { label: "Next 2 Weeks", value: "2weeks" },
  { label: "All Upcoming", value: "all" },
] as const;

const SKILL_LEVEL_OPTIONS = [
  { label: "All Levels", value: null },
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
] as const;

// ---------------------------------------------------------------------------
// Mapping helper: hook StudioSummary → card StudioSummary
// ---------------------------------------------------------------------------

function toCardStudio(s: StudioSummary): CardStudioSummary {
  return {
    venueId: s.place_id,
    venueSlug: s.slug,
    name: s.name,
    neighborhood: s.neighborhood,
    imageUrl: s.image_url,
    primaryCategory: s.categories[0] ?? null,
    classCount: s.class_count,
    nextClassName: s.next_class?.title ?? null,
    nextClassDate: s.next_class?.start_date ?? null,
    nextClassTime: s.next_class?.start_time ?? null,
  };
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function StudioSkeleton() {
  return (
    <div className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 p-3 sm:p-4 flex items-start gap-3 sm:gap-4 animate-pulse">
      {/* Image shimmer */}
      <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-[var(--twilight)]" />
      {/* Text shimmers */}
      <div className="flex-1 min-w-0 space-y-2 pt-1">
        <div className="h-4 bg-[var(--twilight)] rounded w-3/5" />
        <div className="h-3 bg-[var(--twilight)] rounded w-2/5" />
        <div className="h-3 bg-[var(--twilight)] rounded w-4/5" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ClassStudiosList = function ClassStudiosList({
  studios,
  portalSlug,
  loading,
  error,
  category,
  dateWindow,
  skillLevel,
  search,
  onFilterChange,
}: ClassStudiosListProps) {
  const [localSearch, setLocalSearch] = useState(search ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search — avoid hammering the API on every keystroke
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onFilterChange({ search: value.trim() || null });
      }, 350);
    },
    [onFilterChange]
  );

  const handleSearchClear = useCallback(() => {
    setLocalSearch("");
    onFilterChange({ search: null });
  }, [onFilterChange]);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onFilterChange({ search: localSearch.trim() || null });
    },
    [localSearch, onFilterChange]
  );

  const hasFilters = !!(category || dateWindow || skillLevel || search);
  const totalCount = studios?.total_count ?? 0;
  const showFilterChips = totalCount >= 10;

  // Reset all filters
  const handleReset = useCallback(() => {
    setLocalSearch("");
    onFilterChange({ category: null, window: null, skillLevel: null, search: null });
  }, [onFilterChange]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      {/* ---- Search bar ---- */}
      <form onSubmit={handleSearchSubmit}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] focus-within:border-[var(--coral)] transition-colors">
          <MagnifyingGlass
            size={16}
            weight="bold"
            className="shrink-0 text-[var(--muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search classes or studios..."
            className="flex-1 bg-transparent text-[var(--cream)] placeholder:text-[var(--muted)] text-sm focus:outline-none"
            aria-label="Search classes"
          />
          {localSearch && (
            <button
              type="button"
              onClick={handleSearchClear}
              className="shrink-0 text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
              aria-label="Clear search"
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>
      </form>

      {/* ---- Filter chip rows (only when enough data) ---- */}
      {showFilterChips && (
        <div className="space-y-2">
          {/* Row 1: Category chips */}
          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1">
              {/* "All" chip */}
              <FilterChip
                label="All"
                variant="category"
                active={!category}
                count={totalCount}
                onClick={() => onFilterChange({ category: null })}
              />

              {/* Category chips — always visible, dimmed when count is 0 */}
              {CLASS_CATEGORIES.map((cat) => {
                const count =
                  studios?.category_counts?.[cat.slug] ??
                  cat.apiValues.reduce(
                    (sum, v) => sum + (studios?.category_counts?.[v] ?? 0),
                    0
                  );
                const isActive = category === cat.slug;
                const isDimmed = count === 0 && !isActive;
                return (
                  <div
                    key={cat.slug}
                    className={isDimmed ? "opacity-40" : undefined}
                  >
                    <FilterChip
                      label={cat.label}
                      variant="category"
                      active={isActive}
                      count={count}
                      onClick={() =>
                        onFilterChange({
                          category: isActive ? null : cat.slug,
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
            {/* Fade-out gradient hint */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--void)] to-transparent" />
          </div>

          {/* Row 2: Date window + separator + skill level */}
          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1">
              {/* Date window chips */}
              {DATE_WINDOW_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.label}
                  label={opt.label}
                  variant="date"
                  active={dateWindow === opt.value}
                  onClick={() => onFilterChange({ window: opt.value })}
                />
              ))}

              {/* Separator */}
              <div className="w-px h-6 bg-[var(--twilight)] shrink-0" />

              {/* Skill level chips */}
              {SKILL_LEVEL_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.label}
                  label={opt.label}
                  variant="default"
                  active={skillLevel === opt.value}
                  onClick={() => onFilterChange({ skillLevel: opt.value })}
                />
              ))}
            </div>
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--void)] to-transparent" />
          </div>
        </div>
      )}

      {/* ---- Loading state ---- */}
      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <StudioSkeleton key={i} />
          ))}
        </div>
      )}

      {/* ---- Error state ---- */}
      {!loading && error && (
        <div className="py-8 text-center">
          <p className="font-mono text-xs text-[var(--coral)]">{error}</p>
        </div>
      )}

      {/* ---- Empty states ---- */}
      {!loading && !error && studios && studios.studios.length === 0 && (
        <div className="py-12 text-center space-y-3">
          {search ? (
            <>
              <p className="text-sm text-[var(--soft)]">
                No classes matching &ldquo;{search}&rdquo;.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-mono text-[var(--coral)] hover:opacity-80 transition-opacity"
              >
                Clear search
              </button>
            </>
          ) : hasFilters ? (
            <>
              <p className="text-sm text-[var(--soft)]">
                No classes found for these filters. Try a broader date range or
                different category.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs font-mono text-[var(--coral)] hover:opacity-80 transition-opacity"
              >
                Reset filters
              </button>
            </>
          ) : (
            <p className="text-sm text-[var(--soft)]">
              Classes coming soon. Know a studio that should be listed?
            </p>
          )}
        </div>
      )}

      {/* ---- No data at all (null studios, not loading) ---- */}
      {!loading && !error && !studios && (
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--soft)]">
            Classes coming soon. Know a studio that should be listed?
          </p>
        </div>
      )}

      {/* ---- Studio card list ---- */}
      {!loading && !error && studios && studios.studios.length > 0 && (
        <div className="space-y-3">
          {studios.studios.map((studio) => (
            <ClassStudioCard
              key={studio.place_id}
              studio={toCardStudio(studio)}
              portalSlug={portalSlug}
              onStudioClick={(slug) => onFilterChange({ studio: slug })}
            />
          ))}
        </div>
      )}
    </div>
  );
};

