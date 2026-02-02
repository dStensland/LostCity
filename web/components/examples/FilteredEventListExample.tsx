/**
 * Example: Filtered Event List with All UX Improvements
 *
 * This example demonstrates how to integrate:
 * - SearchResultsHeader for result count and "no results" state
 * - StickyFilterButton for mobile quick access
 * - MobileFilterSheet with haptic feedback
 * - Saved filters integration
 *
 * Copy this pattern when building filtered list views.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchResultsHeader } from "@/components/SearchResultsHeader";
import { StickyFilterButton } from "@/components/StickyFilterButton";
import { MobileFilterSheet } from "@/components/MobileFilterSheet";
import SavedFiltersMenu from "@/components/SavedFiltersMenu";

// Example event type (adjust to match your schema)
interface Event {
  id: string;
  title: string;
  category: string;
  start_date: string;
  price_min?: number;
}

interface FilteredEventListExampleProps {
  events: Event[];
  isLoading?: boolean;
}

export default function FilteredEventListExample({
  events,
  isLoading = false,
}: FilteredEventListExampleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse URL params for filters
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Get current filters from URL
  const categories = useMemo(
    () => searchParams.get("categories")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const dateFilter = searchParams.get("date") || "";
  const freeOnly = searchParams.get("free") === "true";
  const searchQuery = searchParams.get("search") || "";

  // Calculate filter count
  const filterCount = useMemo(() => {
    let count = 0;
    if (categories.length > 0) count += categories.length;
    if (dateFilter) count += 1;
    if (freeOnly) count += 1;
    return count;
  }, [categories, dateFilter, freeOnly]);

  const hasFilters = filterCount > 0 || !!searchQuery;

  // Filter update handlers
  const updateFilters = useCallback(
    (updates: {
      categories?: string[];
      date?: string;
      free?: boolean;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.categories !== undefined) {
        if (updates.categories.length > 0) {
          params.set("categories", updates.categories.join(","));
        } else {
          params.delete("categories");
        }
      }

      if (updates.date !== undefined) {
        if (updates.date) {
          params.set("date", updates.date);
        } else {
          params.delete("date");
        }
      }

      if (updates.free !== undefined) {
        if (updates.free) {
          params.set("free", "true");
        } else {
          params.delete("free");
        }
      }

      // Reset pagination when filters change
      params.delete("page");

      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;

      router.push(newUrl, { scroll: false });
    },
    [router, searchParams]
  );

  const handleToggleCategory = useCallback(
    (category: string) => {
      const newCategories = categories.includes(category)
        ? categories.filter(c => c !== category)
        : [...categories, category];
      updateFilters({ categories: newCategories });
    },
    [categories, updateFilters]
  );

  const handleSetDateFilter = useCallback(
    (date: string) => {
      updateFilters({ date: date === dateFilter ? "" : date });
    },
    [dateFilter, updateFilters]
  );

  const handleToggleFreeOnly = useCallback(() => {
    updateFilters({ free: !freeOnly });
  }, [freeOnly, updateFilters]);

  const handleClearAll = useCallback(() => {
    const params = new URLSearchParams();
    // Preserve search query if it exists
    if (searchQuery) {
      params.set("search", searchQuery);
    }
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    router.push(newUrl, { scroll: false });
  }, [router, searchQuery]);

  // Suggestions for "no results" state
  const suggestions = useMemo(() => [
    {
      text: "Browse all events",
      onClick: () => router.push(window.location.pathname),
    },
    {
      text: "Try 'tonight'",
      onClick: () => {
        const params = new URLSearchParams();
        params.set("date", "today");
        router.push(`${window.location.pathname}?${params.toString()}`);
      },
    },
    {
      text: "Show free events",
      onClick: () => updateFilters({ free: true }),
    },
  ], [router, updateFilters]);

  return (
    <div className="space-y-4">
      {/* Desktop: Saved filters menu */}
      <div className="hidden md:flex justify-between items-center">
        <h1 className="text-2xl font-bold">Events</h1>
        <SavedFiltersMenu variant="full" />
      </div>

      {/* Results header with count and "no results" state */}
      <SearchResultsHeader
        resultCount={events.length}
        isLoading={isLoading}
        query={searchQuery}
        hasFilters={hasFilters}
        onClearFilters={handleClearAll}
        suggestions={suggestions}
      />

      {/* Event grid/list */}
      {!isLoading && events.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map(event => (
            <div
              key={event.id}
              className="p-4 border border-[var(--twilight)] rounded-lg hover:border-[var(--coral)] transition-colors"
            >
              <h3 className="font-semibold text-[var(--cream)]">{event.title}</h3>
              <p className="text-sm text-[var(--soft)]">{event.start_date}</p>
              {event.price_min === 0 && (
                <span className="inline-block mt-2 px-2 py-1 text-xs bg-[var(--neon-green)]/20 text-[var(--neon-green)] rounded">
                  Free
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mobile: Sticky filter button (appears on scroll) */}
      <StickyFilterButton
        filterCount={filterCount}
        resultCount={events.length}
        onClick={() => setShowFilterSheet(true)}
        scrollThreshold={200}
      />

      {/* Mobile: Filter sheet */}
      <MobileFilterSheet
        isOpen={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        currentCategories={categories}
        currentDateFilter={dateFilter}
        currentFreeOnly={freeOnly}
        onToggleCategory={handleToggleCategory}
        onSetDateFilter={handleSetDateFilter}
        onToggleFreeOnly={handleToggleFreeOnly}
        onClearAll={handleClearAll}
        resultCount={events.length}
      />
    </div>
  );
}
