"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import Link from "next/link";
import EventCard from "./EventCard";
import EventGroup from "./EventGroup";
import type { EventWithLocation } from "@/lib/search";

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
  return format(date, "EEEE, MMM d");
}

interface Props {
  initialEvents: EventWithLocation[];
  initialTotal: number;
  hasActiveFilters: boolean;
}

export default function EventList({ initialEvents, initialTotal, hasActiveFilters }: Props) {
  const [events, setEvents] = useState<EventWithLocation[]>(initialEvents);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialEvents.length < initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false); // Sync ref to prevent race conditions
  const lastLoadTime = useRef(0); // Debounce protection
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const loaderRef = useRef<HTMLDivElement>(null);

  const DEBOUNCE_MS = 300;

  // Reset when filters change (initialEvents will change from server)
  useEffect(() => {
    setEvents(initialEvents);
    setPage(1);
    setHasMore(initialEvents.length < initialTotal);
  }, [initialEvents, initialTotal]);

  const loadMore = useCallback(async () => {
    // Debounce: prevent rapid successive calls
    const now = Date.now();
    if (now - lastLoadTime.current < DEBOUNCE_MS) return;

    // Use ref for synchronous check to prevent race conditions
    if (isLoadingRef.current || !hasMore) return;

    lastLoadTime.current = now;
    isLoadingRef.current = true;
    setIsLoading(true);
    const nextPage = page + 1;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", nextPage.toString());
    params.delete("view"); // Don't need view param for API

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
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [page, searchParams, hasMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Use ref-based check only to avoid stale state issues
        if (entries[0].isIntersecting && hasMore && !isLoadingRef.current) {
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
  }, [hasMore, loadMore]);

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

  if (dates.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--muted)] text-lg">
          {hasActiveFilters ? "No events match your filters." : "No upcoming events found."}
        </p>
        {hasActiveFilters && (
          <Link
            href={pathname}
            className="mt-4 inline-block text-[var(--coral)] hover:text-[var(--rose)] transition-colors font-mono text-sm"
          >
            Clear all filters
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      {dates.map((date) => (
        <section key={date}>
          {/* Date header - classified style */}
          <div className="flex items-center gap-4 py-4 sticky top-36 bg-[var(--void)] z-20">
            <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest whitespace-nowrap">
              {getDateLabel(date)}
            </span>
            <div className="flex-1 h-px bg-[var(--twilight)]" />
          </div>

          {/* Events */}
          <div>
            {groupEventsForDisplay(eventsByDate[date]).map((item, idx) => {
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
        </section>
      ))}

      {/* Loading indicator / end message */}
      <div ref={loaderRef} className="py-8">
        {isLoading && (
          <div className="flex justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-[var(--coral)] border-t-transparent rounded-full" />
          </div>
        )}
        {!hasMore && events.length > 0 && (
          <p className="text-center text-[var(--muted)] font-mono text-xs">
            You&apos;ve reached the end
          </p>
        )}
      </div>
    </div>
  );
}
