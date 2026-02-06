"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatTimeSplit } from "@/lib/formats";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import CategoryIcon from "./CategoryIcon";
import SeriesCard from "@/components/SeriesCard";
import FestivalCard from "@/components/FestivalCard";
import { groupEventsForDisplay } from "@/lib/event-grouping";
import type { EventWithLocation } from "@/lib/search";

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

// Get reflection color class based on category
function getReflectionClass(category: string | null): string {
  if (!category) return "";
  const reflectionMap: Record<string, string> = {
    music: "reflect-music",
    comedy: "reflect-comedy",
    art: "reflect-art",
    theater: "reflect-theater",
    film: "reflect-film",
    community: "reflect-community",
    food_drink: "reflect-food",
    food: "reflect-food",
    sports: "reflect-sports",
    fitness: "reflect-fitness",
    nightlife: "reflect-nightlife",
    family: "reflect-family",
  };
  return reflectionMap[category] || "";
}

function getSmartDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

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
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[var(--neon-magenta)]/10 flex items-center justify-center">
            <span className="text-lg">📈</span>
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold text-[var(--cream)]">
              Trending Now
            </h2>
            <p className="font-mono text-[0.65rem] text-[var(--muted)]">Most popular this week</p>
          </div>
          <span className="px-2 py-1 text-[0.6rem] font-mono font-bold bg-[var(--neon-magenta)]/20 text-[var(--neon-magenta)] rounded-full uppercase tracking-wide">
            Hot
          </span>
        </div>

        {/* Horizontal scroll container with scroll snap on mobile */}
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory md:snap-none">
          {displayItems.map((item) => {
            if (item.type === "event") {
              return (
                <TrendingEventCard key={item.event.id} event={item.event as TrendingEvent} portalSlug={portalSlug} />
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
      </div>
    </section>
  );
}

function TrendingEventCard({ event, portalSlug }: { event: TrendingEvent; portalSlug?: string }) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const reflectionClass = getReflectionClass(event.category);
  const smartDate = getSmartDate(event.start_date);
  const goingCount = event.going_count || 0;
  const accentMode = event.category ? "category" : "trending";

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
      scroll={false}
      data-category={event.category || undefined}
      data-accent={accentMode}
      className={`flex-shrink-0 w-72 p-3 bg-[var(--dusk)] rounded-xl border border-[var(--twilight)] transition-all duration-200 group card-atmospheric card-trending snap-start hover:border-[var(--twilight)]/80 hover:bg-[var(--dusk)]/80 glow-accent reflection-accent will-change-border-bg ${reflectionClass}`}
    >
      <div className="flex items-start gap-3">
        {/* Trending indicator */}
        <div className="flex-shrink-0 w-10 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-[var(--neon-magenta)]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--neon-magenta)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-sans text-sm font-medium text-[var(--cream)] line-clamp-2 group-hover:text-[var(--neon-magenta)] transition-colors">
            {event.title}
          </h3>

          <div className="flex items-center gap-1.5 mt-1 text-[var(--muted)]">
            <CategoryIcon type={event.category || "other"} size={12} />
            <span className="font-mono text-[0.6rem]">
              {smartDate} · {time}
              {period && <span className="opacity-60">{period}</span>}
            </span>
          </div>

          {event.venue?.name && (
            <p className="font-mono text-[0.6rem] text-[var(--muted)] truncate mt-0.5">
              {event.venue.name}
            </p>
          )}

          {/* Trending stats */}
          <div className="flex items-center gap-2 mt-2">
            {goingCount > 0 && (
              <span className="flex items-center gap-1 font-mono text-[0.6rem] text-[var(--neon-green)]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" />
                {goingCount} going
              </span>
            )}
            <span className="font-mono text-[0.55rem] text-[var(--neon-magenta)]">
              Heating up
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
