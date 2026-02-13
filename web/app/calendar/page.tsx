"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "@/components/SmartImage";
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
import CategoryIcon from "@/components/CategoryIcon";
import { formatTimeSplit } from "@/lib/formats";
import { useQuery } from "@tanstack/react-query";
import CalendarViewToggle, { type CalendarView } from "@/components/calendar/CalendarViewToggle";
import DayCell from "@/components/calendar/DayCell";
import WeekView from "@/components/calendar/WeekView";
import AgendaView from "@/components/calendar/AgendaView";
import WeekStrip, { type WeekStripDay } from "@/components/calendar/WeekStrip";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";

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

// Type for friend calendar events
interface FriendCalendarEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  category: string | null;
  rsvp_status: "going" | "interested";
  friend: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Type for friend profile
interface Friend {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface DayData {
  date: Date;
  events: CalendarEvent[];
  friendEvents: FriendCalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

const CALENDAR_ROWS = 6;
const CALENDAR_DAYS = CALENDAR_ROWS * 7;

// Status filter options
type StatusFilter = "all" | "going" | "interested";

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All RSVPs" },
  { value: "going", label: "Going" },
  { value: "interested", label: "Interested" },
];

function formatCategoryLabel(category: string): string {
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CalendarPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const portalSlug = DEFAULT_PORTAL_SLUG;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentView, setCurrentView] = useState<CalendarView>("month");
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [friendsPanelOpen, setFriendsPanelOpen] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [feedUrls, setFeedUrls] = useState<{
    feedUrl: string;
    googleCalendarUrl: string;
    outlookUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch user's calendar events
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
    staleTime: 60000,
  });

  // Fetch friends' calendar events
  const { data: friendsData } = useQuery({
    queryKey: ["friends-calendar", currentMonth.getMonth(), currentMonth.getFullYear(), Array.from(selectedFriendIds)],
    queryFn: async () => {
      const start = format(startOfMonth(subMonths(currentMonth, 1)), "yyyy-MM-dd");
      const end = format(addMonths(currentMonth, 2), "yyyy-MM-dd");
      const friendIds = Array.from(selectedFriendIds).join(",");

      const res = await fetch(`/api/user/calendar/friends?start=${start}&end=${end}${friendIds ? `&friend_ids=${friendIds}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch friend calendars");
      return res.json();
    },
    enabled: !!user && selectedFriendIds.size > 0,
    staleTime: 60000,
  });

  // Fetch friends list for selector
  const { data: friendsList } = useQuery({
    queryKey: ["friends-list"],
    queryFn: async () => {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Failed to fetch friends");
      return res.json();
    },
    enabled: !!user,
    staleTime: 300000, // 5 minutes
  });

  // Fetch feed URLs for sync
  useEffect(() => {
    if (user && !feedUrls) {
      fetch("/api/user/calendar/feed-url")
        .then((res) => res.json())
        .then((urls) => setFeedUrls(urls))
        .catch((err) => console.error("Failed to fetch feed URLs:", err));
    }
  }, [user, feedUrls]);

  // Build events by date map (user events)
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

  // Build friend events by date map
  const friendEventsByDate = useMemo(() => {
    const map = new Map<string, FriendCalendarEvent[]>();
    const events = friendsData?.events;
    if (events) {
      events.forEach((event: FriendCalendarEvent) => {
        const dateKey = event.start_date;
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(event);
      });
    }
    return map;
  }, [friendsData]);

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
        friendEvents: friendEventsByDate.get(dateKey) || [],
        isCurrentMonth: isSameMonth(day, monthStart),
        isToday: isToday(day),
        isPast: isBefore(day, today) && !isToday(day),
      });
      day = addDays(day, 1);
    }

    return days;
  }, [currentMonth, eventsByDate, friendEventsByDate]);

  // Selected day's events (user + friends)
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  const selectedDayFriendEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return friendEventsByDate.get(dateKey) || [];
  }, [selectedDate, friendEventsByDate]);

  const mobileWeekStripDays = useMemo((): WeekStripDay[] => {
    const referenceDate = selectedDate || currentMonth;
    const weekStart = startOfWeek(referenceDate);
    const now = new Date();
    const days: WeekStripDay[] = [];

    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const dateKey = format(date, "yyyy-MM-dd");
      const dayEvents = eventsByDate.get(dateKey) || [];
      const dayFriendEvents = friendEventsByDate.get(dateKey) || [];
      const combinedCount = dayEvents.length + dayFriendEvents.length;
      const topCategory = dayEvents[0]?.category || dayFriendEvents[0]?.category || null;

      days.push({
        date,
        dateKey,
        eventCount: combinedCount,
        topCategory,
        isToday: isToday(date),
        isPast: isBefore(date, now) && !isToday(date),
        isSelected: selectedDate ? isSameDay(date, selectedDate) : false,
      });
    }

    return days;
  }, [currentMonth, eventsByDate, friendEventsByDate, selectedDate]);

  const selectedDayCategories = useMemo(() => {
    const combined = [...selectedDayEvents, ...selectedDayFriendEvents];
    return Array.from(new Set(combined.map((event) => event.category).filter(Boolean))).slice(0, 4) as string[];
  }, [selectedDayEvents, selectedDayFriendEvents]);

  // Navigation handlers
  const goToPrevMonth = useCallback(() => setCurrentMonth((m) => subMonths(m, 1)), []);
  const goToNextMonth = useCallback(() => setCurrentMonth((m) => addMonths(m, 1)), []);
  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  }, []);

  const buildFindHref = useCallback((date: Date, category?: string) => {
    const params = new URLSearchParams();
    params.set("view", "find");
    params.set("type", "events");
    params.set("date", format(date, "yyyy-MM-dd"));
    params.set("from", "calendar");
    params.set("return_to", `/calendar?date=${format(date, "yyyy-MM-dd")}`);
    if (category) {
      params.set("categories", category);
    }
    return `/${portalSlug}?${params.toString()}`;
  }, [portalSlug]);

  useEffect(() => {
    const dateParam = searchParams.get("date");
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return;
    }

    const parsedDate = new Date(`${dateParam}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return;
    }

    const shouldUpdateSelection = !selectedDate || !isSameDay(selectedDate, parsedDate);
    const shouldUpdateMonth = !isSameMonth(currentMonth, parsedDate);

    if (!shouldUpdateSelection && !shouldUpdateMonth) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (shouldUpdateSelection) {
        setSelectedDate(parsedDate);
      }
      if (shouldUpdateMonth) {
        setCurrentMonth(parsedDate);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [currentMonth, searchParams, selectedDate]);

  // Toggle friend selection
  const toggleFriend = (friendId: string) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  };

  // Copy feed URL to clipboard
  const copyFeedUrl = async () => {
    if (feedUrls?.feedUrl) {
      await navigator.clipboard.writeText(feedUrls.feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const friends: Friend[] = friendsList?.friends || [];
  const allEvents: CalendarEvent[] = data?.events || [];
  const allFriendEvents: FriendCalendarEvent[] = friendsData?.events || [];

  if (!user) {
    return null; // Layout handles redirect
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
      <section className="rounded-2xl border border-[var(--twilight)]/85 bg-gradient-to-b from-[var(--night)]/94 to-[var(--void)]/86 shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur-md p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-[var(--cream)]">My Calendar</h1>
            <p className="mt-1 font-mono text-sm text-[var(--muted)]">
              RSVPs, friend overlap, and quick planning in one place
            </p>
          </div>
          {data?.summary && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--twilight)]/70 bg-[var(--void)]/72 font-mono text-xs text-[var(--soft)]">
                <span className="text-[var(--cream)] font-semibold">{data.summary.total}</span>
                total
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--coral)]/35 bg-[var(--coral)]/15 font-mono text-xs text-[var(--coral)]">
                {data.summary.going} going
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--gold)]/35 bg-[var(--gold)]/15 font-mono text-xs text-[var(--gold)]">
                {data.summary.interested} interested
              </span>
            </div>
          )}
        </div>

        <div className="mt-3.5 pt-3.5 border-t border-[var(--twilight)]/65 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarViewToggle currentView={currentView} onViewChange={setCurrentView} />
              <div className="flex rounded-full bg-[var(--void)]/70 border border-[var(--twilight)]/80 p-0.5">
                {STATUS_FILTER_OPTIONS.map((option) => {
                  const isActive = statusFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setStatusFilter(option.value)}
                      className={`px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[var(--cream)] text-[var(--void)] shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                          : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFriendsPanelOpen(!friendsPanelOpen)}
                className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg font-mono text-xs transition-colors ${
                  selectedFriendIds.size > 0
                    ? "bg-[var(--neon-magenta)]/15 border-[var(--neon-magenta)]/50 text-[var(--neon-magenta)]"
                    : "bg-[var(--void)]/65 border-[var(--twilight)]/75 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Friends
                {selectedFriendIds.size > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[var(--neon-magenta)] text-[var(--void)] text-[0.6rem] font-bold">
                    {selectedFriendIds.size}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  onClick={() => setSyncMenuOpen(!syncMenuOpen)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-[var(--void)]/65 border border-[var(--twilight)]/75 rounded-lg font-mono text-xs text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync
                </button>

                {syncMenuOpen && feedUrls && (
                  <div className="absolute right-0 mt-2 w-64 bg-[var(--midnight-blue)] border border-[var(--twilight)] rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--twilight)]/70">
                      <p className="font-mono text-xs text-[var(--muted)]">Subscribe to your calendar</p>
                    </div>

                    <a
                      href={feedUrls.googleCalendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setSyncMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)]/60 hover:text-[var(--cream)] transition-colors"
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
                      className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)]/60 hover:text-[var(--cream)] transition-colors"
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
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight)]/60 hover:text-[var(--cream)] transition-colors text-left"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {copied ? "Copied!" : "Copy iCal URL"}
                    </button>
                  </div>
                )}
              </div>

              <Link
                href={`/${portalSlug}?view=find&type=events&display=calendar${selectedDate ? `&date=${format(selectedDate, "yyyy-MM-dd")}` : ""}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--twilight)]/75 bg-[var(--void)]/65 text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45 font-mono text-xs transition-colors"
              >
                Find Calendar
              </Link>
            </div>
          </div>
        </div>
      </section>

      {friendsPanelOpen && (
        <section className="p-4 rounded-2xl border border-[var(--twilight)]/80 bg-[var(--void)]/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-mono text-sm font-medium text-[var(--cream)]">Overlay friends&apos; plans</h3>
            {selectedFriendIds.size > 0 && (
              <button
                onClick={() => setSelectedFriendIds(new Set())}
                className="font-mono text-xs text-[var(--muted)] hover:text-[var(--coral)] transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          {friends.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {friends.map((friend) => {
                const isSelected = selectedFriendIds.has(friend.id);
                return (
                  <button
                    key={friend.id}
                    onClick={() => toggleFriend(friend.id)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-xs transition-colors border ${
                      isSelected
                        ? "bg-[var(--neon-magenta)] text-[var(--void)] border-[var(--neon-magenta)]"
                        : "bg-[var(--twilight)]/45 text-[var(--soft)] border-[var(--twilight)]/70 hover:bg-[var(--twilight)]/70"
                    }`}
                  >
                    {friend.avatar_url ? (
                      <Image
                        src={friend.avatar_url}
                        alt=""
                        width={18}
                        height={18}
                        className="w-[18px] h-[18px] rounded-full object-cover"
                      />
                    ) : (
                      <span className="w-[18px] h-[18px] rounded-full bg-[var(--cosmic-blue)] flex items-center justify-center text-[0.5rem]">
                        {(friend.display_name || friend.username)[0].toUpperCase()}
                      </span>
                    )}
                    {friend.display_name || friend.username}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[var(--muted)] font-mono text-xs">
              No friends yet. Follow people who follow you back to see their plans.
            </p>
          )}
        </section>
      )}

      {currentView === "week" ? (
        <WeekView
          currentDate={currentMonth}
          onDateChange={setCurrentMonth}
          eventsByDate={eventsByDate}
          onDayClick={setSelectedDate}
          selectedDate={selectedDate}
          portalSlug={portalSlug}
        />
      ) : currentView === "agenda" ? (
        <AgendaView
          events={allEvents}
          friendEvents={allFriendEvents}
          eventsByDate={eventsByDate}
          friendEventsByDate={friendEventsByDate}
          portalSlug={portalSlug}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-4">
          <section className="rounded-2xl border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-5">
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
                    className="px-2.5 py-1 rounded-full font-mono text-xs font-semibold bg-[var(--gold)] text-[var(--void)] hover:bg-[var(--coral)] transition-colors"
                  >
                    Today
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 p-0.5 rounded-xl border border-[var(--twilight)]/80 bg-[var(--void)]/60">
                <button
                  onClick={goToPrevMonth}
                  className="p-2 rounded-lg hover:bg-[var(--twilight)]/70 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                  aria-label="Previous month"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg hover:bg-[var(--twilight)]/70 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                  aria-label="Next month"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="sm:hidden mb-3 px-0.5">
              <WeekStrip days={mobileWeekStripDays} onSelect={setSelectedDate} />
              <div className="mt-2 text-[0.65rem] font-mono text-[var(--muted)]">
                Week focus on mobile. Use arrows to move month.
              </div>
            </div>

            <div className="hidden sm:grid grid-cols-7 mb-1">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="py-1.5 text-center font-mono text-[0.58rem] text-[var(--muted)] uppercase tracking-[0.14em]"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="hidden sm:grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => (
                <DayCell
                  key={idx}
                  date={day.date}
                  events={day.events}
                  friendEvents={day.friendEvents}
                  isCurrentMonth={day.isCurrentMonth}
                  isToday={day.isToday}
                  isPast={day.isPast}
                  isSelected={selectedDate ? isSameDay(day.date, selectedDate) : false}
                  onClick={() => setSelectedDate(day.date)}
                />
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--twilight)]/65 hidden sm:flex flex-wrap items-center gap-3 text-[0.65rem] text-[var(--muted)] font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border-2 border-[var(--gold)]" />
                Today
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--coral)]" />
                Going
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--gold)]" />
                Interested
              </span>
              {selectedFriendIds.size > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-[var(--twilight)] border border-[var(--twilight)]/70" />
                  Friends
                </span>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] h-fit xl:sticky xl:top-20">
            {selectedDate ? (
              <div>
                <div className="sticky top-0 z-10 px-4 py-3 border-b border-[var(--twilight)]/65 bg-[var(--void)]/92 backdrop-blur-sm">
                  <div className="font-mono text-[11px] text-[var(--muted)] uppercase tracking-widest">
                    {format(selectedDate, "EEEE")}
                  </div>
                  <div className="font-mono text-[1.4rem] leading-none font-bold text-[var(--cream)] mt-1">
                    {format(selectedDate, "MMMM d, yyyy")}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {isToday(selectedDate) && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--gold)] text-[var(--void)] font-mono text-[0.6rem] font-medium">
                        TODAY
                      </span>
                    )}
                    <span className="inline-block px-2 py-0.5 rounded-full border border-[var(--twilight)]/75 bg-[var(--dusk)]/70 text-[var(--soft)] font-mono text-[0.6rem] font-medium">
                      {selectedDayEvents.length + selectedDayFriendEvents.length} planned
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Link
                      href={buildFindHref(selectedDate)}
                      className="inline-flex items-center px-2 py-1 rounded-full border border-[var(--coral)]/45 bg-[var(--coral)]/15 text-[var(--coral)] hover:bg-[var(--coral)]/24 transition-colors font-mono text-[0.62rem] font-medium"
                    >
                      Add from Find
                    </Link>
                    {selectedDayCategories.map((category) => (
                      <Link
                        key={category}
                        href={buildFindHref(selectedDate, category)}
                        className="inline-flex items-center px-2 py-1 rounded-full border border-[var(--twilight)]/70 bg-[var(--void)]/70 text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--coral)]/40 transition-colors font-mono text-[0.62rem]"
                      >
                        {formatCategoryLabel(category)}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 space-y-4">
                  {selectedDayEvents.length > 0 && (
                    <div>
                      <h4 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">Your Events</h4>
                      <div className="space-y-2">
                        {selectedDayEvents.map((event) => {
                          const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);

                          return (
                            <Link
                              key={event.id}
                              href={`/${portalSlug}?event=${event.id}`}
                              scroll={false}
                              className={`find-row-card block rounded-xl border border-[var(--twilight)]/75 overflow-hidden group ${
                                event.rsvp_status === "going" ? "border-l-[3px] border-l-[var(--coral)]" : "border-l-[3px] border-l-[var(--gold)]"
                              }`}
                            >
                              <div className="flex">
                                {event.image_url ? (
                                  <div className="relative w-16 sm:w-[72px] flex-shrink-0 list-rail-media">
                                    <Image
                                      src={event.image_url}
                                      alt=""
                                      fill
                                      className="object-cover"
                                      sizes="96px"
                                    />
                                  </div>
                                ) : null}
                                <div className="p-3 flex-1 min-w-0 bg-[var(--card-bg)]/90">
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className="font-mono text-xs text-[var(--soft)]">
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
                                  <div className="flex items-center gap-2">
                                    {event.category && (
                                      <CategoryIcon type={event.category} size={13} className="flex-shrink-0 opacity-70" />
                                    )}
                                    <span className="text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors text-sm leading-snug line-clamp-2">
                                      {event.title}
                                    </span>
                                  </div>
                                  {event.venue && (
                                    <div className="mt-1 text-[11px] text-[var(--muted)] truncate">
                                      {event.venue.name}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedDayFriendEvents.length > 0 && (
                    <div>
                      <h4 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">Friends&apos; Events</h4>
                      <div className="space-y-2">
                        {selectedDayFriendEvents.map((event, idx) => {
                          const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);

                          return (
                            <Link
                              key={`${event.id}-${event.friend.id}-${idx}`}
                              href={`/${portalSlug}?event=${event.id}`}
                              scroll={false}
                              className="find-row-card block rounded-xl border border-[var(--twilight)]/75 bg-[var(--card-bg)]/85 p-3 group"
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                {event.friend.avatar_url ? (
                                  <Image
                                    src={event.friend.avatar_url}
                                    alt=""
                                    width={18}
                                    height={18}
                                    className="w-[18px] h-[18px] rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="w-[18px] h-[18px] rounded-full bg-[var(--cosmic-blue)] flex items-center justify-center text-[0.5rem] text-[var(--muted)]">
                                    {(event.friend.display_name || event.friend.username)[0].toUpperCase()}
                                  </span>
                                )}
                                <span className="font-mono text-xs text-[var(--soft)] truncate">
                                  {event.friend.display_name || event.friend.username}
                                </span>
                                <span className={`ml-auto px-1.5 py-0.5 rounded-full font-mono text-[0.55rem] font-medium ${
                                  event.rsvp_status === "going"
                                    ? "bg-[var(--coral)]/20 text-[var(--coral)]"
                                    : "bg-[var(--gold)]/20 text-[var(--gold)]"
                                }`}>
                                  {event.rsvp_status === "going" ? "GOING" : "INTERESTED"}
                                </span>
                              </div>

                              <div className="font-mono text-xs text-[var(--muted)] mb-1">
                                {time}
                                {period && <span className="text-[0.6rem] ml-0.5 opacity-60">{period}</span>}
                              </div>

                              <span className="text-sm text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors line-clamp-2">
                                {event.title}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedDayEvents.length === 0 && selectedDayFriendEvents.length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--twilight)]/35 flex items-center justify-center">
                        <svg className="w-7 h-7 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-[var(--soft)] font-mono text-sm">No events on this day</p>
                      <p className="text-[var(--muted)]/70 text-xs mt-1">
                        {isBefore(selectedDate, new Date()) && !isToday(selectedDate)
                          ? "Nothing recorded from this date."
                          : "Use Find to add events to your calendar."}
                      </p>
                      <Link
                        href={buildFindHref(selectedDate)}
                        className="inline-flex mt-4 px-4 py-2 rounded-lg border border-[var(--coral)]/45 bg-[var(--coral)]/18 text-[var(--coral)] font-mono text-xs font-medium hover:bg-[var(--coral)]/24 transition-colors"
                      >
                        Explore in Find
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--muted)]">
                <p className="font-mono text-sm">Select a day to see events</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
