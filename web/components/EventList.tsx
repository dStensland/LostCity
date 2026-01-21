"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import Link from "next/link";
import EventCard from "./EventCard";
import EventGroup from "./EventGroup";
import { EventCardSkeletonList } from "./EventCardSkeleton";
import type { EventWithLocation } from "@/lib/search";
import { useLiveEventCount } from "@/lib/hooks/useLiveEvents";
import { useFriendsGoing } from "@/lib/use-friends-going";

// Rollup thresholds
const VENUE_ROLLUP_THRESHOLD = 4;
const CATEGORY_ROLLUP_THRESHOLD = 5;
const ROLLUP_CATEGORIES = ["community"];

// Infinite scroll configuration
const DEBOUNCE_MS = 300;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // Exponential backoff base
const MAX_EVENTS = 500; // Prevent memory bloat

type DisplayItem =
  | { type: "event"; event: EventWithLocation }
  | { type: "venue-group"; venueId: number; venueName: string; neighborhood: string | null; events: EventWithLocation[] }
  | { type: "category-group"; categoryId: string; categoryName: string; events: EventWithLocation[] };

function groupEventsForDisplay(events: EventWithLocation[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  const usedEventIds = new Set<number>();

  // First pass: Find venue clusters
  const venueGroups = new Map<number, EventWithLocation[]>();
  for (const event of events) {
    if (event.venue?.id) {
      const existing = venueGroups.get(event.venue.id) || [];
      existing.push(event);
      venueGroups.set(event.venue.id, existing);
    }
  }

  // Create venue groups for venues with enough events
  for (const [venueId, venueEvents] of venueGroups) {
    if (venueEvents.length >= VENUE_ROLLUP_THRESHOLD) {
      const venue = venueEvents[0].venue!;
      items.push({
        type: "venue-group",
        venueId,
        venueName: venue.name,
        neighborhood: venue.neighborhood,
        events: venueEvents.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
      });
      venueEvents.forEach((e) => usedEventIds.add(e.id));
    }
  }

  // Second pass: Find category clusters (only for specific categories)
  const categoryGroups = new Map<string, EventWithLocation[]>();
  for (const event of events) {
    if (usedEventIds.has(event.id)) continue;
    if (event.category_id && ROLLUP_CATEGORIES.includes(event.category_id)) {
      const existing = categoryGroups.get(event.category_id) || [];
      existing.push(event);
      categoryGroups.set(event.category_id, existing);
    }
  }

  // Create category groups
  for (const [categoryId, catEvents] of categoryGroups) {
    if (catEvents.length >= CATEGORY_ROLLUP_THRESHOLD) {
      const categoryNames: Record<string, string> = {
        community: "Volunteer & Community",
      };
      items.push({
        type: "category-group",
        categoryId,
        categoryName: categoryNames[categoryId] || categoryId,
        events: catEvents.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
      });
      catEvents.forEach((e) => usedEventIds.add(e.id));
    }
  }

  // Third pass: Add remaining events as individual items
  for (const event of events) {
    if (!usedEventIds.has(event.id)) {
      items.push({ type: "event", event });
    }
  }

  // Sort by earliest start time (chronological order for both groups and individual events)
  items.sort((a, b) => {
    const getFirstTime = (item: DisplayItem): string => {
      if (item.type === "event") return item.event.start_time || "00:00";
      return item.events[0]?.start_time || "00:00";
    };
    return getFirstTime(a).localeCompare(getFirstTime(b));
  });

  return items;
}

function getDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

type TimePeriod = "morning" | "afternoon" | "evening" | "latenight";

function getTimePeriod(time: string | null): TimePeriod {
  if (!time) return "morning";
  const hour = parseInt(time.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "latenight";
}

const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  latenight: "Late Night",
};

const TIME_PERIOD_ICONS: Record<TimePeriod, React.ReactNode> = {
  morning: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  afternoon: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  evening: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  latenight: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
};

function groupByTimePeriod(items: DisplayItem[]): { period: TimePeriod; items: DisplayItem[] }[] {
  const groups: Map<TimePeriod, DisplayItem[]> = new Map();
  const periods: TimePeriod[] = ["morning", "afternoon", "evening", "latenight"];

  for (const item of items) {
    const time = item.type === "event" ? item.event.start_time : item.events[0]?.start_time;
    const period = getTimePeriod(time || null);
    if (!groups.has(period)) groups.set(period, []);
    groups.get(period)!.push(item);
  }

  // Return in order, only non-empty periods
  return periods
    .filter((p) => groups.has(p) && groups.get(p)!.length > 0)
    .map((p) => ({ period: p, items: groups.get(p)! }));
}

interface Props {
  initialEvents?: EventWithLocation[];
  initialTotal?: number;
  hasActiveFilters?: boolean;
  portalId?: string;
  portalExclusive?: boolean;
  portalSlug?: string;
}

// Stable state for infinite scroll
interface ScrollState {
  version: number; // Incremented when filters change - used to discard stale responses
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  retryCount: number;
}

export default function EventList({ initialEvents, initialTotal, hasActiveFilters = false, portalId, portalExclusive, portalSlug }: Props) {
  const [events, setEvents] = useState<EventWithLocation[]>(initialEvents || []);
  const [scrollState, setScrollState] = useState<ScrollState>({
    version: 0,
    page: 1,
    hasMore: initialEvents ? initialEvents.length < (initialTotal || 0) : true,
    isLoading: !initialEvents, // Start loading if no initial data
    error: null,
    retryCount: 0,
  });
  const [initialLoadComplete, setInitialLoadComplete] = useState(!!initialEvents);

  // Track initial event IDs to skip animations on infinite scroll items
  const initialEventIds = useRef<Set<number>>(new Set((initialEvents || []).map(e => e.id)));
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Live events count for "Now" banner
  const liveEventCount = useLiveEventCount();
  const loaderRef = useRef<HTMLDivElement>(null);

  // Friends going data
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const { getFriendsForEvent } = useFriendsGoing(eventIds);

  // AbortController for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track loaded pages for current version
  const loadedPagesRef = useRef<Set<number>>(new Set([1]));

  // Fetch initial data client-side when no server data provided
  useEffect(() => {
    // Skip if we have initial data from server
    if (initialEvents && initialEvents.length > 0) {
      return;
    }

    const controller = new AbortController();

    async function fetchInitialData() {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", "1");
      params.delete("view");

      if (portalId && portalId !== "default") {
        params.set("portal_id", portalId);
      }
      if (portalExclusive) {
        params.set("portal_exclusive", "true");
      }

      try {
        const res = await fetch(`/api/events?${params}`, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        setEvents(data.events || []);
        setScrollState(prev => ({
          ...prev,
          page: 1,
          hasMore: data.hasMore,
          isLoading: false,
          error: null,
        }));
        loadedPagesRef.current = new Set([1]);
        initialEventIds.current = new Set((data.events || []).map((e: EventWithLocation) => e.id));
        setInitialLoadComplete(true);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Failed to fetch events:", error);
        setScrollState(prev => ({
          ...prev,
          isLoading: false,
          error: "Failed to load events",
        }));
        setInitialLoadComplete(true);
      }
    }

    fetchInitialData();

    return () => controller.abort();
  }, [searchParams, portalId, portalExclusive, initialEvents]);

  // Reset when filters change (for both server and client-side data)
  useEffect(() => {
    // Skip on initial mount
    if (!initialLoadComplete) return;

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // If we have server data, use it
    if (initialEvents && initialEvents.length > 0) {
      setEvents(initialEvents);
      setScrollState(prev => ({
        version: prev.version + 1,
        page: 1,
        hasMore: initialEvents.length < (initialTotal || 0),
        isLoading: false,
        error: null,
        retryCount: 0,
      }));
      loadedPagesRef.current = new Set([1]);
      initialEventIds.current = new Set(initialEvents.map(e => e.id));
    } else {
      // Client-side: refetch on filter change
      setScrollState(prev => ({
        version: prev.version + 1,
        page: 1,
        hasMore: true,
        isLoading: true,
        error: null,
        retryCount: 0,
      }));
      loadedPagesRef.current = new Set();

      // Trigger a refetch
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", "1");
      params.delete("view");
      if (portalId && portalId !== "default") params.set("portal_id", portalId);
      if (portalExclusive) params.set("portal_exclusive", "true");

      const controller = new AbortController();
      abortControllerRef.current = controller;

      fetch(`/api/events?${params}`, { signal: controller.signal })
        .then(res => res.json())
        .then(data => {
          setEvents(data.events || []);
          setScrollState(prev => ({
            ...prev,
            page: 1,
            hasMore: data.hasMore,
            isLoading: false,
          }));
          loadedPagesRef.current = new Set([1]);
          initialEventIds.current = new Set((data.events || []).map((e: EventWithLocation) => e.id));
        })
        .catch(err => {
          if (err.name !== "AbortError") {
            setScrollState(prev => ({ ...prev, isLoading: false, error: "Failed to load events" }));
          }
        });
    }
  }, [searchParams, initialEvents, initialTotal, portalId, portalExclusive, initialLoadComplete]);

  // Load more function - stable reference with all deps captured via refs
  const loadMore = useCallback(async (isRetry = false) => {
    setScrollState(prev => {
      // Don't load if already loading, no more pages, or hit max events
      if (prev.isLoading || !prev.hasMore) return prev;

      const nextPage = prev.page + 1;

      // Check if already loaded this page
      if (loadedPagesRef.current.has(nextPage)) {
        return prev;
      }

      // Check if we've hit max events
      if (events.length >= MAX_EVENTS) {
        return { ...prev, hasMore: false };
      }

      // Start loading - we'll do the actual fetch outside this setState
      return {
        ...prev,
        isLoading: true,
        error: null,
        retryCount: isRetry ? prev.retryCount : 0,
      };
    });
  }, [events.length]);

  // Effect to perform the actual fetch when isLoading becomes true
  useEffect(() => {
    if (!scrollState.isLoading) return;

    const currentVersion = scrollState.version;
    const nextPage = scrollState.page + 1;

    // Double-check we haven't loaded this page
    if (loadedPagesRef.current.has(nextPage)) {
      setScrollState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    // Mark page as being loaded
    loadedPagesRef.current.add(nextPage);

    // Create abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchPage = async () => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", nextPage.toString());
      params.delete("view");

      if (portalId && portalId !== "default") {
        params.set("portal_id", portalId);
      }
      if (portalExclusive) {
        params.set("portal_exclusive", "true");
      }

      try {
        const res = await fetch(`/api/events?${params}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        // Check if this response is still valid (filters haven't changed)
        setScrollState(prev => {
          if (prev.version !== currentVersion) {
            // Stale response - discard
            return prev;
          }

          // Deduplicate and add new events
          setEvents(prevEvents => {
            const existingIds = new Set(prevEvents.map(e => e.id));
            const newEvents = (data.events as EventWithLocation[]).filter(
              (e) => !existingIds.has(e.id)
            );

            // Don't exceed max events
            const combined = [...prevEvents, ...newEvents];
            if (combined.length > MAX_EVENTS) {
              return combined.slice(0, MAX_EVENTS);
            }
            return combined;
          });

          return {
            ...prev,
            page: nextPage,
            hasMore: data.hasMore && events.length + (data.events?.length || 0) < MAX_EVENTS,
            isLoading: false,
            error: null,
            retryCount: 0,
          };
        });
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Failed to load more events:", error);

        // Remove from loaded pages so it can be retried
        loadedPagesRef.current.delete(nextPage);

        setScrollState(prev => {
          if (prev.version !== currentVersion) {
            return prev;
          }

          const newRetryCount = prev.retryCount + 1;

          // Auto-retry with exponential backoff if under max retries
          if (newRetryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY_BASE * Math.pow(2, newRetryCount - 1);
            setTimeout(() => {
              setScrollState(p => {
                if (p.version !== currentVersion || p.isLoading) return p;
                return { ...p, isLoading: true, retryCount: newRetryCount };
              });
            }, delay);

            return {
              ...prev,
              isLoading: false,
              retryCount: newRetryCount,
            };
          }

          // Max retries exceeded - show error
          return {
            ...prev,
            isLoading: false,
            error: "Failed to load more events",
            retryCount: newRetryCount,
          };
        });
      }
    };

    fetchPage();

    return () => {
      controller.abort();
    };
  }, [scrollState.isLoading, scrollState.version, scrollState.page, scrollState.retryCount, searchParams, portalId, portalExclusive, events.length]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const currentLoaderRef = loaderRef.current;
    if (!currentLoaderRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Clear any existing debounce
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          // Debounce the load
          debounceTimerRef.current = setTimeout(() => {
            loadMore();
          }, DEBOUNCE_MS);
        }
      },
      {
        threshold: 0,
        rootMargin: "400px", // Trigger earlier for smoother experience
      }
    );

    observer.observe(currentLoaderRef);

    return () => {
      observer.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [loadMore]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        const date = event.start_date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
      },
      {} as Record<string, EventWithLocation[]>
    );
  }, [events]);

  const dates = Object.keys(eventsByDate).sort();

  // Manual retry handler
  const handleRetry = useCallback(() => {
    setScrollState(prev => ({
      ...prev,
      error: null,
      retryCount: 0,
    }));
    // Small delay then trigger load
    setTimeout(() => loadMore(true), 100);
  }, [loadMore]);

  // Popular categories for suggestions
  const suggestedCategories = [
    { value: "music", label: "Music" },
    { value: "comedy", label: "Comedy" },
    { value: "art", label: "Art" },
    { value: "food_drink", label: "Food & Drink" },
    { value: "film", label: "Film" },
  ];

  // Show loading skeleton during initial load
  if (!initialLoadComplete) {
    return (
      <div className="py-4">
        <EventCardSkeletonList count={6} />
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <div className="text-center py-16">
        {/* Illustrated empty state */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center relative overflow-hidden">
          {/* Decorative elements */}
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

            {/* Suggested categories */}
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
    <div>
      {/* Live Events Banner - Enhanced with gradient background */}
      {liveEventCount > 0 && (
        <Link
          href="/happening-now"
          className="group flex items-center gap-3 mb-5 px-4 py-3.5 rounded-xl bg-gradient-to-r from-[var(--neon-red)]/15 via-[var(--neon-magenta)]/10 to-[var(--neon-cyan)]/15 border border-[var(--neon-red)]/30 hover:border-[var(--neon-red)]/50 transition-all hover:shadow-[0_0_20px_rgba(255,90,90,0.1)]"
        >
          {/* Pulsing live indicator - larger */}
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

      {dates.map((date) => {
        const displayItems = groupEventsForDisplay(eventsByDate[date]);
        const timePeriods = groupByTimePeriod(displayItems);
        const eventCount = eventsByDate[date].length;

        return (
          <section key={date}>
            {/* Date header - enhanced with event count */}
            <div className="sticky top-[148px] bg-[var(--void)]/95 backdrop-blur-sm z-20 py-2.5 -mx-4 px-4 border-b border-[var(--twilight)]/30">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[0.65rem] font-semibold text-[var(--cream)] uppercase tracking-wider">
                  {getDateLabel(date)}
                </span>
                <span className="font-mono text-[0.6rem] text-[var(--muted)] bg-[var(--twilight)]/50 px-2 py-0.5 rounded">
                  {eventCount} event{eventCount !== 1 ? "s" : ""}
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-[var(--twilight)]/50 to-transparent" />
              </div>
            </div>

            {/* Events grouped by time period */}
            <div>
              {timePeriods.map(({ period, items }) => (
                <div key={period}>
                  {/* Time period divider - only show if multiple periods */}
                  {timePeriods.length > 1 && (
                    <div className="flex items-center gap-2 py-2 mt-3">
                      <span className="text-[var(--muted)]/50">
                        {TIME_PERIOD_ICONS[period]}
                      </span>
                      <span className="font-mono text-[0.55rem] text-[var(--muted)]/70 uppercase tracking-wider">
                        {TIME_PERIOD_LABELS[period]}
                      </span>
                      <div className="flex-1 h-px bg-[var(--twilight)]/30" />
                      <span className="font-mono text-[0.5rem] text-[var(--muted)]/50">
                        {items.length}
                      </span>
                    </div>
                  )}

                  {/* Events in this period */}
                  {items.map((item, idx) => {
                    // Check if any event in this item is from infinite scroll
                    const isInfiniteScrollItem = item.type === "event"
                      ? !initialEventIds.current.has(item.event.id)
                      : item.events.some(e => !initialEventIds.current.has(e.id));

                    if (item.type === "venue-group") {
                      return (
                        <EventGroup
                          key={`venue-${item.venueId}`}
                          type="venue"
                          title={item.venueName}
                          subtitle={item.neighborhood || undefined}
                          events={item.events}
                          skipAnimation={isInfiniteScrollItem}
                          portalSlug={portalSlug}
                        />
                      );
                    }
                    if (item.type === "category-group") {
                      return (
                        <EventGroup
                          key={`cat-${item.categoryId}`}
                          type="category"
                          title={item.categoryName}
                          events={item.events}
                          skipAnimation={isInfiniteScrollItem}
                          portalSlug={portalSlug}
                        />
                      );
                    }
                    return (
                      <EventCard
                        key={item.event.id}
                        event={item.event}
                        index={idx}
                        skipAnimation={isInfiniteScrollItem}
                        portalSlug={portalSlug}
                        friendsGoing={getFriendsForEvent(item.event.id)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Loading indicator */}
      {scrollState.isLoading && (
        <div className="py-2">
          <EventCardSkeletonList count={3} />
        </div>
      )}

      {/* Error state with retry button */}
      {scrollState.error && (
        <div className="py-6 text-center">
          <p className="text-[var(--muted)] text-sm mb-3">{scrollState.error}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)]/30 text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors font-mono text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try again
          </button>
        </div>
      )}

      {/* Intersection observer sentinel */}
      {scrollState.hasMore && !scrollState.error && (
        <div
          ref={loaderRef}
          className="h-10"
          aria-hidden="true"
        />
      )}

      {/* Max events reached indicator */}
      {events.length >= MAX_EVENTS && (
        <div className="py-6 text-center">
          <span className="font-mono text-xs text-[var(--muted)]/60">
            Showing first {MAX_EVENTS} events. Use filters to narrow your search.
          </span>
        </div>
      )}

      {/* End of list indicator */}
      {!scrollState.hasMore && !scrollState.error && events.length > 0 && events.length < MAX_EVENTS && (
        <div className="py-6 text-center">
          <span className="font-mono text-xs text-[var(--muted)]/40">
            That&apos;s everything for now
          </span>
        </div>
      )}
    </div>
  );
}
