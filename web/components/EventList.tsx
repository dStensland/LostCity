"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import Link from "next/link";
import EventCard from "./EventCard";
import EventGroup from "./EventGroup";
import { EventCardSkeletonList } from "./EventCardSkeleton";
import type { EventWithLocation } from "@/lib/search";
import { useLiveEventCount } from "@/lib/hooks/useLiveEvents";

// Rollup thresholds
const VENUE_ROLLUP_THRESHOLD = 4;
const CATEGORY_ROLLUP_THRESHOLD = 5;
const ROLLUP_CATEGORIES = ["community"];

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
  initialEvents: EventWithLocation[];
  initialTotal: number;
  hasActiveFilters: boolean;
  portalId?: string;
  portalExclusive?: boolean;
}

export default function EventList({ initialEvents, initialTotal, hasActiveFilters, portalId, portalExclusive }: Props) {
  const [events, setEvents] = useState<EventWithLocation[]>(initialEvents);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialEvents.length < initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false); // Sync ref to prevent race conditions
  const lastLoadTime = useRef(0); // Debounce protection
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Live events count for "Now" banner
  const liveEventCount = useLiveEventCount();
  const loaderRef = useRef<HTMLDivElement>(null);
  const loadedPagesRef = useRef<Set<number>>(new Set([1])); // Track which pages we've loaded

  const DEBOUNCE_MS = 500; // Increased debounce

  // Reset when filters change (initialEvents will change from server)
  useEffect(() => {
    setEvents(initialEvents);
    setPage(1);
    setHasMore(initialEvents.length < initialTotal);
    loadedPagesRef.current = new Set([1]); // Reset loaded pages tracker
    isLoadingRef.current = false; // Reset loading state
  }, [initialEvents, initialTotal]);

  // Use refs to track current values without causing re-renders
  const pageRef = useRef(page);
  const hasMoreRef = useRef(hasMore);
  const searchParamsRef = useRef(searchParams.toString());

  // Keep refs in sync
  useEffect(() => {
    pageRef.current = page;
    hasMoreRef.current = hasMore;
    searchParamsRef.current = searchParams.toString();
  }, [page, hasMore, searchParams]);

  const loadMore = useCallback(async () => {
    // Debounce: prevent rapid successive calls
    const now = Date.now();
    if (now - lastLoadTime.current < DEBOUNCE_MS) return;

    // Use refs for synchronous check to prevent race conditions
    if (isLoadingRef.current || !hasMoreRef.current) return;

    const nextPage = pageRef.current + 1;

    // Check if we've already loaded this page
    if (loadedPagesRef.current.has(nextPage)) {
      return;
    }

    lastLoadTime.current = now;
    isLoadingRef.current = true;
    loadedPagesRef.current.add(nextPage); // Mark as loading
    setIsLoading(true);

    const params = new URLSearchParams(searchParamsRef.current);
    params.set("page", nextPage.toString());
    params.delete("view"); // Don't need view param for API
    // Add portal filters if set
    if (portalId && portalId !== "default") {
      params.set("portal_id", portalId);
    }
    if (portalExclusive) {
      params.set("portal_exclusive", "true");
    }

    try {
      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();

      // Prevent duplicate events
      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newEvents = (data.events as EventWithLocation[]).filter(
          (e) => !existingIds.has(e.id)
        );
        return [...prev, ...newEvents];
      });
      setPage(nextPage);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Failed to load more events:", error);
      // Remove from loaded pages so it can be retried
      loadedPagesRef.current.delete(nextPage);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [portalId, portalExclusive]); // Include portal params as dependencies

  // Intersection Observer for infinite scroll - stable, doesn't depend on changing values
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Use ref-based checks only to avoid stale state issues
        if (entries[0].isIntersecting && hasMoreRef.current && !isLoadingRef.current) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    const currentRef = loaderRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [loadMore]); // loadMore is now stable (no deps)

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

  // Popular categories for suggestions
  const suggestedCategories = [
    { value: "music", label: "Music" },
    { value: "comedy", label: "Comedy" },
    { value: "art", label: "Art" },
    { value: "food_drink", label: "Food & Drink" },
    { value: "film", label: "Film" },
  ];

  if (dates.length === 0) {
    return (
      <div className="text-center py-12">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <p className="text-[var(--muted)] text-lg mb-2">
          {hasActiveFilters ? "No events match your filters" : "No upcoming events found"}
        </p>

        {hasActiveFilters ? (
          <div className="space-y-4">
            <p className="text-[var(--muted)]/60 text-sm">
              Try adjusting your filters or exploring a different category
            </p>
            <Link
              href={pathname}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)]/30 text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors font-mono text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear all filters
            </Link>
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
                  className="px-3 py-1.5 rounded-full bg-[var(--twilight)]/30 text-[var(--muted)] hover:bg-[var(--twilight)]/50 hover:text-[var(--cream)] transition-colors text-sm"
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
      {/* Live Events Banner */}
      {liveEventCount > 0 && (
        <Link
          href="/happening-now"
          className="group flex items-center gap-3 mb-4 px-4 py-3 rounded-lg bg-gradient-to-r from-[var(--neon-magenta)]/10 to-[var(--neon-cyan)]/10 border border-[var(--neon-magenta)]/30 hover:border-[var(--neon-magenta)]/60 transition-colors"
        >
          {/* Pulsing live indicator */}
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-magenta)] opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--neon-magenta)]" />
          </span>
          <span className="font-medium text-[var(--cream)]">
            {liveEventCount} {liveEventCount === 1 ? "thing" : "things"} happening right now
          </span>
          <svg
            className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--cream)] group-hover:translate-x-1 transition-all ml-auto"
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

        return (
          <section key={date}>
            {/* Date header */}
            <div className="sticky top-[148px] bg-[var(--void)] z-20 py-2 -mx-4 px-4">
              <span className="font-mono text-[0.6rem] font-medium text-[var(--muted)] uppercase tracking-wider">
                {getDateLabel(date)}
              </span>
            </div>

            {/* Events grouped by time period */}
            <div>
              {timePeriods.map(({ period, items }, periodIdx) => (
                <div key={period}>
                  {/* Time period divider - only show if multiple periods */}
                  {timePeriods.length > 1 && (
                    <div className="flex items-center gap-2 py-2 mt-2">
                      <span className="font-mono text-[0.55rem] text-[var(--muted)]/60 uppercase tracking-wider">
                        {TIME_PERIOD_LABELS[period]}
                      </span>
                      <div className="flex-1 h-px bg-[var(--twilight)]/30" />
                    </div>
                  )}

                  {/* Events in this period */}
                  {items.map((item, idx) => {
                    if (item.type === "venue-group") {
                      return (
                        <EventGroup
                          key={`venue-${item.venueId}`}
                          type="venue"
                          title={item.venueName}
                          subtitle={item.neighborhood || undefined}
                          events={item.events}
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
                        />
                      );
                    }
                    return <EventCard key={item.event.id} event={item.event} index={idx} />;
                  })}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Loading indicator / Skeleton */}
      <div ref={loaderRef} className="py-4">
        {isLoading && <EventCardSkeletonList count={3} />}
      </div>
    </div>
  );
}
