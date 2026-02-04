"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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

export default function CalendarPage() {
  const { user } = useAuth();
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

  // Navigation handlers
  const goToPrevMonth = useCallback(() => setCurrentMonth((m) => subMonths(m, 1)), []);
  const goToNextMonth = useCallback(() => setCurrentMonth((m) => addMonths(m, 1)), []);
  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  }, []);

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
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--cream)]">My Calendar</h1>
          <p className="mt-1 font-mono text-sm text-[var(--muted)]">
            Your events and friends&apos; plans
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <CalendarViewToggle currentView={currentView} onViewChange={setCurrentView} />

          {/* Friends toggle */}
          <button
            onClick={() => setFriendsPanelOpen(!friendsPanelOpen)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg font-mono text-sm transition-colors ${
              selectedFriendIds.size > 0
                ? "bg-[var(--neon-magenta)]/10 border-[var(--neon-magenta)] text-[var(--neon-magenta)]"
                : "bg-[var(--deep-violet)] border-[var(--nebula)] text-[var(--cream)] hover:bg-[var(--twilight-purple)]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Friends
            {selectedFriendIds.size > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--neon-magenta)] text-[var(--void)] text-[0.6rem] font-bold">
                {selectedFriendIds.size}
              </span>
            )}
          </button>

          {/* Sync dropdown */}
          <div className="relative">
            <button
              onClick={() => setSyncMenuOpen(!syncMenuOpen)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--deep-violet)] border border-[var(--nebula)] rounded-lg font-mono text-sm text-[var(--cream)] hover:bg-[var(--twilight-purple)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync
            </button>

            {syncMenuOpen && feedUrls && (
              <div className="absolute right-0 mt-2 w-64 bg-[var(--midnight-blue)] border border-[var(--nebula)] rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--nebula)]">
                  <p className="font-mono text-xs text-[var(--muted)]">Subscribe to your calendar</p>
                </div>

                <a
                  href={feedUrls.googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSyncMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight-purple)] hover:text-[var(--cream)] transition-colors"
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
                  className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight-purple)] hover:text-[var(--cream)] transition-colors"
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
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--soft)] hover:bg-[var(--twilight-purple)] hover:text-[var(--cream)] transition-colors text-left"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copied ? "Copied!" : "Copy iCal URL"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Friends panel */}
      {friendsPanelOpen && (
        <div className="mb-6 p-4 bg-[var(--deep-violet)] rounded-xl border border-[var(--nebula)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-mono text-sm font-medium text-[var(--cream)]">Show friends&apos; events</h3>
            {selectedFriendIds.size > 0 && (
              <button
                onClick={() => setSelectedFriendIds(new Set())}
                className="font-mono text-xs text-[var(--muted)] hover:text-[var(--neon-magenta)] transition-colors"
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
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-xs transition-colors ${
                      isSelected
                        ? "bg-[var(--neon-magenta)] text-[var(--void)]"
                        : "bg-[var(--twilight-purple)] text-[var(--soft)] hover:bg-[var(--cosmic-blue)]"
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
              No friends yet. Follow people who follow you back to see their events.
            </p>
          )}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-6 bg-[var(--deep-violet)] rounded-lg p-1 w-fit">
        {(["all", "going", "interested"] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-md font-mono text-xs font-medium transition-colors ${
              statusFilter === status
                ? status === "going"
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : status === "interested"
                    ? "bg-[var(--gold)] text-[var(--void)]"
                    : "bg-[var(--cream)] text-[var(--void)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            {status === "all" ? "All" : status === "going" ? "Going" : "Interested"}
          </button>
        ))}
      </div>

      {/* Main content - different based on view */}
      {currentView === "week" ? (
        <WeekView
          currentDate={currentMonth}
          onDateChange={setCurrentMonth}
          eventsByDate={eventsByDate}
          onDayClick={setSelectedDate}
          selectedDate={selectedDate}
        />
      ) : currentView === "agenda" ? (
        <AgendaView
          events={allEvents}
          friendEvents={allFriendEvents}
          eventsByDate={eventsByDate}
          friendEventsByDate={friendEventsByDate}
        />
      ) : (
        /* Month View */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Calendar Grid */}
          <div className="bg-gradient-to-br from-[var(--deep-violet)] to-[var(--midnight-blue)] rounded-xl p-6 border border-[var(--nebula)]">
            {/* Month header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="font-mono text-2xl font-bold text-[var(--cream)]">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                {(isLoading || isRefetching) && (
                  <span className="w-4 h-4 border-2 border-[var(--neon-cyan)]/30 border-t-[var(--neon-cyan)] rounded-full animate-spin" />
                )}
                {!isSameMonth(currentMonth, new Date()) && (
                  <button
                    onClick={goToToday}
                    className="px-3 py-1 rounded-full font-mono text-xs font-medium bg-[var(--neon-cyan)] text-[var(--void)] hover:bg-[var(--neon-cyan)]/80 transition-colors"
                  >
                    Today
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={goToPrevMonth}
                  className="p-2 rounded-lg hover:bg-[var(--twilight-purple)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                  aria-label="Previous month"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={goToNextMonth}
                  className="p-2 rounded-lg hover:bg-[var(--twilight-purple)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
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

            {/* Calendar days - using enhanced DayCell */}
            <div className="grid grid-cols-7 gap-1">
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

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-[0.65rem] text-[var(--muted)]">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border-2 border-[var(--neon-magenta)]" />
                <span>Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--coral)]" />
                <span>Going</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--gold)]" />
                <span>Interested</span>
              </div>
              {selectedFriendIds.size > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-[var(--twilight-purple)]" />
                  <span>Friend going</span>
                </div>
              )}
            </div>

            {/* Summary */}
            {data?.summary && (
              <div className="mt-4 pt-4 border-t border-[var(--nebula)]/50">
                <div className="flex items-center gap-4 text-[var(--muted)] font-mono text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--coral)]" />
                    <span className="text-[var(--cream)] font-medium">{data.summary.going}</span> going
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--gold)]" />
                    <span className="text-[var(--cream)] font-medium">{data.summary.interested}</span> interested
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Selected Day Detail */}
          <div className="bg-gradient-to-br from-[var(--deep-violet)] to-[var(--midnight-blue)] rounded-xl p-6 border border-[var(--nebula)] h-fit lg:sticky lg:top-20">
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
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[var(--neon-magenta)] text-[var(--void)] font-mono text-[0.6rem] font-medium">
                      TODAY
                    </span>
                  )}
                </div>

                {/* Your events */}
                {selectedDayEvents.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">Your Events</h4>
                    <div className="space-y-2">
                      {selectedDayEvents.map((event) => {
                        const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);

                        return (
                          <Link
                            key={event.id}
                            href={`/la?event=${event.id}`}
                            scroll={false}
                            className="block p-3 rounded-lg border border-[var(--nebula)] bg-[var(--cosmic-blue)]/30 hover:border-[var(--neon-cyan)]/50 transition-colors group"
                            style={{
                              borderLeftWidth: "3px",
                              borderLeftColor: event.rsvp_status === "going" ? "var(--coral)" : "var(--gold)",
                            }}
                          >
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

                            <div className="flex items-center gap-2">
                              {event.category && (
                                <CategoryIcon type={event.category} size={14} className="flex-shrink-0 opacity-60" />
                              )}
                              <span className="text-[var(--cream)] group-hover:text-[var(--neon-cyan)] transition-colors line-clamp-2">
                                {event.title}
                              </span>
                            </div>

                            {event.venue && (
                              <div className="mt-1 text-xs text-[var(--muted)] truncate">
                                {event.venue.name}
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Friends' events */}
                {selectedDayFriendEvents.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">Friends&apos; Events</h4>
                    <div className="space-y-2">
                      {selectedDayFriendEvents.map((event, idx) => {
                        const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);

                        return (
                          <Link
                            key={`${event.id}-${event.friend.id}-${idx}`}
                            href={`/la?event=${event.id}`}
                            scroll={false}
                            className="block p-3 rounded-lg border border-[var(--nebula)] bg-[var(--twilight-purple)]/30 hover:border-[var(--neon-cyan)]/50 transition-colors group"
                          >
                            <div className="flex items-center gap-2 mb-1">
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
                              <span className="font-mono text-xs text-[var(--soft)]">
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

                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-[var(--muted)]">
                                {time}
                                {period && <span className="text-[0.6rem] ml-0.5 opacity-60">{period}</span>}
                              </span>
                            </div>

                            <span className="text-sm text-[var(--cream)] group-hover:text-[var(--neon-cyan)] transition-colors line-clamp-2">
                              {event.title}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {selectedDayEvents.length === 0 && selectedDayFriendEvents.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--twilight-purple)]/30 flex items-center justify-center">
                      <svg className="w-7 h-7 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      className="inline-block mt-4 px-4 py-2 bg-[var(--neon-cyan)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--neon-cyan)]/80 transition-colors"
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
      )}
    </div>
  );
}
