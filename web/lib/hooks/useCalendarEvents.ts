"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

/**
 * Calendar event (minimal fields for calendar display)
 */
export interface CalendarEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  category: string | null;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  venue?: {
    name: string;
    neighborhood: string | null;
  } | null;
}

/**
 * Calendar summary statistics
 */
export interface CalendarSummary {
  totalEvents: number;
  daysWithEvents: number;
  categoryCounts: Record<string, number>;
}

/**
 * Response from /api/calendar
 */
interface CalendarResponse {
  eventsByDate: Record<string, CalendarEvent[]>;
  summary: CalendarSummary;
}

/**
 * Options for useCalendarEvents hook
 */
interface UseCalendarEventsOptions {
  month: number; // 1-12
  year: number;
  portalId?: string;
  portalExclusive?: boolean;
  enabled?: boolean;
}

/**
 * Hook for fetching calendar events for a specific month
 *
 * Uses React Query for caching - switching months will use cached data if available
 */
export function useCalendarEvents(options: UseCalendarEventsOptions) {
  const { month, year, portalId, portalExclusive, enabled = true } = options;
  const searchParams = useSearchParams();

  // Create stable query key from filter params (exclude date-related params)
  const filtersKey = useMemo(() => {
    const params = new URLSearchParams();
    const filterKeys = ["categories", "neighborhoods", "price"];
    filterKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [searchParams]);

  // Build API params
  const buildApiParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("month", month.toString());
    params.set("year", year.toString());

    // Pass through non-date filters
    const categories = searchParams.get("categories");
    const neighborhoods = searchParams.get("neighborhoods");
    const price = searchParams.get("price");

    if (categories) params.set("categories", categories);
    if (neighborhoods) params.set("neighborhoods", neighborhoods);
    if (price) params.set("price", price);

    // Portal params
    if (portalId && portalId !== "default") {
      params.set("portal_id", portalId);
    }
    if (portalExclusive) {
      params.set("portal_exclusive", "true");
    }

    return params.toString();
  }, [month, year, searchParams, portalId, portalExclusive]);

  const query = useQuery<CalendarResponse, Error>({
    queryKey: ["events", "calendar", month, year, filtersKey, portalId, portalExclusive],
    queryFn: async () => {
      const res = await fetch(`/api/calendar?${buildApiParams}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch calendar events: ${res.status}`);
      }

      return res.json();
    },
    enabled,
    // Keep calendar data fresh for longer since it's a month view
    staleTime: 60 * 1000, // 1 minute
  });

  // Convert eventsByDate object to Map for easier lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (query.data?.eventsByDate) {
      Object.entries(query.data.eventsByDate).forEach(([date, events]) => {
        map.set(date, events);
      });
    }
    return map;
  }, [query.data?.eventsByDate]);

  // Get summary with defaults
  const summary = useMemo((): CalendarSummary => {
    return query.data?.summary || {
      totalEvents: 0,
      daysWithEvents: 0,
      categoryCounts: {},
    };
  }, [query.data?.summary]);

  return {
    eventsByDate,
    summary,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error?.message || null,
    refetch: query.refetch,
    // Expose raw query for advanced use cases
    query,
  };
}

/**
 * Type for the return value of useCalendarEvents
 */
export type UseCalendarEventsReturn = ReturnType<typeof useCalendarEvents>;
