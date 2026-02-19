"use client";

import React, { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AnimatedEventList from "./AnimatedEventList";
import { EventCardSkeletonList } from "./EventCardSkeleton";
import PullToRefresh from "./PullToRefresh";
import SmartEmptyState from "./SmartEmptyState";
import { useTimeline } from "@/lib/hooks/useTimeline";
import { useEventFilters } from "@/lib/hooks/useEventFilters";
import { useFriendsGoing } from "@/lib/hooks/use-friends-going";
import type { EventWithLocation } from "@/lib/search";

// Max events to display (prevent memory issues)
const MAX_EVENTS = 500;
const INITIAL_VISIBLE_EVENTS = 40;
const VISIBLE_EVENTS_STEP = 30;

interface Props {
  initialEvents?: EventWithLocation[];
  initialTotal?: number;
  hasActiveFilters?: boolean;
  portalId?: string;
  portalExclusive?: boolean;
  portalSlug?: string;
  density?: "comfortable" | "compact";
}

/**
 * EventList component - simplified with React Query and cursor-based pagination
 *
 * Previously ~965 lines, now ~250 lines.
 * All state management is handled by useEventsList hook (React Query).
 * Animations handled by AnimatedEventList (Framer Motion).
 */
export default function EventList({
  initialEvents,
  portalId,
  portalExclusive,
  portalSlug,
  density = "comfortable",
}: Props) {
  const pathname = usePathname();
  const loaderRef = useRef<HTMLDivElement>(null);

  // Unified timeline hook — events + festivals in one stream
  // Enable smart defaults, but avoid cross-view filter persistence.
  const { hasActiveFilters, filters } = useEventFilters({
    enableSmartDefaults: true,
    enablePersistence: false,
  });
  const {
    events,
    festivals,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    hasMore,
    error,
    loadMore,
    refresh,
  } = useTimeline({
    portalId,
    portalExclusive,
    initialData: initialEvents,
  });
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_EVENTS);
  const [hasUserExpanded, setHasUserExpanded] = useState(false);

  // Friends going data
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const { getFriendsForEvent } = useFriendsGoing(eventIds);

  // Limit displayed events
  const displayEvents = useMemo(() => {
    return events.length > MAX_EVENTS ? events.slice(0, MAX_EVENTS) : events;
  }, [events]);
  const visibleEvents = useMemo(() => {
    return displayEvents.slice(0, visibleCount);
  }, [displayEvents, visibleCount]);
  const hiddenLoadedCount = Math.max(displayEvents.length - visibleEvents.length, 0);
  const canRevealLoaded = hiddenLoadedCount > 0;
  const allowAutoPagination = (hasActiveFilters || hasUserExpanded) && !canRevealLoaded;
  const filtersResetKey = useMemo(() => {
    return [
      filters.search || "",
      (filters.categories || []).join(","),
      (filters.tags || []).join(","),
      (filters.genres || []).join(","),
      (filters.vibes || []).join(","),
      (filters.neighborhoods || []).join(","),
      filters.price || "",
      filters.date || "",
      filters.mood || "",
    ].join("|");
  }, [filters]);

  const hasReachedMax = events.length >= MAX_EVENTS;

  useEffect(() => {
    const initial = hasActiveFilters ? 60 : INITIAL_VISIBLE_EVENTS;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional UX reset when filter signature changes
    setVisibleCount(initial);
    setHasUserExpanded(false);
  }, [filtersResetKey, hasActiveFilters]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const currentLoaderRef = loaderRef.current;
    if (!currentLoaderRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && allowAutoPagination && hasMore && !isFetchingNextPage && !hasReachedMax) {
          loadMore();
        }
      },
      {
        threshold: 0,
        rootMargin: "300px", // Trigger earlier for smooth loading
      }
    );

    observer.observe(currentLoaderRef);

    return () => observer.disconnect();
  }, [allowAutoPagination, hasMore, isFetchingNextPage, loadMore, hasReachedMax]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Popular categories for suggestions
  const suggestedCategories = [
    { value: "music", label: "Music" },
    { value: "comedy", label: "Comedy" },
    { value: "art", label: "Art" },
    { value: "food_drink", label: "Food & Drink" },
    { value: "film", label: "Film" },
  ];

  // Show loading skeleton during initial load
  if (isLoading && events.length === 0) {
    return (
      <div className="py-4">
        <EventCardSkeletonList count={6} />
      </div>
    );
  }

  // Empty state - use smart empty state when filters are active
  if (events.length === 0 && !isLoading) {
    // Smart empty state with suggestions when filters are active
    if (hasActiveFilters) {
      return <SmartEmptyState filters={filters} portalSlug={portalSlug} />;
    }

    // Generic empty state when no filters
    return (
      <div className="text-center py-16">
        {/* Illustrated empty state with gentle animation */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center relative overflow-hidden animate-float">
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--coral)]/30 animate-ping-slow" />
          <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-[var(--coral)]/30 animate-ping-slow" />
          <svg className="w-10 h-10 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <h3 className="text-[var(--cream)] text-xl font-medium mb-2">
          The calendar is empty
        </h3>

        <p className="text-[var(--muted)] text-sm mb-6 max-w-xs mx-auto">
          We&apos;re always adding fresh events. Check back soon or explore what&apos;s out there!
        </p>

        <div className="pt-4 border-t border-[var(--twilight)]/30">
          <p className="text-[var(--muted)]/60 text-xs mb-3 uppercase tracking-wider font-mono">
            Or try these
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestedCategories.map((cat) => (
              <Link
                key={cat.value}
                href={`${pathname}?categories=${cat.value}`}
                className="px-3 py-1.5 rounded-full bg-[var(--twilight)]/40 text-[var(--muted)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-all text-sm border border-[var(--twilight)] hover:border-[var(--coral)]/30 hover:shadow-sm"
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={isLoading || isRefetching}>
      {/* Animated event list */}
      <AnimatedEventList
        events={visibleEvents}
        standaloneFestivals={festivals}
        portalSlug={portalSlug}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        isRefetching={isRefetching}
        getFriendsForEvent={getFriendsForEvent}
        collapseFestivals={!filters.search}
        collapseFestivalPrograms={!filters.search}
        density={density}
      />

      {(canRevealLoaded || (!canRevealLoaded && hasMore && !error && !hasReachedMax && !allowAutoPagination)) && (
        <div className="py-2 flex justify-center">
          <button
            onClick={() => {
              if (canRevealLoaded) {
                setVisibleCount((prev) => Math.min(prev + VISIBLE_EVENTS_STEP, displayEvents.length));
                setHasUserExpanded(true);
                return;
              }
              loadMore();
              setHasUserExpanded(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--twilight)]/75 bg-[var(--night)]/75 text-[var(--cream)] hover:border-[var(--coral)]/50 hover:bg-[var(--night)] transition-colors font-mono text-xs"
          >
            {canRevealLoaded
              ? `Show ${Math.min(VISIBLE_EVENTS_STEP, hiddenLoadedCount)} more`
              : "Load more results"}
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="py-6 text-center">
          <p className="text-[var(--muted)] text-sm mb-3">{error}</p>
          <button
            onClick={() => loadMore()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)]/30 text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors font-mono text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try again
          </button>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {allowAutoPagination && hasMore && !error && !hasReachedMax && (
        <div
          ref={loaderRef}
          className="h-20"
          aria-hidden="true"
        />
      )}

      {/* Max events reached indicator */}
      {hasReachedMax && (
        <div className="py-6 text-center">
          <span className="font-mono text-xs text-[var(--muted)]/60">
            Showing first {MAX_EVENTS} events. Use filters to narrow your search.
          </span>
        </div>
      )}

      {/* End of list indicator */}
      {!hasMore && !error && events.length > 0 && !hasReachedMax && (
        <div className="py-6 text-center">
          <span className="font-mono text-xs text-[var(--muted)]/40">
            That&apos;s everything for now
          </span>
        </div>
      )}
    </PullToRefresh>
  );
}
