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
const STARTING_SOON_WINDOW_HOURS = 6;

interface Props {
  initialEvents?: EventWithLocation[];
  initialTotal?: number;
  hasActiveFilters?: boolean;
  portalId?: string;
  portalExclusive?: boolean;
  portalSlug?: string;
  density?: "comfortable" | "compact";
}

function getEventStartAt(event: EventWithLocation): Date | null {
  if (!event.start_date) return null;
  const time = event.start_time || "19:00:00";
  const iso = `${event.start_date}T${time}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getQuickPickScore(event: EventWithLocation, now: Date): number {
  let score = 0;
  const startAt = getEventStartAt(event);
  if (event.is_live) score += 80;
  if (event.is_featured) score += 55;
  if (event.is_trending) score += 35;
  if (event.reasons?.length) score += Math.min(event.reasons.length * 8, 24);
  if (typeof event.score === "number") score += Math.min(Math.max(event.score, 0), 30);
  if (event.going_count && event.going_count > 0) score += Math.min(event.going_count, 20);
  if (event.interested_count && event.interested_count > 0) score += Math.min(event.interested_count / 2, 16);

  if (startAt) {
    const diffMs = startAt.getTime() - now.getTime();
    if (diffMs >= 0 && diffMs <= STARTING_SOON_WINDOW_HOURS * 60 * 60 * 1000) score += 26;
    if (diffMs < 0) score -= 20;
  }

  return score;
}

function isStartingSoon(event: EventWithLocation, now: Date): boolean {
  if (event.is_live) return true;
  const startAt = getEventStartAt(event);
  if (!startAt) return false;
  const diffMs = startAt.getTime() - now.getTime();
  return diffMs >= 0 && diffMs <= STARTING_SOON_WINDOW_HOURS * 60 * 60 * 1000;
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
  // Enable smart defaults and persistence for better UX
  const { hasActiveFilters, filters } = useEventFilters({
    enableSmartDefaults: true,
    enablePersistence: true,
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
  const now = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => {
    const yyyy = now.getFullYear();
    const mm = `${now.getMonth() + 1}`.padStart(2, "0");
    const dd = `${now.getDate()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, [now]);
  const tonightCount = useMemo(
    () => displayEvents.filter((event) => event.start_date === todayIso || event.is_live).length,
    [displayEvents, todayIso]
  );
  const freeCount = useMemo(
    () => displayEvents.filter((event) => event.is_free).length,
    [displayEvents]
  );
  const startingSoonEvents = useMemo(
    () => displayEvents.filter((event) => isStartingSoon(event, now)).slice(0, 5),
    [displayEvents, now]
  );
  const quickPicks = useMemo(() => {
    const ranked = [...displayEvents].sort((a, b) => {
      const scoreDiff = getQuickPickScore(b, now) - getQuickPickScore(a, now);
      if (scoreDiff !== 0) return scoreDiff;
      const aStart = getEventStartAt(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bStart = getEventStartAt(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aStart - bStart;
    });
    return ranked.slice(0, 4);
  }, [displayEvents, now]);
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
      <section className="mb-3 rounded-2xl border border-[var(--twilight)]/70 bg-gradient-to-b from-[var(--night)]/92 to-[var(--void)]/86 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[var(--muted)]">
              Decision Brief
            </p>
            <h3 className="text-[var(--cream)] font-semibold text-sm sm:text-base">Start with the best options first</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--twilight)]/70 bg-[var(--dusk)]/70 px-2.5 py-1 font-mono text-[0.65rem] text-[var(--soft)]">
              {displayEvents.length} loaded
            </span>
            <span className="rounded-full border border-[var(--twilight)]/70 bg-[var(--dusk)]/70 px-2.5 py-1 font-mono text-[0.65rem] text-[var(--soft)]">
              {tonightCount} tonight
            </span>
            <span className="rounded-full border border-[var(--twilight)]/70 bg-[var(--dusk)]/70 px-2.5 py-1 font-mono text-[0.65rem] text-[var(--soft)]">
              {freeCount} free
            </span>
            {startingSoonEvents.length > 0 && (
              <span className="rounded-full border border-[var(--coral)]/55 bg-[var(--coral)]/12 px-2.5 py-1 font-mono text-[0.65rem] text-[var(--coral)]">
                {startingSoonEvents.length} starting soon
              </span>
            )}
          </div>
        </div>

        {quickPicks.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {quickPicks.map((event) => {
              const href = portalSlug ? `/${portalSlug}/events/${event.id}` : `/events/${event.id}`;
              const primaryMeta = event.start_time || (event.is_all_day ? "All day" : "Time TBA");
              const venue = event.venue?.name || "Venue TBA";
              return (
                <Link
                  key={event.id}
                  href={href}
                  className="rounded-xl border border-[var(--twilight)]/65 bg-[var(--night)]/70 px-3 py-2 transition-colors hover:border-[var(--coral)]/55 hover:bg-[var(--night)]"
                >
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[var(--muted)]">
                    Top Pick
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-sm font-medium text-[var(--cream)]">{event.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-[0.72rem] text-[var(--soft)]">
                    {primaryMeta} · {venue}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

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
