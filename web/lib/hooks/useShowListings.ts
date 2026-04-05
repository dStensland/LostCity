"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getLocalDateString } from "@/lib/formats";

interface Meta {
  available_dates: string[];
}

interface ApiResponse<T> {
  date: string;
  shows: T[];
  meta?: Meta;
}

interface CachedData<T> {
  shows: T[];
  loaded: boolean;
}

export interface UseShowListingsInitialPayload<T> {
  date: string;
  meta: Meta;
  shows: T[];
  requestKey: string;
}

export interface UseShowListingsConfig<T> {
  apiPath: string;
  portalSlug: string;
  initialPayload?: UseShowListingsInitialPayload<T> | null;
}

export interface UseShowListingsResult<T> {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  shows: T[];
  loading: boolean;
  metaLoading: boolean;
  datePills: string[];
}

function scheduleIdle(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }

  const timeoutId = globalThis.setTimeout(callback, 1200);
  return () => globalThis.clearTimeout(timeoutId);
}

export function useShowListings<T extends { event_id: number }>(
  config: UseShowListingsConfig<T>,
): UseShowListingsResult<T> {
  const { apiPath, portalSlug, initialPayload } = config;
  const today = getLocalDateString(new Date());

  const [selectedDate, setSelectedDate] = useState<string>(
    initialPayload?.date ?? today,
  );
  const [shows, setShows] = useState<T[]>(initialPayload?.shows ?? []);
  const [meta, setMeta] = useState<Meta | null>(initialPayload?.meta ?? null);
  const [loading, setLoading] = useState(!initialPayload);
  const [metaLoading, setMetaLoading] = useState(!initialPayload);

  const cacheRef = useRef<Map<string, CachedData<T>>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!initialPayload) return;
    cacheRef.current.set(initialPayload.date, {
      shows: initialPayload.shows,
      loaded: true,
    });
  }, [initialPayload]);

  const prefetchDate = useCallback(
    (date: string) => {
      if (cacheRef.current.has(date)) return;
      cacheRef.current.set(date, { shows: [], loaded: false });

      const url = new URL(apiPath, window.location.origin);
      url.searchParams.set("date", date);
      url.searchParams.set("portal", portalSlug);

      fetch(url.toString())
        .then((res) => (res.ok ? (res.json() as Promise<ApiResponse<T>>) : null))
        .then((data) => {
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
    [apiPath, portalSlug],
  );

  const prefetchAdjacent = useCallback(
    (date: string, dates: string[]) => {
      const idx = dates.indexOf(date);
      if (idx < 0) return;
      const adjacent = [
        idx > 0 ? dates[idx - 1] : null,
        idx < dates.length - 1 ? dates[idx + 1] : null,
      ].filter((value): value is string => !!value);

      const cancel = scheduleIdle(() => {
        for (const adjacentDate of adjacent) {
          prefetchDate(adjacentDate);
        }
      });

      return cancel;
    },
    [prefetchDate],
  );

  useEffect(() => {
    if (!initialPayload?.meta?.available_dates?.length) return;
    return prefetchAdjacent(initialPayload.date, initialPayload.meta.available_dates);
  }, [initialPayload, prefetchAdjacent]);

  const fetchShows = useCallback(
    async (date: string) => {
      if (!date) return;

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
        url.searchParams.set("portal", portalSlug);
        const res = await fetch(url.toString(), {
          signal: controller.signal,
        });
        if (!res.ok) return;

        const data: ApiResponse<T> = await res.json();
        if (controller.signal.aborted) return;

        const fetched = data.shows || [];
        setShows(fetched);
        cacheRef.current.set(date, { shows: fetched, loaded: true });
        prefetchAdjacent(date, meta?.available_dates || []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [apiPath, meta?.available_dates, portalSlug, prefetchAdjacent],
  );

  useEffect(() => {
    if (initialPayload) {
      setMeta(initialPayload.meta);
      setShows(initialPayload.shows);
      setMetaLoading(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchMeta() {
      setMetaLoading(true);
      try {
        const dateStr = getLocalDateString(new Date());
        const url = new URL(apiPath, window.location.origin);
        url.searchParams.set("date", dateStr);
        url.searchParams.set("meta", "true");
        url.searchParams.set("portal", portalSlug);
        const res = await fetch(url.toString(), {
          signal: controller.signal,
        });
        if (!res.ok) return;

        const data: ApiResponse<T> = await res.json();
        if (controller.signal.aborted) return;

        if (data.meta) {
          setMeta(data.meta);
        }

        const fetched = data.shows || [];
        setShows(fetched);
        cacheRef.current.set(dateStr, { shows: fetched, loaded: true });

        let initialDate = dateStr;
        if (data.meta?.available_dates?.length) {
          initialDate = data.meta.available_dates[0];
        }
        setSelectedDate(initialDate);
        prefetchAdjacent(initialDate, data.meta?.available_dates || []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) {
          setMetaLoading(false);
          setLoading(false);
        }
      }
    }

    fetchMeta();
    return () => controller.abort();
  }, [apiPath, initialPayload, portalSlug, prefetchAdjacent]);

  const initialMountRef = useRef(true);
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    fetchShows(selectedDate);
  }, [fetchShows, selectedDate]);

  const datePills = meta?.available_dates?.length
    ? meta.available_dates
    : (() => {
        const pills: string[] = [];
        const now = new Date();
        for (let i = 0; i < 7; i += 1) {
          const date = new Date(now);
          date.setDate(date.getDate() + i);
          pills.push(getLocalDateString(date));
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
