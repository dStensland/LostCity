"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getLocalDateString } from "@/lib/formats";

interface Meta {
  available_dates: string[];
}

interface ApiResponse<T> {
  shows: T[];
  meta?: Meta;
}

interface CachedData<T> {
  shows: T[];
  loaded: boolean;
}

export interface UseShowListingsConfig {
  /** API path, e.g. "/api/whats-on/music" */
  apiPath: string;
  portalSlug: string;
}

export interface UseShowListingsResult<T> {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  shows: T[];
  loading: boolean;
  metaLoading: boolean;
  datePills: string[];
}

/**
 * Shared hook for show listing views (Music, Stage).
 * Handles meta+data fetching, client-side caching, adjacent-date prefetch,
 * and AbortController for fetch race conditions.
 */
export function useShowListings<T extends { event_id: number }>(
  config: UseShowListingsConfig,
): UseShowListingsResult<T> {
  const { apiPath } = config;
  const today = getLocalDateString(new Date());

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [shows, setShows] = useState<T[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);

  const cacheRef = useRef<Map<string, CachedData<T>>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const prefetchDate = useCallback(
    (date: string) => {
      if (cacheRef.current.has(date)) return;
      cacheRef.current.set(date, { shows: [], loaded: false });
      const url = new URL(apiPath, window.location.origin);
      url.searchParams.set("date", date);
      fetch(url.toString())
        .then((res) => (res.ok ? res.json() : null))
        .then((data: ApiResponse<T> | null) => {
          if (!data) {
            cacheRef.current.delete(date);
            return;
          }
          cacheRef.current.set(date, { shows: data.shows || [], loaded: true });
        })
        .catch(() => {
          cacheRef.current.delete(date);
        });
    },
    [apiPath],
  );

  const prefetchAdjacent = useCallback(
    (date: string, dates: string[]) => {
      const idx = dates.indexOf(date);
      if (idx >= 0) {
        if (idx > 0) prefetchDate(dates[idx - 1]);
        if (idx < dates.length - 1) prefetchDate(dates[idx + 1]);
      }
    },
    [prefetchDate],
  );

  const fetchShows = useCallback(
    async (date: string) => {
      if (!date) return;

      // Abort any in-flight request for a different date
      abortRef.current?.abort();

      const cached = cacheRef.current.get(date);
      if (cached?.loaded) {
        setShows(cached.shows);
        setLoading(false);
        prefetchAdjacent(date, meta?.available_dates || []);
        return;
      }

      setLoading(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const url = new URL(apiPath, window.location.origin);
        url.searchParams.set("date", date);
        const res = await fetch(url.toString(), {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: ApiResponse<T> = await res.json();
        const fetched = data.shows || [];

        // Only update state if this request wasn't aborted
        if (!controller.signal.aborted) {
          setShows(fetched);
          cacheRef.current.set(date, { shows: fetched, loaded: true });
          prefetchAdjacent(date, meta?.available_dates || []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [apiPath, meta?.available_dates, prefetchAdjacent],
  );

  // Fetch meta + initial data on mount
  useEffect(() => {
    const controller = new AbortController();
    async function fetchMeta() {
      setMetaLoading(true);
      try {
        const dateStr = getLocalDateString(new Date());
        const url = new URL(apiPath, window.location.origin);
        url.searchParams.set("date", dateStr);
        url.searchParams.set("meta", "true");
        const res = await fetch(url.toString(), {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: ApiResponse<T> = await res.json();

        if (controller.signal.aborted) return;

        if (data.meta) setMeta(data.meta);

        const fetched = data.shows || [];
        setShows(fetched);
        cacheRef.current.set(dateStr, { shows: fetched, loaded: true });

        let initialDate = dateStr;
        if (data.meta?.available_dates?.length) {
          initialDate = data.meta.available_dates[0];
        }
        setSelectedDate(initialDate);

        if (data.meta?.available_dates?.length) {
          const dates = data.meta.available_dates;
          const idx = dates.indexOf(initialDate);
          const adjacent = [
            idx > 0 ? dates[idx - 1] : null,
            idx < dates.length - 1 ? dates[idx + 1] : null,
          ].filter((d): d is string => d !== null);
          for (const d of adjacent) {
            prefetchDate(d);
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) {
          setMetaLoading(false);
          setLoading(false);
        }
      }
    }
    fetchMeta();
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when date changes (skip initial load)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchShows(selectedDate);
  }, [selectedDate, fetchShows]);

  // Date pills with 7-day fallback
  const datePills = meta?.available_dates?.length
    ? meta.available_dates
    : (() => {
        const pills: string[] = [];
        const now = new Date();
        for (let i = 0; i < 7; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() + i);
          pills.push(getLocalDateString(d));
        }
        return pills;
      })();

  return {
    selectedDate,
    setSelectedDate,
    shows,
    loading,
    metaLoading,
    datePills,
  };
}
