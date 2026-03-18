"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { DatePillStrip } from "@/components/find/DatePillStrip";
import { MusicShowCard, type MusicShow } from "@/components/find/MusicShowCard";
import CategoryIcon from "@/components/CategoryIcon";
import { getLocalDateString } from "@/lib/formats";

export interface MusicListingsViewProps {
  portalId: string;
  portalSlug: string;
}

interface MusicMeta {
  available_dates: string[];
}

interface MusicApiResponse {
  shows: MusicShow[];
  meta?: MusicMeta;
}

interface CachedData {
  shows: MusicShow[];
  loaded: boolean;
}

// --------------- Skeleton ---------------

function MusicSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex gap-3 items-start p-3 rounded-xl border border-[var(--twilight)]/30"
        >
          <div className="flex-1 space-y-2 py-0.5">
            <div className="h-4 w-2/3 skeleton-shimmer rounded" />
            <div className="h-3 w-1/3 skeleton-shimmer rounded" />
            <div className="h-3 w-2/5 skeleton-shimmer rounded" />
          </div>
          <div className="h-6 w-16 skeleton-shimmer rounded-lg flex-shrink-0 mt-0.5" />
        </div>
      ))}
    </div>
  );
}

// --------------- Main component ---------------

export default function MusicListingsView({ portalId, portalSlug }: MusicListingsViewProps) {
  const today = getLocalDateString(new Date());

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [shows, setShows] = useState<MusicShow[]>([]);
  const [meta, setMeta] = useState<MusicMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);

  // Client-side cache: date → { shows }
  const cacheRef = useRef<Map<string, CachedData>>(new Map());

  // Prefetch a date in background (no state updates)
  const prefetchDate = useCallback((date: string) => {
    if (cacheRef.current.has(date)) return;
    // Mark as pending to prevent duplicate prefetches
    cacheRef.current.set(date, { shows: [], loaded: false });
    const params = new URLSearchParams({ date, portal: portalSlug });
    fetch(`/api/whats-on/music?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MusicApiResponse | null) => {
        if (!data) {
          cacheRef.current.delete(date);
          return;
        }
        cacheRef.current.set(date, { shows: data.shows || [], loaded: true });
      })
      .catch(() => {
        cacheRef.current.delete(date);
      });
  }, [portalSlug]);

  // Fetch shows for a given date (checks cache first)
  const fetchShows = useCallback(
    async (date: string) => {
      if (!date) return;

      const cached = cacheRef.current.get(date);
      if (cached?.loaded) {
        setShows(cached.shows);
        setLoading(false);
        // Prefetch adjacent dates
        const dates = meta?.available_dates || [];
        const idx = dates.indexOf(date);
        if (idx >= 0) {
          if (idx > 0) prefetchDate(dates[idx - 1]);
          if (idx < dates.length - 1) prefetchDate(dates[idx + 1]);
        }
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({ date, portal: portalSlug });
        const res = await fetch(`/api/whats-on/music?${params}`);
        if (!res.ok) return;
        const data: MusicApiResponse = await res.json();
        const fetched = data.shows || [];
        setShows(fetched);
        cacheRef.current.set(date, { shows: fetched, loaded: true });
        // Prefetch adjacent dates
        const dates = meta?.available_dates || [];
        const idx = dates.indexOf(date);
        if (idx >= 0) {
          if (idx > 0) prefetchDate(dates[idx - 1]);
          if (idx < dates.length - 1) prefetchDate(dates[idx + 1]);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    },
    [meta?.available_dates, prefetchDate, portalSlug],
  );

  // Fetch meta + initial data on mount
  useEffect(() => {
    async function fetchMeta() {
      setMetaLoading(true);
      try {
        const dateStr = getLocalDateString(new Date());
        const params = new URLSearchParams({ date: dateStr, meta: "true", portal: portalSlug });
        const res = await fetch(`/api/whats-on/music?${params}`);
        if (!res.ok) return;
        const data: MusicApiResponse = await res.json();

        if (data.meta) setMeta(data.meta);

        const fetched = data.shows || [];
        setShows(fetched);
        cacheRef.current.set(dateStr, { shows: fetched, loaded: true });

        let initialDate = dateStr;
        if (data.meta?.available_dates?.length) {
          initialDate = data.meta.available_dates[0];
        }
        setSelectedDate(initialDate);

        // Prefetch adjacent dates
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
      } catch {
        // fail silently
      } finally {
        setMetaLoading(false);
        setLoading(false);
      }
    }
    fetchMeta();
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

  // Summary: unique venue count
  const uniqueVenueCount = new Set(shows.map((s) => s.venue.id)).size;
  const summaryItems =
    shows.length > 0
      ? [
          { label: shows.length === 1 ? "show" : "shows", value: shows.length },
          { label: uniqueVenueCount === 1 ? "venue" : "venues", value: uniqueVenueCount },
        ]
      : undefined;

  return (
    <div>
      {/* Date pills + summary */}
      <DatePillStrip
        dates={datePills}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        todayLabel="Tonight"
        summaryItems={summaryItems}
      />

      {/* Initial loading skeleton */}
      {metaLoading && <MusicSkeleton />}

      {/* Content area */}
      {!metaLoading && (
        <div className="relative">
          {/* Loading overlay — dims stale content during date switches */}
          {loading && shows.length > 0 && (
            <div className="absolute inset-0 z-10 bg-[var(--void)]/40 backdrop-blur-[1px] rounded-xl flex items-start justify-center pt-24 pointer-events-none">
              <div className="w-5 h-5 border-2 border-[var(--coral)]/40 border-t-[var(--coral)] rounded-full animate-spin" />
            </div>
          )}

          {/* Skeleton for first load of a date with no cached data */}
          {loading && shows.length === 0 && <MusicSkeleton />}

          {/* Show list */}
          {shows.length > 0 && (
            <div
              className={`space-y-2.5 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0 ${loading ? "pointer-events-none" : ""}`}
            >
              {shows.map((show) => (
                <MusicShowCard
                  key={show.event_id}
                  show={show}
                  portalSlug={portalSlug}
                  portalId={portalId}
                  selectedDate={selectedDate}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && shows.length === 0 && (
            <div className="py-12 sm:py-16 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--twilight)]/25 border border-[var(--twilight)]/50 mb-4">
                <CategoryIcon type="music" size={28} glow="subtle" />
              </div>
              <div className="text-[var(--muted)] font-mono text-sm">
                No shows found for this date
              </div>
              <div className="text-[var(--muted)]/60 font-mono text-xs mt-2">
                Try a different day or check back later
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
