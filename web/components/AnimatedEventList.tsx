"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import EventCard from "./EventCard";
import EventGroup from "./EventGroup";
import SeriesCard from "./SeriesCard";
import FestivalCard from "./FestivalCard";
import { EventCardSkeletonList } from "./EventCardSkeleton";
import {
  groupEventsForDisplay,
  groupByTimePeriod,
  groupEventsByDate,
  getSortedDates,
  getDateLabel,
  TIME_PERIOD_LABELS,
  type DisplayItem,
  type TimePeriod,
} from "@/lib/event-grouping";
import type { EventWithLocation } from "@/lib/search";
import type { FriendGoing } from "@/lib/use-friends-going";

// Time period icons
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

// Animation variants with proper typing
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: (index: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: Math.min(index * 0.03, 0.3), // Stagger with max delay
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1] as const, // easeOut cubic bezier
    },
  }),
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1] as const, // easeIn cubic bezier
    },
  },
};

const dateHeaderVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2 },
  },
};

interface AnimatedEventListProps {
  events: EventWithLocation[];
  portalSlug?: string;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  isRefetching?: boolean;
  getFriendsForEvent?: (eventId: number) => FriendGoing[];
}

/**
 * Animated event list component with Framer Motion
 * Handles optimistic fade-out when filters change and smooth loading of new content
 */
export default function AnimatedEventList({
  events,
  portalSlug,
  isLoading = false,
  isFetchingNextPage = false,
  isRefetching = false,
  getFriendsForEvent,
}: AnimatedEventListProps) {
  // Track initial events for animation purposes (use state since we read during render)
  const [initialEventIds, setInitialEventIds] = useState<Set<number>>(new Set());
  const isInitialLoadRef = useRef(true);

  // Set initial event IDs on first load
  useEffect(() => {
    if (events.length > 0 && isInitialLoadRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time initialization
      setInitialEventIds(new Set(events.map((e) => e.id)));
      isInitialLoadRef.current = false;
    }
  }, [events]);

  // Group events by date
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const dates = useMemo(() => getSortedDates(eventsByDate), [eventsByDate]);

  // Show loading skeleton during initial load or refetch
  if (isLoading || (isRefetching && events.length === 0)) {
    return (
      <div className="py-4">
        <EventCardSkeletonList count={6} />
      </div>
    );
  }

  // Show dimmed state during refetch
  const showDimmed = isRefetching && events.length > 0;

  return (
    <div className={showDimmed ? "opacity-60 transition-opacity duration-200" : ""}>
      <AnimatePresence mode="popLayout">
        {dates.map((date) => {
          const dateEvents = eventsByDate[date];
          const displayItems = groupEventsForDisplay(dateEvents);
          const timePeriods = groupByTimePeriod(displayItems);
          const eventCount = dateEvents.length;

          return (
            <motion.section
              key={date}
              variants={dateHeaderVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
            >
              {/* Date header */}
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
              <div className="pt-4">
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
                    <AnimatePresence mode="popLayout">
                      {items.map((item, idx) => {
                        const isInfiniteScrollItem = item.type === "event"
                          ? !initialEventIds.has(item.event.id)
                          : item.type === "series-group"
                          ? item.venueGroups.some((vg) => vg.showtimes.some((st) => !initialEventIds.has(st.id)))
                          : item.type === "festival-group"
                          ? true // Festival groups are always treated as new for animation
                          : item.type === "venue-group" || item.type === "category-group"
                          ? item.events.some((e) => !initialEventIds.has(e.id))
                          : false;

                        const key =
                          item.type === "event"
                            ? `event-${item.event.id}`
                            : item.type === "venue-group"
                            ? `venue-${item.venueId}`
                            : item.type === "series-group"
                            ? `series-${item.seriesId}`
                            : item.type === "festival-group"
                            ? `festival-${item.seriesId}`
                            : `cat-${item.categoryId}`;

                        return (
                          <motion.div
                            key={key}
                            custom={idx}
                            variants={itemVariants}
                            initial={isInfiniteScrollItem ? false : "hidden"}
                            animate="visible"
                            exit="exit"
                            layout
                          >
                            {renderItem(item, idx, portalSlug, isInfiniteScrollItem, getFriendsForEvent)}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.section>
          );
        })}
      </AnimatePresence>

      {/* Loading more indicator */}
      {isFetchingNextPage && (
        <div className="py-2">
          <EventCardSkeletonList count={3} />
        </div>
      )}
    </div>
  );
}

/**
 * Render a display item (event, venue group, category group, series group, or festival group)
 */
function renderItem(
  item: DisplayItem,
  index: number,
  portalSlug?: string,
  skipAnimation?: boolean,
  getFriendsForEvent?: (eventId: number) => FriendGoing[]
) {
  if (item.type === "series-group") {
    return (
      <SeriesCard
        series={item.series}
        venueGroups={item.venueGroups}
        portalSlug={portalSlug}
        skipAnimation={skipAnimation}
      />
    );
  }

  if (item.type === "festival-group") {
    return (
      <FestivalCard
        series={item.series}
        summary={item.summary}
        portalSlug={portalSlug}
        skipAnimation={skipAnimation}
      />
    );
  }

  if (item.type === "venue-group") {
    return (
      <EventGroup
        type="venue"
        title={item.venueName}
        subtitle={item.neighborhood || undefined}
        events={item.events}
        skipAnimation={skipAnimation}
        portalSlug={portalSlug}
      />
    );
  }

  if (item.type === "category-group") {
    return (
      <EventGroup
        type="category"
        title={item.categoryName}
        events={item.events}
        skipAnimation={skipAnimation}
        portalSlug={portalSlug}
      />
    );
  }

  return (
    <EventCard
      event={item.event}
      index={index}
      skipAnimation={skipAnimation}
      portalSlug={portalSlug}
      friendsGoing={getFriendsForEvent?.(item.event.id)}
      reasons={item.event.reasons}
    />
  );
}
