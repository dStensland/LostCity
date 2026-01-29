"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
} from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { getCategoryColor } from "@/components/CategoryIcon";
import CategoryIcon from "@/components/CategoryIcon";
import { formatTimeSplit } from "@/lib/formats";
import { useQuery } from "@tanstack/react-query";

// Type for RSVP'd calendar events
interface CalendarEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  description: string | null;
  ticket_url: string | null;
  source_url: string | null;
  rsvp_status: "going" | "interested" | "went";
  rsvp_created_at: string;
  venue: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
}

interface DayData {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

// Category priority for showing dots
const CATEGORY_PRIORITY = [
  "music", "art", "comedy", "theater", "film", "nightlife",
  "food_drink", "sports", "fitness", "community", "family", "other"
];

const CALENDAR_ROWS = 6;
const CALENDAR_DAYS = CALENDAR_ROWS * 7;

// Status filter options
type StatusFilter = "all" | "going" | "interested";

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [feedUrls, setFeedUrls] = useState<{
    feedUrl: string;
    googleCalendarUrl: string;
    outlookUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login?redirect=/calendar");
    }
  }, [user, authLoading, router]);

  // Fetch calendar events
  const { data, isLoading, isRefetching } = useQuery({
    queryKey: ["user-calendar", currentMonth.getMonth(), currentMonth.getFullYear(), statusFilter],
    queryFn: async () => {
      const start = format(startOfMonth(subMonths(currentMonth, 1)), "yyyy-MM-dd");
      const end = format(addMonths(currentMonth, 2), "yyyy-MM-dd");
      const statusParam = statusFilter === "all" ? "going,interested" : statusFilter;

      const res = await fetch(`/api/user/calendar?start=${start}&end=${end}&status=${statusParam}`);
      if (!res.ok) throw new Error("Failed to fetch calendar");
      return res.json();
    },
    enabled: !!user,
    staleTime: 60000, // 1 minute
  });

  // Fetch feed URLs for sync
  useEffect(() => {
    if (user && !feedUrls) {
      fetch("/api/user/calendar/feed-url")
        .then((res) => res.json())
        .then((data) => setFeedUrls(data))
        .catch(console.error);
    }
  }, [user, feedUrls]);

  // Build events by date map
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const events = data?.events;
    if (events) {
      events.forEach((event: CalendarEvent) => {
        const dateKey = event.start_date;
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(event);
      });
    }
    return map;
  }, [data]);

  // Generate calendar grid
  const calendarDays = useMemo((): DayData[] => {
    const monthStart = startOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const today = new Date();

    const days: DayData[] = [];
    let day = calStart;

    for (let i = 0; i < CALENDAR_DAYS; i++) {
      const dateKey = format(day, "yyyy-MM-dd");
      days.push({
        date: new Date(day),
        events: eventsByDate.get(dateKey) || [],
        isCurrentMonth: isSameMonth(day, monthStart),
        isToday: isToday(day),
        isPast: isBefore(day, today) && !isToday(day),
      });
      day = addDays(day, 1);
    }

    return days;
  }, [currentMonth, eventsByDate]);

  // Selected day's events
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  // Navigation handlers
  const goToPrevMonth = useCallback(() => setCurrentMonth((m) => subMonths(m, 1)), []);
  const goToNextMonth = useCallback(() => setCurrentMonth((m) => addMonths(m, 1)), []);
  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  }, []);

  // Get unique categories for a day
  const getDayCategories = useCallback((dayEvents: CalendarEvent[]) => {
    const categories = new Set<string>();
    dayEvents.forEach((e) => {
      if (e.category) categories.add(e.category);
    });
    return CATEGORY_PRIORITY.filter((c) => categories.has(c)).slice(0, 4);
  }, []);

  // Calculate max events for heat map
  const maxEventsInDay = useMemo(() => {
    let max = 0;
    calendarDays.forEach((d) => {
      if (d.events.length > max) max = d.events.length;
    });
    return max || 1;
  }, [calendarDays]);

  // Copy feed URL to clipboard
  const copyFeedUrl = async () => {
    if (feedUrls?.feedUrl) {
      await navigator.clipboard.writeText(feedUrls.feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--void)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)]/30 border-t-[var(--coral)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl font-bold text-[var(--cream)]">My Calendar</h1>
            <p className="mt-1 font-mono text-sm text-[var(--muted)]">
              Events you&apos;re going to and interested in
            </p>
          </div>

          {/* Sync dropdown */}
          <div className="relative">
            <button
              onClick={() => setSyncMenuOpen(!syncMenuOpen)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Calendar
              <svg className={`w-3 h-3 transition-transform ${syncMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {syncMenuOpen && feedUrls && (
              <div className="absolute right-0 mt-2 w-64 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--twilight)]">
                  <p className="font-mono text-xs text-[var(--muted)]">Subscribe to your calendar</p>
                </div>

                <a
                  href={feedUrls.googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSyncMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
                >
                  <svg className="w-5 h-5 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z" />
                  </svg>
                  Google Calendar
                </a>

                <a
                  href={feedUrls.outlookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSyncMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
                >
                  <svg className="w-5 h-5 text-[#0078D4]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.01V2.55q0-.44.3-.75.3-.3.75-.3h6.93q.44 0 .75.3.3.3.3.75V6h6.97q.3 0 .57.12.26.12.45.32.19.2.31.47.12.26.12.57z" />
                  </svg>
                  Outlook
                </a>

                <button
                  onClick={() => {
                    copyFeedUrl();
                    setSyncMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors text-left"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copied ? "Copied!" : "Copy iCal URL"}
                </button>

                <div className="px-4 py-2 bg-[var(--night)] text-[0.65rem] text-[var(--muted)]">
                  For Apple Calendar: Settings → Calendar → Add Subscribed Calendar
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 mb-6 bg-[var(--night)] rounded-lg p-1 w-fit">
          {(["all", "going", "interested"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-md font-mono text-xs font-medium transition-colors ${
                statusFilter === status
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {status === "all" ? "All" : status === "going" ? "Going" : "Interested"}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
          {/* Calendar Grid */}
          <div className="bg-[var(--night)] rounded-xl p-6 border border-[var(--twilight)]">
            {/* Month header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="font-mono text-2xl font-bold text-[var(--cream)]">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                {(isLoading || isRefetching) && (
                  <span className="w-4 h-4 border-2 border-[var(--coral)]/30 border-t-[var(--coral)] rounded-full animate-spin" />
                )}
                {!isSameMonth(currentMonth, new Date()) && (
                  <button
                    onClick={goToToday}
                    className="px-3 py-1 rounded-full font-mono text-xs font-medium bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] transition-colors"
                  >
                    Today
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={goToPrevMonth}
                  className="p-2 rounded-lg hover:bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                  aria-label="Previous month"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg hover:bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                  aria-label="Next month"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Week day headers */}
            <div className="grid grid-cols-7 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center font-mono text-[0.65rem] text-[var(--muted)] uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const isSelected = selectedDate && isSameDay(day.date, selectedDate);
                const hasEvents = day.events.length > 0;
                const categories = getDayCategories(day.events);
                const density = day.events.length / maxEventsInDay;
                const hasGoing = day.events.some(e => e.rsvp_status === "going");

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(day.date)}
                    disabled={!day.isCurrentMonth}
                    className={`
                      relative aspect-square p-1 rounded-lg border transition-all duration-200
                      ${day.isCurrentMonth ? "hover:border-[var(--coral)]/50 hover:scale-[1.02]" : "opacity-30 cursor-default"}
                      ${isSelected
                        ? "border-[var(--coral)] bg-[var(--coral)]/15 shadow-[0_0_15px_rgba(232,145,45,0.2)]"
                        : "border-[var(--twilight)]/50 hover:bg-[var(--twilight)]/30"
                      }
                      ${day.isToday ? "ring-2 ring-[var(--gold)] ring-offset-1 ring-offset-[var(--night)]" : ""}
                    `}
                    style={{
                      backgroundColor: hasEvents && day.isCurrentMonth && !isSelected
                        ? `rgba(var(--coral-rgb, 255, 107, 107), ${density * 0.15})`
                        : undefined,
                    }}
                  >
                    {/* Day number */}
                    <span
                      className={`
                        absolute top-1 left-1.5 font-mono text-sm font-medium
                        ${day.isToday ? "text-[var(--gold)]" : ""}
                        ${isSelected ? "text-[var(--coral)]" : ""}
                        ${!day.isToday && !isSelected ? (day.isPast ? "text-[var(--muted)]/60" : "text-[var(--cream)]") : ""}
                      `}
                    >
                      {format(day.date, "d")}
                    </span>

                    {/* Event count badge */}
                    {hasEvents && day.isCurrentMonth && (
                      <span className={`absolute top-1 right-1.5 font-mono text-[0.6rem] font-bold ${hasGoing ? "text-[var(--coral)]" : "text-[var(--muted)]"}`}>
                        {day.events.length}
                      </span>
                    )}

                    {/* Category color dots */}
                    {categories.length > 0 && day.isCurrentMonth && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {categories.map((cat) => (
                          <span
                            key={cat}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: getCategoryColor(cat) || "var(--muted)" }}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.65rem] text-[var(--muted)]">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border-2 border-[var(--gold)]" />
                <span>Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[var(--coral)]/20 border border-[var(--coral)]" />
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[var(--coral)]/15" />
                <span>Your events</span>
              </div>
            </div>

            {/* Summary */}
            {data?.summary && (
              <div className="mt-4 pt-4 border-t border-[var(--twilight)]/50">
                <div className="flex items-center gap-4 text-[var(--muted)] font-mono text-xs">
                  <span>
                    <span className="text-[var(--cream)] font-medium">{data.summary.going}</span> going
                  </span>
                  <span>
                    <span className="text-[var(--cream)] font-medium">{data.summary.interested}</span> interested
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Selected Day Detail */}
          <div className="bg-[var(--night)] rounded-xl p-6 border border-[var(--twilight)] h-fit lg:sticky lg:top-4">
            {selectedDate ? (
              <div>
                {/* Date header */}
                <div className="mb-4">
                  <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                    {format(selectedDate, "EEEE")}
                  </div>
                  <div className="font-mono text-xl font-bold text-[var(--cream)]">
                    {format(selectedDate, "MMMM d, yyyy")}
                  </div>
                  {isToday(selectedDate) && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[var(--gold)] text-[var(--void)] font-mono text-[0.6rem] font-medium">
                      TODAY
                    </span>
                  )}
                </div>

                {/* Events list */}
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]">
                        <div className="h-3 w-16 rounded skeleton-shimmer mb-2" />
                        <div className="h-4 w-3/4 rounded skeleton-shimmer mb-1" />
                        <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                      </div>
                    ))}
                  </div>
                ) : selectedDayEvents.length > 0 ? (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
                    {selectedDayEvents.map((event) => {
                      const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
                      const categoryColor = event.category ? getCategoryColor(event.category) : null;

                      return (
                        <Link
                          key={event.id}
                          href={`/la?event=${event.id}`}
                          scroll={false}
                          className="block p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] hover:border-[var(--coral)]/50 transition-colors group"
                          style={{
                            borderLeftWidth: categoryColor ? "3px" : undefined,
                            borderLeftColor: categoryColor || undefined,
                          }}
                        >
                          {/* Time and RSVP status */}
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs text-[var(--muted)]">
                              {time}
                              {period && <span className="text-[0.6rem] ml-0.5 opacity-60">{period}</span>}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-full font-mono text-[0.55rem] font-medium ${
                              event.rsvp_status === "going"
                                ? "bg-[var(--coral)]/20 text-[var(--coral)]"
                                : "bg-[var(--gold)]/20 text-[var(--gold)]"
                            }`}>
                              {event.rsvp_status === "going" ? "GOING" : "INTERESTED"}
                            </span>
                          </div>

                          {/* Title */}
                          <div className="flex items-center gap-2">
                            {event.category && (
                              <CategoryIcon type={event.category} size={14} className="flex-shrink-0 opacity-60" />
                            )}
                            <span className="text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors line-clamp-2">
                              {event.title}
                            </span>
                          </div>

                          {/* Venue */}
                          {event.venue && (
                            <div className="mt-1 text-xs text-[var(--muted)] truncate">
                              {event.venue.name}
                              {event.venue.neighborhood && (
                                <span className="opacity-60"> · {event.venue.neighborhood}</span>
                              )}
                            </div>
                          )}

                          {/* Free badge */}
                          {event.is_free && (
                            <span className="inline-block mt-2 px-1.5 py-0.5 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-mono text-[0.55rem] font-medium">
                              FREE
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
                      <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-[var(--soft)] font-mono text-sm">No events</p>
                    <p className="text-[var(--muted)]/60 text-xs mt-1">
                      {isBefore(selectedDate, new Date()) && !isToday(selectedDate)
                        ? "Nothing from this day"
                        : "RSVP to events to see them here"}
                    </p>
                    <Link
                      href="/la"
                      className="inline-block mt-4 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
                    >
                      Explore Events
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--muted)]">
                <p className="font-mono text-sm">Select a day to see events</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
