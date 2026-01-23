"use client";

import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AnimatedEventList from "./AnimatedEventList";
import { EventCardSkeletonList } from "./EventCardSkeleton";
import PullToRefresh from "./PullToRefresh";
import { useEventsList } from "@/lib/hooks/useEventsList";
import { useEventFilters } from "@/lib/hooks/useEventFilters";
import { useLiveEventCount } from "@/lib/hooks/useLiveEvents";
import { useFriendsGoing } from "@/lib/use-friends-going";
import type { EventWithLocation } from "@/lib/search";

// Max events to display (prevent memory issues)
const MAX_EVENTS = 500;

interface Props {
  initialEvents?: EventWithLocation[];
  initialTotal?: number;
  hasActiveFilters?: boolean;
  portalId?: string;
  portalExclusive?: boolean;
  portalSlug?: string;
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
}: Props) {
  const pathname = usePathname();
  const loaderRef = useRef<HTMLDivElement>(null);

  // Use the new hooks
  const { hasActiveFilters } = useEventFilters();
  const {
    events,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    hasMore,
    error,
    loadMore,
    refresh,
  } = useEventsList({
    portalId,
    portalExclusive,
    initialData: initialEvents,
  });

  // Live events count for banner
  const liveEventCount = useLiveEventCount();

  // Friends going data
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const { getFriendsForEvent } = useFriendsGoing(eventIds);

  // Limit displayed events
  const displayEvents = useMemo(() => {
    return events.length > MAX_EVENTS ? events.slice(0, MAX_EVENTS) : events;
  }, [events]);

  const hasReachedMax = events.length >= MAX_EVENTS;

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const currentLoaderRef = loaderRef.current;
    if (!currentLoaderRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingNextPage && !hasReachedMax) {
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
  }, [hasMore, isFetchingNextPage, loadMore, hasReachedMax]);

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

  // Empty state
  if (events.length === 0 && !isLoading) {
    return (
      <div className="text-center py-16">
        {/* Illustrated empty state */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center relative overflow-hidden">
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--coral)]/30" />
          <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-[var(--neon-cyan)]/30" />
          <svg className="w-10 h-10 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <h3 className="text-[var(--cream)] text-xl font-medium mb-2">
          {hasActiveFilters ? "No matches found" : "No upcoming events"}
        </h3>

        <p className="text-[var(--muted)] text-sm mb-6 max-w-xs mx-auto">
          {hasActiveFilters
            ? "Try adjusting your filters or exploring a different category"
            : "We're still discovering events. Check back soon!"}
        </p>

        {hasActiveFilters ? (
          <div className="space-y-4">
            <Link
              href={pathname}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] transition-colors font-mono text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear all filters
            </Link>

            <div className="pt-4 border-t border-[var(--twilight)]/30">
              <p className="text-[var(--muted)]/60 text-xs mb-3 uppercase tracking-wider font-mono">
                Try exploring
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedCategories.map((cat) => (
                  <Link
                    key={cat.value}
                    href={`${pathname}?categories=${cat.value}`}
                    className="px-3 py-1.5 rounded-full bg-[var(--twilight)]/40 text-[var(--muted)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-all text-sm border border-[var(--twilight)]"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-[var(--muted)]/60 text-sm">
              Explore what&apos;s happening in your city
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedCategories.map((cat) => (
                <Link
                  key={cat.value}
                  href={`${pathname}?categories=${cat.value}`}
                  className="px-4 py-2 rounded-lg bg-[var(--twilight)]/40 text-[var(--muted)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-all text-sm border border-[var(--twilight)] hover:border-[var(--coral)]/30"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={isLoading || isRefetching}>
      {/* Live Events Banner */}
      {liveEventCount > 0 && (
        <Link
          href="/happening-now"
          className="group flex items-center gap-3 mb-5 px-4 py-3.5 rounded-xl bg-gradient-to-r from-[var(--neon-red)]/15 via-[var(--neon-magenta)]/10 to-[var(--neon-cyan)]/15 border border-[var(--neon-red)]/30 hover:border-[var(--neon-red)]/50 transition-all hover:shadow-[0_0_20px_rgba(255,90,90,0.1)]"
        >
          <span className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[var(--neon-red)] shadow-[0_0_8px_var(--neon-red)]" />
          </span>
          <div className="flex-1">
            <span className="font-medium text-[var(--cream)]">
              {liveEventCount} {liveEventCount === 1 ? "thing" : "things"} happening right now
            </span>
            <span className="hidden sm:inline text-[var(--muted)] text-sm ml-2">
              · tap to see what&apos;s live
            </span>
          </div>
          <svg
            className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--cream)] group-hover:translate-x-1 transition-all"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* Animated event list */}
      <AnimatedEventList
        events={displayEvents}
        portalSlug={portalSlug}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        isRefetching={isRefetching}
        getFriendsForEvent={getFriendsForEvent}
      />

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
      {hasMore && !error && !hasReachedMax && (
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
