"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import SaveButton from "@/components/SaveButton";
import CategoryIcon from "@/components/CategoryIcon";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO, startOfDay } from "date-fns";
import { formatTime } from "@/lib/formats";

// Timeout constant for Supabase queries to prevent indefinite hanging
const QUERY_TIMEOUT = 8000;

type EventData = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  image_url: string | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
};

type SavedEvent = {
  id: string;
  created_at: string;
  event: EventData | null;
};

type FilterTab = "upcoming" | "past";

export default function DashboardPlanning() {
  const { user } = useAuth();
  const supabase = createClient();

  const [filterTab, setFilterTab] = useState<FilterTab>("upcoming");
  const [savedItems, setSavedItems] = useState<SavedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const savedQuery = supabase
        .from("saved_items")
        .select(`
          id,
          created_at,
          event:events (
            id,
            title,
            start_date,
            start_time,
            is_all_day,
            is_free,
            price_min,
            price_max,
            category,
            image_url,
            venue:places (
              id,
              name,
              neighborhood
            )
          )
        `)
        .eq("user_id", user.id)
        .not("event_id", "is", null)
        .order("created_at", { ascending: false });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout")), QUERY_TIMEOUT)
      );

      const savedRes = await Promise.race([savedQuery, timeoutPromise]);

      if (savedRes.data) {
        setSavedItems(savedRes.data as SavedEvent[]);
      }
    } catch (error) {
      console.error("Failed to load planning data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filterByDate = <T extends { event: EventData | null }>(items: T[]): T[] => {
    return items.filter((item) => {
      if (!item.event) return false;

      const eventDate = startOfDay(parseISO(item.event.start_date));
      const today = startOfDay(new Date());
      const isEventPast = eventDate < today;

      if (filterTab === "upcoming") return !isEventPast;
      return isEventPast;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Items skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
              <div className="flex gap-4">
                <div className="w-20 h-20 skeleton-shimmer rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 skeleton-shimmer rounded w-3/4" />
                  <div className="h-4 skeleton-shimmer rounded w-1/2" />
                  <div className="h-3 skeleton-shimmer rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterTab("upcoming")}
          className={`px-3 py-1.5 rounded-md font-mono text-xs transition-colors ${
            filterTab === "upcoming"
              ? "bg-[var(--twilight)] text-[var(--cream)]"
              : "text-[var(--muted)] hover:text-[var(--cream)]"
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setFilterTab("past")}
          className={`px-3 py-1.5 rounded-md font-mono text-xs transition-colors ${
            filterTab === "past"
              ? "bg-[var(--twilight)] text-[var(--cream)]"
              : "text-[var(--muted)] hover:text-[var(--cream)]"
          }`}
        >
          Past
        </button>
      </div>

      {/* Saved Items */}
      <SavedSection items={filterByDate(savedItems)} filterTab={filterTab} />

      {/* Calendar Preview */}
      <div className="mt-8 p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
            This Week
          </h3>
          <Link
            href={`/${DEFAULT_PORTAL_SLUG}?view=calendar`}
            className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
          >
            Full Calendar
          </Link>
        </div>
        <CalendarPreview savedItems={savedItems} />
      </div>
    </div>
  );
}

function SavedSection({ items, filterTab }: { items: SavedEvent[]; filterTab: FilterTab }) {
  if (items.length === 0) {
    return (
      <div className="p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-[var(--muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        <p className="text-[var(--soft)] font-mono text-sm">
          {filterTab === "upcoming"
            ? "Save events you're curious about. Your stash lives here."
            : "Nothing in the past"}
        </p>
        <Link
          href={`/${DEFAULT_PORTAL_SLUG}`}
          className="inline-block mt-4 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
        >
          Browse Events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) =>
        item.event ? <EventCard key={item.id} event={item.event} showSaveButton /> : null
      )}
    </div>
  );
}

function EventCard({
  event,
  showSaveButton = false,
  badge,
}: {
  event: EventData;
  showSaveButton?: boolean;
  badge?: string;
}) {
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");
  const time = formatTime(event.start_time, event.is_all_day);
  const isEventPast = startOfDay(dateObj) < startOfDay(new Date());

  return (
    <div className={`relative group ${isEventPast ? "opacity-60" : ""}`}>
      <Link
        href={`/events/${event.id}`}
        className="block p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--twilight)]/50 transition-colors"
      >
        <div className="flex gap-4">
          {event.image_url && (
            <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--night)] relative">
              <Image
                src={event.image_url}
                alt={event.title}
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
          )}

          <div className="flex-1 min-w-0 pr-10">
            {event.category && (
              <div className="mb-1">
                <CategoryIcon type={event.category} size={12} showLabel />
              </div>
            )}

            <h3 className="font-semibold text-[var(--cream)] line-clamp-2 group-hover:text-[var(--coral)] transition-colors">
              {event.title}
            </h3>

            {event.venue && (
              <p className="font-serif text-sm text-[var(--soft)] mt-0.5 truncate">
                {event.venue.name}
                {event.venue.neighborhood && (
                  <span className="text-[var(--muted)]"> · {event.venue.neighborhood}</span>
                )}
              </p>
            )}

            <p className="font-mono text-xs text-[var(--muted)] mt-1">
              {formattedDate} · {time}
              {event.is_free && (
                <span className="ml-2 text-[var(--cat-community)]">Free</span>
              )}
              {isEventPast && <span className="ml-2 text-[var(--coral)]">Past</span>}
            </p>

            {badge && (
              <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-md text-[10px] font-mono bg-[var(--neon-green)]/20 text-[var(--neon-green)]">
                {badge}
              </span>
            )}
          </div>
        </div>
      </Link>

      {showSaveButton && (
        <div className="absolute top-4 right-4">
          <SaveButton eventId={event.id} size="sm" />
        </div>
      )}
    </div>
  );
}

function CalendarPreview({ savedItems }: { savedItems: SavedEvent[] }) {
  const today = startOfDay(new Date());
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    return date;
  });

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return savedItems.filter((s) => s.event && s.event.start_date === dateStr);
  };

  return (
    <div className="grid grid-cols-7 gap-1">
      {next7Days.map((date, i) => {
        const events = getEventsForDate(date);
        const isToday = i === 0;

        return (
          <div
            key={i}
            className={`text-center py-2 rounded ${
              isToday
                ? "bg-[var(--coral)]/20 border border-[var(--coral)]/30"
                : "bg-[var(--night)]"
            }`}
          >
            <p className="font-mono text-[10px] text-[var(--muted)]">
              {format(date, "EEE")}
            </p>
            <p className={`font-mono text-sm ${isToday ? "text-[var(--coral)]" : "text-[var(--cream)]"}`}>
              {format(date, "d")}
            </p>
            {events.length > 0 && (
              <div className="mt-1 flex justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--coral)]" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
