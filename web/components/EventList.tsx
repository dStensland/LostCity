"use client";

import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AnimatedEventList from "./AnimatedEventList";
import { EventCardSkeletonList } from "./EventCardSkeleton";
import PullToRefresh from "./PullToRefresh";
import { useEventsList } from "@/lib/hooks/useEventsList";
import { useEventFilters } from "@/lib/hooks/useEventFilters";
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
        {/* Illustrated empty state with gentle animation */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center relative overflow-hidden animate-float">
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--coral)]/30 animate-ping-slow" />
          <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-[var(--coral)]/30 animate-ping-slow" style={{ animationDelay: "1s" }} />
          <svg className="w-10 h-10 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <h3 className="text-[var(--cream)] text-xl font-medium mb-2">
          {hasActiveFilters ? "Nothing matches that vibe" : "The calendar is empty"}
        </h3>

        <p className="text-[var(--muted)] text-sm mb-6 max-w-xs mx-auto">
          {hasActiveFilters
            ? "Try broadening your search or exploring something new"
            : "We're always adding fresh events. Check back soon or explore what's out there!"}
        </p>

        {hasActiveFilters ? (
          <div className="space-y-4">
            <Link
              href={pathname}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] transition-all hover:scale-105 font-mono text-sm font-medium shadow-lg shadow-[var(--coral)]/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </Link>

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
        ) : (
          <div className="space-y-4">
            <p className="text-[var(--muted)]/60 text-sm font-medium">
              What are you feeling?
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedCategories.map((cat) => (
                <Link
                  key={cat.value}
                  href={`${pathname}?categories=${cat.value}`}
                  className="px-4 py-2 rounded-lg bg-[var(--twilight)]/40 text-[var(--muted)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-all text-sm border border-[var(--twilight)] hover:border-[var(--coral)]/30 hover:shadow-md hover:scale-105"
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
