"use client";

import { useMemo } from "react";
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
} from "date-fns";
import type {
  CalendarEvent,
  CalendarPlan,
  FriendCalendarEvent,
  DayData,
} from "@/lib/types/calendar";
import type { WeekStripDay } from "@/components/calendar/WeekStrip";

const CALENDAR_ROWS = 6;
const CALENDAR_DAYS = CALENDAR_ROWS * 7;

export function useEventsByDate(events: CalendarEvent[] | undefined) {
  return useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (!events) return map;
    for (const event of events) {
      const dateKey = event.start_date;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(event);
    }
    return map;
  }, [events]);
}

export function usePlansByDate(plans: CalendarPlan[] | undefined) {
  return useMemo(() => {
    const map = new Map<string, CalendarPlan[]>();
    if (!plans) return map;
    for (const plan of plans) {
      const dateKey = plan.plan_date;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(plan);
    }
    return map;
  }, [plans]);
}

export function useFriendEventsByDate(
  events: FriendCalendarEvent[] | undefined
) {
  return useMemo(() => {
    const map = new Map<string, FriendCalendarEvent[]>();
    if (!events) return map;
    for (const event of events) {
      const dateKey = event.start_date;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(event);
    }
    return map;
  }, [events]);
}

export function useCalendarGrid(
  currentMonth: Date,
  eventsByDate: Map<string, CalendarEvent[]>,
  friendEventsByDate: Map<string, FriendCalendarEvent[]>,
  plansByDate: Map<string, CalendarPlan[]>
): DayData[] {
  return useMemo(() => {
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
        plans: plansByDate.get(dateKey) || [],
        isCurrentMonth: isSameMonth(day, monthStart),
        isToday: isToday(day),
        isPast: isBefore(day, today) && !isToday(day),
      });
      day = addDays(day, 1);
    }

    return days;
  }, [currentMonth, eventsByDate, friendEventsByDate, plansByDate]);
}

export function useSelectedDayData(
  selectedDate: Date | null,
  eventsByDate: Map<string, CalendarEvent[]>,
  friendEventsByDate: Map<string, FriendCalendarEvent[]>,
  plansByDate: Map<string, CalendarPlan[]>
) {
  return useMemo(() => {
    if (!selectedDate) {
      return {
        events: [] as CalendarEvent[],
        friendEvents: [] as FriendCalendarEvent[],
        plans: [] as CalendarPlan[],
        categories: [] as string[],
      };
    }
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const events = eventsByDate.get(dateKey) || [];
    const friendEvents = friendEventsByDate.get(dateKey) || [];
    const plans = plansByDate.get(dateKey) || [];
    const combined = [
      ...events,
      ...friendEvents,
    ];
    const categories = Array.from(
      new Set(combined.map((e) => e.category).filter(Boolean))
    ).slice(0, 4) as string[];

    return { events, friendEvents, plans, categories };
  }, [selectedDate, eventsByDate, friendEventsByDate, plansByDate]);
}

export function useMobileWeekStrip(
  currentMonth: Date,
  selectedDate: Date | null,
  eventsByDate: Map<string, CalendarEvent[]>,
  friendEventsByDate: Map<string, FriendCalendarEvent[]>
): WeekStripDay[] {
  return useMemo(() => {
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
      const topCategory =
        dayEvents[0]?.category || dayFriendEvents[0]?.category || null;

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
  }, [currentMonth, selectedDate, eventsByDate, friendEventsByDate]);
}
