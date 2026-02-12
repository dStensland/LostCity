"use client";

import { useState, useEffect, useMemo } from "react";
import SeriesCard from "@/components/SeriesCard";
import FestivalCard from "@/components/FestivalCard";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { groupEventsForDisplay } from "@/lib/event-grouping";
import type { EventWithLocation } from "@/lib/search";
import { TrendingEventCard, type FeedEventData } from "@/components/EventCard";

type TrendingEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  category: string | null;
  image_url: string | null;
  going_count: number;
  series_id?: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
    frequency: string | null;
    day_of_week: string | null;
    festival?: {
      id: string;
      slug: string;
      name: string;
      image_url: string | null;
      festival_type?: string | null;
      location: string | null;
      neighborhood: string | null;
    } | null;
  } | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
};

export default function TrendingNow({ portalSlug }: { portalSlug?: string } = {}) {
  const [events, setEvents] = useState<TrendingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch("/api/trending");
        if (!response.ok) {
          setEvents([]);
          return;
        }
        const data = await response.json();
        setEvents(data.events || []);
      } catch (error) {
        console.error("Failed to fetch trending events:", error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  const displayItems = useMemo(
    () =>
      groupEventsForDisplay(
        events.map((event) => ({
          ...event,
          category_id: event.category,
          subcategory_id: null,
        })) as unknown as EventWithLocation[],
        {
          collapseFestivals: true,
          collapseFestivalPrograms: true,
          rollupVenues: false,
          rollupCategories: false,
          sortByTime: false,
        }
      ),
    [events]
  );

  if (loading) {
    return null; // Parent will show skeleton
  }

  // Don't render if no trending events
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="py-6 border-b border-[var(--twilight)]/50">
      <FeedSectionHeader
        title="Trending Now"
        subtitle="Most popular this week"
        priority="tertiary"
        accentColor="var(--neon-magenta)"
        badge="Hot"
        icon={
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
            <path
              d="M4 14l5-5 4 4 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 6h6v6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
      />

      {/* Horizontal scroll container with scroll snap on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory md:snap-none">
        {displayItems.map((item) => {
          if (item.type === "event") {
            return (
              <TrendingEventCard key={item.event.id} event={item.event as FeedEventData} portalSlug={portalSlug} />
            );
          }
          if (item.type === "series-group") {
            return (
              <SeriesCard
                key={`series-${item.seriesId}`}
                series={item.series}
                venueGroups={item.venueGroups}
                portalSlug={portalSlug}
                skipAnimation
                disableMargin
                className="flex-shrink-0 w-72 snap-start"
              />
            );
          }
          if (item.type === "festival-group") {
            return (
              <FestivalCard
                key={`festival-${item.festivalId}`}
                festival={item.festival}
                summary={item.summary}
                portalSlug={portalSlug}
                skipAnimation
                disableMargin
                className="flex-shrink-0 w-72 snap-start"
              />
            );
          }
          return null;
        })}
      </div>
    </section>
  );
}
