"use client";

import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, subMonths, addMonths } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { useCalendar } from "./CalendarProvider";
import type {
  CalendarEvent,
  CalendarPlan,
  FriendCalendarEvent,
  Friend,
  CalendarSummary,
} from "@/lib/types/calendar";

interface CalendarData {
  events: CalendarEvent[];
  plans: CalendarPlan[];
  summary: CalendarSummary;
}

export function useCalendarEvents() {
  const { user } = useAuth();
  const { state } = useCalendar();
  const { currentMonth, statusFilter } = state;

  return useQuery<CalendarData>({
    queryKey: [
      "user-calendar",
      currentMonth.getMonth(),
      currentMonth.getFullYear(),
      statusFilter,
    ],
    queryFn: async () => {
      const start = format(
        startOfMonth(subMonths(currentMonth, 1)),
        "yyyy-MM-dd"
      );
      const end = format(addMonths(currentMonth, 2), "yyyy-MM-dd");
      const statusParam =
        statusFilter === "all" ? "going,interested" : statusFilter;

      const res = await fetch(
        `/api/user/calendar?start=${start}&end=${end}&status=${statusParam}`
      );
      if (!res.ok) throw new Error("Failed to fetch calendar");
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useFriendCalendarEvents() {
  const { user } = useAuth();
  const { state } = useCalendar();
  const { currentMonth, selectedFriendIds } = state;

  return useQuery<{ events: FriendCalendarEvent[] }>({
    queryKey: [
      "friends-calendar",
      currentMonth.getMonth(),
      currentMonth.getFullYear(),
      Array.from(selectedFriendIds),
    ],
    queryFn: async () => {
      const start = format(
        startOfMonth(subMonths(currentMonth, 1)),
        "yyyy-MM-dd"
      );
      const end = format(addMonths(currentMonth, 2), "yyyy-MM-dd");
      const friendIds = Array.from(selectedFriendIds).join(",");

      const res = await fetch(
        `/api/user/calendar/friends?start=${start}&end=${end}${friendIds ? `&friend_ids=${friendIds}` : ""}`
      );
      if (!res.ok) throw new Error("Failed to fetch friend calendars");
      return res.json();
    },
    enabled: !!user && selectedFriendIds.size > 0,
    staleTime: 60_000,
  });
}

export function useFriendsList() {
  const { user } = useAuth();

  return useQuery<{ friends: Friend[] }>({
    queryKey: ["friends-list"],
    queryFn: async () => {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Failed to fetch friends");
      return res.json();
    },
    enabled: !!user,
    staleTime: 300_000,
  });
}

export function useFeedUrls() {
  const { user } = useAuth();

  return useQuery<{
    feedUrl: string;
    googleCalendarUrl: string;
    outlookUrl: string;
  }>({
    queryKey: ["calendar-feed-urls"],
    queryFn: async () => {
      const res = await fetch("/api/user/calendar/feed-url");
      if (!res.ok) throw new Error("Failed to fetch feed URLs");
      return res.json();
    },
    enabled: !!user,
    staleTime: 600_000, // 10 minutes
  });
}
