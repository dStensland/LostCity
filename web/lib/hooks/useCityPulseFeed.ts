"use client";

/**
 * Data fetching hook for the City Pulse feed.
 *
 * Keeps the feed alive:
 *  - Polls every 5 minutes so event data stays fresh
 *  - Immediately refetches on time-slot boundary crossings
 *  - Refetches on window focus (tab switch back)
 *  - Admin overrides bypass cache and poll more aggressively
 */

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState, useCallback, useRef } from "react";
import type { CityPulseResponse, TimeSlot } from "@/lib/city-pulse/types";
import { getTimeSlot, msUntilNextSlot } from "@/lib/city-pulse/time-slots";

/** Normal polling: 5 minutes */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface UseCityPulseFeedOptions {
  portalSlug: string;
  enabled?: boolean;
  /** Admin override: force a specific time slot */
  timeSlotOverride?: TimeSlot;
  /** Admin override: force a specific day of week (e.g. "tuesday") */
  dayOverride?: string;
  /** Active interest chip IDs — drives per-category server queries (6 each) */
  interests?: string[];
}

export function useCityPulseFeed(options: UseCityPulseFeedOptions) {
  const { portalSlug, enabled = true, timeSlotOverride, dayOverride, interests } = options;
  const [timeSlot, setTimeSlot] = useState(() =>
    getTimeSlot(new Date().getHours()),
  );

  // Immediate refetch on time-slot boundary (only when no override active)
  useEffect(() => {
    if (!enabled || timeSlotOverride) return;

    const scheduleNext = () => {
      const ms = msUntilNextSlot();
      const timer = setTimeout(() => {
        setTimeSlot(getTimeSlot(new Date().getHours()));
        scheduleNext();
      }, ms);
      return timer;
    };

    const timer = scheduleNext();
    return () => clearTimeout(timer);
  }, [enabled, timeSlotOverride]);

  const effectiveTimeSlot = timeSlotOverride || timeSlot;
  const hasOverrides = !!(timeSlotOverride || dayOverride);

  // Stable string key for interests so array reference changes don't trigger refetch
  const interestsKey = interests?.slice().sort().join(",") || "";

  // Ref always holds latest interests — safe to read from fetchTab callback
  const interestsRef = useRef(interests);
  useEffect(() => { interestsRef.current = interests; }, [interests]);

  /** Append interests query param to a URL */
  const appendInterests = (url: URL, ints?: string[]) => {
    if (ints && ints.length > 0) url.searchParams.set("interests", ints.join(","));
  };

  const query = useQuery<CityPulseResponse>({
    queryKey: ["city-pulse", portalSlug, effectiveTimeSlot, dayOverride || "", interestsKey],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const url = new URL(`/api/portals/${portalSlug}/city-pulse`, window.location.origin);
        if (timeSlotOverride) url.searchParams.set("time_slot", timeSlotOverride);
        if (dayOverride) url.searchParams.set("day", dayOverride);
        appendInterests(url, interests);

        const res = await fetch(url.toString(), {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`City Pulse fetch failed: ${res.status}`);
        }
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    enabled,
    // Keep showing old data while refetching with a new key (e.g. interests change).
    // Prevents skeleton flash on key transitions.
    placeholderData: keepPreviousData,
    // With heavy sections (regulars, experiences) extracted, the payload is
    // ~80-100KB instead of 760KB — less urgency to refetch constantly.
    staleTime: hasOverrides ? 0 : 2 * 60 * 1000, // 2 min
    gcTime: 10 * 60 * 1000,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const refresh = useCallback(() => {
    query.refetch();
  }, [query]);

  const fetchTab = useCallback(async (tab: "this_week" | "coming_up") => {
    const url = new URL(`/api/portals/${portalSlug}/city-pulse`, window.location.origin);
    url.searchParams.set("tab", tab);
    if (timeSlotOverride) url.searchParams.set("time_slot", timeSlotOverride);
    if (dayOverride) url.searchParams.set("day", dayOverride);
    appendInterests(url, interestsRef.current);
    const res = await fetch(url.toString(), { credentials: "include" });
    if (!res.ok) throw new Error(`Tab fetch failed: ${res.status}`);
    return res.json() as Promise<CityPulseResponse>;
  }, [portalSlug, timeSlotOverride, dayOverride]);

  return {
    data: query.data ?? null,
    context: query.data?.context ?? null,
    header: query.data?.header ?? null,
    sections: query.data?.sections ?? [],
    curatedSections: query.data?.curated_sections ?? [],
    personalization: query.data?.personalization ?? null,
    tabCounts: query.data?.tab_counts ?? null,
    categoryCounts: query.data?.category_counts ?? null,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error?.message ?? null,
    refresh,
    fetchTab,
    timeSlot: effectiveTimeSlot,
  };
}
