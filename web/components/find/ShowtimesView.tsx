"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";
import { CalendarBlank } from "@phosphor-icons/react";
import {
  createFindFilterSnapshot,
  trackFindZeroResults,
} from "@/lib/analytics/find-tracking";
import Dot from "@/components/ui/Dot";
import { prefetchEventDetail, formatShowtime, toLocalIsoDate } from "@/lib/show-card-utils";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";
import ThisWeekStrip, {
  type Hero,
} from "@/components/feed/sections/now-showing/ThisWeekStrip";
import type { ThisWeekPayload } from "@/lib/film/types";
import type {
  ShowsFilmInitialData,
  ShowtimeEntry,
  ShowtimesFilm as Film,
  ShowtimesMeta,
  ShowtimesTheaterGroup as TheaterGroup,
} from "@/lib/explore-platform/lane-data";

interface ShowtimesViewProps {
  portalId: string;
  portalSlug: string;
  initialData?: ShowsFilmInitialData | null;
}

function resolveDateParam(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value === "today") return toLocalIsoDate(new Date());
  if (value === "tomorrow") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toLocalIsoDate(tomorrow);
  }
  return null;
}

function formatDatePill(dateStr: string): string {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  if (dateStr === today) return "Today";
  if (dateStr === tomorrowStr) return "Tomorrow";

  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function scheduleIdlePrefetch(callback: () => void): void {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 1500 });
    return;
  }
  globalThis.setTimeout(callback, 1200);
}

// --------------- Shared sub-components ---------------

function FilmPoster({ film }: { film: { title: string; image_url: string | null } }) {
  return (
    <div className="flex-shrink-0 w-[60px] h-[90px] sm:w-[68px] sm:h-[102px] rounded-lg overflow-hidden bg-[var(--dusk)] border border-[var(--twilight)]/50">
      {film.image_url ? (
        <SmartImage
          src={film.image_url}
          alt={film.title}
          width={68}
          height={102}
          className="w-full h-full object-cover"
          unoptimized
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--twilight)]/30 to-[var(--void)]/80">
              <CategoryIcon type="film" size={24} glow="subtle" />
            </div>
          }
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--twilight)]/30 to-[var(--void)]/80">
          <CategoryIcon type="film" size={24} glow="subtle" />
        </div>
      )}
    </div>
  );
}

function TimeChipLinks({ times, portalSlug, portalId }: { times: ShowtimeEntry[]; portalSlug: string; portalId?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {times.map((entry) => (
        <Link
          key={entry.event_id}
          href={`/${portalSlug}?event=${entry.event_id}`}
          scroll={false}
          onPointerDown={() => prefetchEventDetail(entry.event_id, portalId)}
          className="inline-flex px-2.5 py-1 rounded-lg bg-[var(--twilight)]/25 border border-[var(--twilight)]/50 font-mono text-xs font-medium text-[var(--soft)] tabular-nums hover:text-[var(--cream)] hover:border-[var(--coral)]/40 transition-colors"
        >
          {formatShowtime(entry.time)}
        </Link>
      ))}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg border border-[var(--twilight)]/60 bg-[var(--dusk)]/60 text-[var(--muted)] group-hover:text-[var(--cream)] group-hover:border-[var(--coral)]/50 transition-all">
      <svg
        className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  );
}

// --------------- By-film cards ---------------

function FilmTitle({ film, portalSlug, className }: { film: Film; portalSlug: string; className?: string }) {
  if (film.series_slug) {
    return (
      <Link
        href={`/${portalSlug}/series/${film.series_slug}`}
        className={`${className} hover:text-[var(--coral)] transition-colors`}
        onClick={(e) => e.stopPropagation()}
      >
        {film.title}
      </Link>
    );
  }
  return <h3 className={className}>{film.title}</h3>;
}

function SingleTheaterCard({ film, portalSlug, portalId }: { film: Film; portalSlug: string; portalId?: string }) {
  const theater = film.theaters[0];
  return (
    <div className="rounded-xl border border-[var(--twilight)]/65 bg-[var(--night)]/45 p-3 sm:p-3.5">
      <div className="flex gap-3">
        <FilmPoster film={film} />
        <div className="flex-1 min-w-0">
          <FilmTitle
            film={film}
            portalSlug={portalSlug}
            className="font-semibold text-base sm:text-base text-[var(--cream)] leading-snug line-clamp-2"
          />
          <div className="flex items-center gap-1.5 mt-1">
            <Link
              href={`/${portalSlug}?spot=${theater.venue_slug}`}
              scroll={false}
              className="font-mono text-xs text-[var(--soft)] hover:text-[var(--coral)] transition-colors truncate"
            >
              {theater.venue_name}
            </Link>
            {theater.neighborhood && (
              <>
                <Dot className="text-[var(--muted)]/40 flex-shrink-0" />
                <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-[0.06em] flex-shrink-0">
                  {theater.neighborhood}
                </span>
              </>
            )}
          </div>
          <div className="mt-2">
            <TimeChipLinks times={theater.times} portalSlug={portalSlug} portalId={portalId} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MultiTheaterCard({ film, portalSlug, portalId }: { film: Film; portalSlug: string; portalId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const theaterCount = film.theaters.length;
  const totalShowtimes = film.theaters.reduce((sum, t) => sum + t.times.length, 0);

  return (
    <div className="rounded-xl border border-[var(--coral)]/25 bg-[var(--night)]/45 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group w-full text-left p-3 sm:p-3.5"
      >
        <div className="flex gap-3">
          <FilmPoster film={film} />
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <FilmTitle
              film={film}
              portalSlug={portalSlug}
              className="font-semibold text-base sm:text-base text-[var(--cream)] leading-snug line-clamp-2 group-hover:text-[var(--coral)] transition-colors"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--coral)]/10 border border-[var(--coral)]/25 font-mono text-xs font-semibold text-[var(--coral)] uppercase tracking-[0.06em]">
                {theaterCount} {theaterCount === 1 ? "theater" : "theaters"}
              </span>
              <span className="font-mono text-xs text-[var(--muted)]">
                {totalShowtimes} showtimes
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 self-center">
            <ChevronIcon open={isOpen} />
          </div>
        </div>
      </button>

      <div className="accordion-body" data-open={isOpen}>
        <div>
          <div className="border-t border-[var(--twilight)]/35 px-3 sm:px-3.5 py-2.5 space-y-2.5">
            {film.theaters.map((theater) => (
              <div key={theater.venue_id}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Link
                    href={`/${portalSlug}?spot=${theater.venue_slug}`}
                    scroll={false}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-sm text-[var(--cream)] hover:text-[var(--coral)] transition-colors truncate"
                  >
                    {theater.venue_name}
                  </Link>
                  {theater.neighborhood && (
                    <>
                      <Dot className="text-[var(--muted)]/40 flex-shrink-0" />
                      <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-[0.08em] flex-shrink-0">
                        {theater.neighborhood}
                      </span>
                    </>
                  )}
                </div>
                <TimeChipLinks times={theater.times} portalSlug={portalSlug} portalId={portalId} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------- By-theater card ---------------

function TheaterAccordionCard({ theater, portalSlug, portalId }: { theater: TheaterGroup; portalSlug: string; portalId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const filmCount = theater.films.length;
  const totalShowtimes = theater.films.reduce((sum, f) => sum + f.times.length, 0);

  return (
    <div className="rounded-xl border border-[var(--coral)]/25 bg-[var(--night)]/45 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group w-full text-left p-3 sm:p-3.5"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--coral)]/20 to-[var(--twilight)]/20 border border-[var(--coral)]/30 flex items-center justify-center">
            <CategoryIcon type="film" size={20} glow="subtle" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/${portalSlug}?spot=${theater.venue_slug}`}
                scroll={false}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-base text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors truncate"
              >
                {theater.venue_name}
              </Link>
              {theater.neighborhood && (
                <>
                  <Dot className="text-[var(--muted)]/40 flex-shrink-0" />
                  <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-[0.08em] flex-shrink-0">
                    {theater.neighborhood}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--coral)]/10 border border-[var(--coral)]/25 font-mono text-xs font-semibold text-[var(--coral)] uppercase tracking-[0.06em]">
                {filmCount} {filmCount === 1 ? "film" : "films"}
              </span>
              <span className="font-mono text-xs text-[var(--muted)]">
                {totalShowtimes} showtimes
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 self-center">
            <ChevronIcon open={isOpen} />
          </div>
        </div>
      </button>

      <div className="accordion-body" data-open={isOpen}>
        <div>
          <div className="border-t border-[var(--twilight)]/35 px-3 sm:px-3.5 py-2.5 space-y-3">
            {theater.films.map((film) => (
              <div key={film.series_id || film.title} className="flex gap-2.5">
                <div className="flex-shrink-0 w-[44px] h-[66px] rounded-md overflow-hidden bg-[var(--dusk)] border border-[var(--twilight)]/40">
                  {film.image_url ? (
                    <SmartImage
                      src={film.image_url}
                      alt={film.title}
                      width={44}
                      height={66}
                      className="w-full h-full object-cover"
                      unoptimized
                      fallback={
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--twilight)]/30 to-[var(--void)]/80">
                          <CategoryIcon type="film" size={16} glow="subtle" />
                        </div>
                      }
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--twilight)]/30 to-[var(--void)]/80">
                      <CategoryIcon type="film" size={16} glow="subtle" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {film.series_slug ? (
                    <Link
                      href={`/${portalSlug}/series/${film.series_slug}`}
                      className="font-semibold text-sm text-[var(--cream)] leading-snug line-clamp-1 hover:text-[var(--coral)] transition-colors"
                    >
                      {film.title}
                    </Link>
                  ) : (
                    <h4 className="font-semibold text-sm text-[var(--cream)] leading-snug line-clamp-1">
                      {film.title}
                    </h4>
                  )}
                  <div className="mt-1.5">
                    <TimeChipLinks times={film.times} portalSlug={portalSlug} portalId={portalId} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------- Skeleton ---------------

function ShowtimesSkeleton() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3 p-3 rounded-xl border border-[var(--twilight)]/30">
          <div className="w-[60px] h-[90px] skeleton-shimmer rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-2/3 skeleton-shimmer rounded" />
            <div className="h-3 w-2/5 skeleton-shimmer rounded" />
            <div className="flex gap-1.5 mt-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-6 w-16 skeleton-shimmer rounded-md" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --------------- Main component ---------------

export default function ShowtimesView({
  portalId,
  portalSlug,
  initialData,
}: ShowtimesViewProps) {
  const state = useExploreUrlState();
  const requestedDateParam = state.params.get("date");
  const requestedDate = useMemo(
    () => resolveDateParam(requestedDateParam),
    [requestedDateParam],
  );
  const requestedModeParam = state.params.get("mode");
  const requestedMode =
    requestedModeParam === "by-movie" || requestedModeParam === "by-theater"
      ? requestedModeParam
      : null;

  const [selectedDate, setSelectedDate] = useState<string>(
    requestedDate || initialData?.date || toLocalIsoDate(new Date()),
  );
  const [viewMode, setViewMode] = useState<"by-movie" | "by-theater">(
    requestedMode || initialData?.viewMode || "by-theater",
  );

  const [films, setFilms] = useState<Film[]>(initialData?.films ?? []);
  const [theaters, setTheaters] = useState<TheaterGroup[]>(
    initialData?.theaters ?? [],
  );
  const [meta, setMeta] = useState<ShowtimesMeta | null>(initialData?.meta ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [metaLoading, setMetaLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const zeroResultsSignatureRef = useRef<string | null>(null);

  // This Week editorial strip — persistent top module, does not rekey on date.
  // One-shot fetch per portal; silent fallback on error (strip simply doesn't render).
  const [thisWeekHeroes, setThisWeekHeroes] = useState<Hero[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    fetch(`/api/film/this-week?portal=${portalSlug}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? (r.json() as Promise<ThisWeekPayload>) : null))
      .then((payload) => {
        if (payload) setThisWeekHeroes(payload.heroes);
      })
      .catch(() => {
        // Silent — strip just doesn't render
      })
      .finally(() => clearTimeout(timeoutId));
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [portalSlug]);

  const dateScrollRef = useRef<HTMLDivElement>(null);
  const filmDateInputRef = useRef<HTMLInputElement>(null);

  // Client-side cache: date|mode → { films, theaters }
  const cacheRef = useRef<Map<string, { films?: Film[]; theaters?: TheaterGroup[] }>>(new Map());

  useEffect(() => {
    if (!initialData) return;
    cacheRef.current.set(`${initialData.date}|by-theater`, {
      theaters: initialData.theaters,
    });
    if (initialData.films) {
      cacheRef.current.set(`${initialData.date}|by-movie`, {
        films: initialData.films,
      });
    }
  }, [initialData]);

  // Prefetch a date+mode combo in background (no state updates)
  const prefetchDate = useCallback((date: string, mode: string) => {
    const apiMode = mode === "by-movie" ? "by-film" : "by-theater";
    const key = `${date}|${mode}`;
    if (cacheRef.current.has(key)) return;
    // Mark as pending to prevent duplicate prefetches
    cacheRef.current.set(key, {});
    const params = new URLSearchParams({ date, mode: apiMode, include_chains: "true", portal: portalSlug });
    fetch(`/api/showtimes?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) { cacheRef.current.delete(key); return; }
        cacheRef.current.set(key, {
          films: data.films || undefined,
          theaters: data.theaters || undefined,
        });
      })
      .catch(() => { cacheRef.current.delete(key); });
  }, [portalSlug]);

  // Fetch meta on mount when no seeded payload exists
  useEffect(() => {
    if (initialData?.meta) {
      setMeta(initialData.meta);
      setMetaLoading(false);
      setLoading(false);
      return;
    }

    async function fetchMeta() {
      setMetaLoading(true);
      try {
        const dateStr = requestedDate || toLocalIsoDate(new Date());
        const params = new URLSearchParams({
          date: dateStr,
          meta: "true",
          include_chains: "true",
          portal: portalSlug,
        });
        const res = await fetch(`/api/showtimes?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        setMeta(data.meta || null);
        setFilms(data.films || []);
        if (data.films) {
          cacheRef.current.set(`${dateStr}|by-movie`, { films: data.films });
        }
        let initialDate = dateStr;
        if (data.meta?.available_dates?.length > 0) {
          if (requestedDate && data.meta.available_dates.includes(requestedDate)) {
            initialDate = requestedDate;
          } else {
            initialDate = data.meta.available_dates[0];
          }
        }
        setSelectedDate(initialDate);
        if (data.meta?.available_dates?.length > 0) {
          const dates = data.meta.available_dates as string[];
          const idx = dates.indexOf(initialDate);
          const adjacentDates = [
            idx > 0 ? dates[idx - 1] : null,
            idx < dates.length - 1 ? dates[idx + 1] : null,
          ].filter(Boolean) as string[];
          for (const adjacentDate of adjacentDates) {
            prefetchDate(adjacentDate, "by-movie");
          }
        }
      } catch {
        setError("Something went wrong loading showtimes");
        setSelectedDate(requestedDate || toLocalIsoDate(new Date()));
      } finally {
        setMetaLoading(false);
        setLoading(false);
      }
    }

    fetchMeta();
  }, [initialData, portalSlug, prefetchDate, requestedDate]);

  useEffect(() => {
    if (requestedDate && requestedDate !== selectedDate) {
      setSelectedDate(requestedDate);
    }
  }, [requestedDate, selectedDate]);

  useEffect(() => {
    if (requestedMode && requestedMode !== viewMode) {
      setViewMode(requestedMode);
    }
  }, [requestedMode, viewMode]);

  // Fetch showtimes when date or view mode changes
  const fetchShowtimes = useCallback(async (date: string, mode: string) => {
    if (!date) return;
    setError(null);

    // Check client cache first — instant switch
    const cacheKey = `${date}|${mode}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && (cached.films || cached.theaters)) {
      if (mode === "by-theater" && cached.theaters) {
        setTheaters(cached.theaters);
        setLoading(false);
      } else if (mode !== "by-theater" && cached.films) {
        setFilms(cached.films);
        setLoading(false);
      } else {
        // Cached entry exists but for different mode — fall through to fetch
        setLoading(true);
      }
      // If cache had the right data, prefetch adjacent and return
      if ((mode === "by-theater" && cached.theaters) || (mode !== "by-theater" && cached.films)) {
        // Prefetch adjacent dates
        const dates = meta?.available_dates || [];
        const idx = dates.indexOf(date);
        if (idx >= 0) {
          scheduleIdlePrefetch(() => {
            if (idx > 0) prefetchDate(dates[idx - 1], mode);
            if (idx < dates.length - 1) prefetchDate(dates[idx + 1], mode);
          });
        }
        return;
      }
    } else {
      setLoading(true);
    }

    try {
      const apiMode = mode === "by-movie" ? "by-film" : "by-theater";
      const params = new URLSearchParams({ date, mode: apiMode, include_chains: "true", portal: portalSlug });
      const res = await fetch(`/api/showtimes?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (mode === "by-theater") {
        setTheaters(data.theaters || []);
        cacheRef.current.set(cacheKey, { theaters: data.theaters || [] });
      } else {
        setFilms(data.films || []);
        cacheRef.current.set(cacheKey, { films: data.films || [] });
      }
      // Prefetch adjacent dates
      const dates = meta?.available_dates || [];
      const idx = dates.indexOf(date);
      if (idx >= 0) {
        scheduleIdlePrefetch(() => {
          if (idx > 0) prefetchDate(dates[idx - 1], mode);
          if (idx < dates.length - 1) prefetchDate(dates[idx + 1], mode);
        });
      }
    } catch {
      setError("Something went wrong loading showtimes");
    } finally {
      setLoading(false);
    }
  }, [meta?.available_dates, prefetchDate, portalSlug]);

  // Re-fetch when filters change (skip initial load — that's handled by meta fetch)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const initialCacheKey = `${selectedDate}|${viewMode}`;
      const cached = cacheRef.current.get(initialCacheKey);
      const hasSeededData =
        (viewMode === "by-theater" && !!cached?.theaters) ||
        (viewMode === "by-movie" && !!cached?.films);
      if (!hasSeededData) {
        fetchShowtimes(selectedDate, viewMode);
      }
      return;
    }
    fetchShowtimes(selectedDate, viewMode);
  }, [selectedDate, viewMode, fetchShowtimes]);

  // Date pills from meta (dynamic) with fallback to 7-day window
  const datePills = meta?.available_dates?.length
    ? meta.available_dates
    : (() => {
        const pills: string[] = [];
        const now = new Date();
        for (let i = 0; i < 7; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() + i);
          pills.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
        }
        return pills;
      })();

  // Count unique theaters from films data for summary
  const theaterCount = viewMode === "by-theater"
    ? theaters.length
    : new Set(films.flatMap((f) => f.theaters.map((t) => t.venue_id))).size;
  const filmCount = viewMode === "by-theater"
    ? new Set(theaters.flatMap((t) => t.films.map((f) => f.series_id || f.title))).size
    : films.length;
  const showtimesFilterSnapshot = useMemo(
    () =>
      createFindFilterSnapshot(
        {
          date: requestedDateParam ? selectedDate : undefined,
        },
        "showtimes"
      ),
    [requestedDateParam, selectedDate]
  );
  const currentResultCount = viewMode === "by-theater" ? theaters.length : films.length;

  useEffect(() => {
    if (!portalSlug || loading || metaLoading) return;
    if (currentResultCount > 0) {
      zeroResultsSignatureRef.current = null;
      return;
    }
    if (showtimesFilterSnapshot.activeCount === 0) return;
    const zeroKey = `${showtimesFilterSnapshot.signature}|mode:${viewMode}`;
    if (zeroResultsSignatureRef.current === zeroKey) return;

    trackFindZeroResults({
      portalSlug,
      findType: "showtimes",
      displayMode: "list",
      surface: viewMode === "by-theater" ? "showtimes_theater" : "showtimes_film",
      snapshot: showtimesFilterSnapshot,
      resultCount: currentResultCount,
    });
    zeroResultsSignatureRef.current = zeroKey;
  }, [
    currentResultCount,
    loading,
    metaLoading,
    portalSlug,
    showtimesFilterSnapshot,
    viewMode,
  ]);

  // Avoid lint warnings on vars we intentionally no longer render but still compute
  // for analytics / zero-results tracking.
  void filmCount;
  void theaterCount;

  return (
    <div>
      {/* This Week — persistent editorial strip. Does not rekey on date. */}
      {thisWeekHeroes && thisWeekHeroes.length > 0 && (
        <section className="mb-6">
          <ThisWeekStrip
            heroes={thisWeekHeroes}
            portalSlug={portalSlug}
            variant="lane"
          />
        </section>
      )}

      {/* Date pills — sit on the page surface, no container card */}
      <div ref={dateScrollRef} className="flex items-center gap-2 mb-4 -mx-1 px-1 overflow-x-auto scrollbar-hide">
        {/* Selected date pill when beyond visible range */}
        {datePills.indexOf(selectedDate) >= 5 && (
          <button
            type="button"
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap bg-[var(--cream)] text-[var(--void)]"
          >
            {formatDatePill(selectedDate)}
          </button>
        )}
        {datePills.slice(0, 5).map((dateStr) => {
          const isActive = selectedDate === dateStr;
          return (
            <button
              key={dateStr}
              onClick={() => {
                setSelectedDate(dateStr);
                state.setLaneParams({ date: dateStr }, "replace");
              }}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${
                isActive
                  ? "bg-[var(--cream)] text-[var(--void)] font-medium"
                  : "text-[var(--soft)] hover:text-[var(--cream)]"
              }`}
            >
              {formatDatePill(dateStr)}
            </button>
          );
        })}
        {datePills.length > 5 && (
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => filmDateInputRef.current?.showPicker()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm whitespace-nowrap text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
            >
              <CalendarBlank weight="regular" size={16} />
              <span className="hidden sm:inline">More</span>
            </button>
            <input
              ref={filmDateInputRef}
              type="date"
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              tabIndex={-1}
              min={datePills[0]}
              max={datePills[datePills.length - 1]}
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  state.setLaneParams({ date: e.target.value }, "replace");
                }
              }}
            />
          </div>
        )}
      </div>

      {/* View toggle — subtle segmented control */}
      <div className="flex items-center mb-5">
        <div className="inline-flex items-center gap-1 rounded-full bg-[var(--twilight)]/40 p-1">
          <button
            onClick={() => {
              setViewMode("by-theater");
              state.setLaneParams({ mode: "by-theater" }, "replace");
            }}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              viewMode === "by-theater"
                ? "bg-[var(--cream)] text-[var(--void)] font-medium"
                : "text-[var(--soft)] hover:text-[var(--cream)]"
            }`}
          >
            By Theater
          </button>
          <button
            onClick={() => {
              setViewMode("by-movie");
              state.setLaneParams({ mode: "by-movie" }, "replace");
            }}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              viewMode === "by-movie"
                ? "bg-[var(--cream)] text-[var(--void)] font-medium"
                : "text-[var(--soft)] hover:text-[var(--cream)]"
            }`}
          >
            By Movie
          </button>
        </div>
      </div>

      {/* Initial loading skeleton (only shown when no data yet) */}
      {metaLoading && <ShowtimesSkeleton />}

      {/* Error state */}
      {error && !metaLoading && (
        <div className="py-10 text-center space-y-3">
          <div className="text-[var(--muted)] font-mono text-sm">{error}</div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              fetchShowtimes(selectedDate, viewMode);
            }}
            className="px-4 py-2 rounded-lg font-mono text-xs border border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--coral)]/40 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Content area — keeps stale data visible with loading overlay during date switches */}
      {!metaLoading && !error && (
        <div className="relative">
          {/* Loading overlay — dims stale content instead of replacing it */}
          {loading && (films.length > 0 || theaters.length > 0) && (
            <div className="absolute inset-0 z-10 bg-[var(--void)]/40 backdrop-blur-[1px] rounded-xl flex items-start justify-center pt-24 pointer-events-none">
              <div className="w-5 h-5 border-2 border-[var(--coral)]/40 border-t-[var(--coral)] rounded-full animate-spin" />
            </div>
          )}

          {/* Skeleton for first load of a view mode with no cached data */}
          {loading && films.length === 0 && theaters.length === 0 && <ShowtimesSkeleton />}

          {/* By-movie content */}
          {viewMode === "by-movie" && films.length > 0 && (
            <div className={`space-y-2.5 ${loading ? "pointer-events-none" : ""}`}>
              {films.map((film) =>
                film.theaters.length === 1 ? (
                  <SingleTheaterCard
                    key={film.series_id || film.title}
                    film={film}
                    portalSlug={portalSlug}
                    portalId={portalId}
                  />
                ) : (
                  <MultiTheaterCard
                    key={film.series_id || film.title}
                    film={film}
                    portalSlug={portalSlug}
                    portalId={portalId}
                  />
                )
              )}
            </div>
          )}

          {/* By-theater content */}
          {viewMode === "by-theater" && theaters.length > 0 && (
            <div className={`space-y-2.5 ${loading ? "pointer-events-none" : ""}`}>
              {theaters.map((theater) => (
                <TheaterAccordionCard
                  key={theater.venue_id}
                  theater={theater}
                  portalSlug={portalSlug}
                  portalId={portalId}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && (
            (viewMode === "by-movie" && films.length === 0) ||
            (viewMode === "by-theater" && theaters.length === 0)
          ) && (
            <div className="py-16 text-center">
              <p className="text-[var(--soft)] text-base">Nothing playing on this date.</p>
              <p className="text-[var(--muted)] text-sm mt-1">Try another day.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
