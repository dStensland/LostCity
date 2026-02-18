"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { formatTimeSplit } from "@/lib/formats";
import CategoryIcon from "@/components/CategoryIcon";

interface ShowtimesViewProps {
  portalId: string;
  portalSlug: string;
}

interface Theater {
  venue_id: number;
  venue_name: string;
  venue_slug: string;
  neighborhood: string | null;
  times: string[];
}

interface Film {
  title: string;
  series_id: string | null;
  series_slug: string | null;
  image_url: string | null;
  theaters: Theater[];
}

interface TheaterGroup {
  venue_id: number;
  venue_name: string;
  venue_slug: string;
  neighborhood: string | null;
  films: {
    title: string;
    series_id: string | null;
    series_slug: string | null;
    image_url: string | null;
    times: string[];
  }[];
}

interface ShowtimesMeta {
  available_dates: string[];
  available_theaters: { venue_id: number; venue_name: string; venue_slug: string; neighborhood: string | null }[];
  available_films: { title: string; series_id: string | null; series_slug: string | null; image_url: string | null }[];
}

function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

function formatShowtime(time: string): string {
  const parts = formatTimeSplit(time);
  return `${parts.time}${parts.period ? ` ${parts.period}` : ""}`;
}

// --------------- Shared sub-components ---------------

function FilmPoster({ film }: { film: { title: string; image_url: string | null } }) {
  return (
    <div className="flex-shrink-0 w-[60px] h-[90px] sm:w-[68px] sm:h-[102px] rounded-lg overflow-hidden bg-[var(--dusk)] border border-[var(--twilight)]/50">
      {film.image_url ? (
        <Image
          src={film.image_url}
          alt={film.title}
          width={68}
          height={102}
          className="w-full h-full object-cover"
          unoptimized
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--twilight)]/30 to-[var(--void)]/80">
          <CategoryIcon type="film" size={24} glow="subtle" />
        </div>
      )}
    </div>
  );
}

function TheaterRow({ theater, portalSlug }: { theater: Theater; portalSlug: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Link
          href={`/${portalSlug}?spot=${theater.venue_slug}`}
          scroll={false}
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-[0.82rem] text-[var(--cream)] hover:text-[var(--coral)] transition-colors truncate"
        >
          {theater.venue_name}
        </Link>
        {theater.neighborhood && (
          <>
            <span className="text-[var(--twilight)]/60 flex-shrink-0">·</span>
            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-[0.08em] flex-shrink-0">
              {theater.neighborhood}
            </span>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {theater.times.map((time) => (
          <span
            key={time}
            className="inline-flex px-2.5 py-1 rounded-lg bg-[var(--twilight)]/25 border border-[var(--twilight)]/50 font-mono text-[0.72rem] font-medium text-[var(--soft)] tabular-nums"
          >
            {formatShowtime(time)}
          </span>
        ))}
      </div>
    </div>
  );
}

function TimeChips({ times }: { times: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {times.map((time) => (
        <span
          key={time}
          className="inline-flex px-2 py-0.5 rounded-md bg-[var(--twilight)]/25 border border-[var(--twilight)]/50 font-mono text-[0.7rem] font-medium text-[var(--soft)] tabular-nums"
        >
          {formatShowtime(time)}
        </span>
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

function SingleTheaterCard({ film, portalSlug }: { film: Film; portalSlug: string }) {
  const theater = film.theaters[0];
  return (
    <div className="rounded-xl border border-[var(--twilight)]/65 bg-[var(--night)]/45 p-3 sm:p-3.5">
      <div className="flex gap-3">
        <FilmPoster film={film} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[0.95rem] sm:text-[1.05rem] text-[var(--cream)] leading-snug line-clamp-2">
            {film.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <Link
              href={`/${portalSlug}?spot=${theater.venue_slug}`}
              scroll={false}
              className="font-mono text-[0.66rem] text-[var(--soft)] hover:text-[var(--coral)] transition-colors truncate"
            >
              {theater.venue_name}
            </Link>
            {theater.neighborhood && (
              <>
                <span className="text-[var(--twilight)]/60 flex-shrink-0">·</span>
                <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-[0.06em] flex-shrink-0">
                  {theater.neighborhood}
                </span>
              </>
            )}
          </div>
          <div className="mt-2">
            <TimeChips times={theater.times} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MultiTheaterCard({ film, portalSlug }: { film: Film; portalSlug: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const theaterCount = film.theaters.length;
  const totalShowtimes = film.theaters.reduce((sum, t) => sum + t.times.length, 0);
  const seriesHref =
    film.series_slug && theaterCount > 1
      ? `/${portalSlug}/series/${film.series_slug}`
      : null;

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
            <h3 className="font-semibold text-[0.95rem] sm:text-[1.05rem] text-[var(--cream)] leading-snug line-clamp-2 group-hover:text-[var(--coral)] transition-colors">
              {film.title}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--coral)]/10 border border-[var(--coral)]/25 font-mono text-[0.62rem] font-semibold text-[var(--coral)] uppercase tracking-[0.06em]">
                {theaterCount} {theaterCount === 1 ? "theater" : "theaters"}
              </span>
              <span className="font-mono text-[0.6rem] text-[var(--muted)]">
                {totalShowtimes} showtimes
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 self-center">
            <ChevronIcon open={isOpen} />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-[var(--twilight)]/35 px-3 sm:px-3.5 py-2.5 space-y-2.5">
          {film.theaters.map((theater) => (
            <TheaterRow key={theater.venue_id} theater={theater} portalSlug={portalSlug} />
          ))}
          {seriesHref && (
            <div className="pt-1">
              <Link
                href={seriesHref}
                className="font-mono text-[0.64rem] uppercase tracking-[0.08em] text-[var(--coral)] hover:text-[var(--gold)] transition-colors"
              >
                Open series page for all locations
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --------------- By-theater card ---------------

function TheaterAccordionCard({ theater, portalSlug }: { theater: TheaterGroup; portalSlug: string }) {
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
                className="font-semibold text-[0.95rem] text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors truncate"
              >
                {theater.venue_name}
              </Link>
              {theater.neighborhood && (
                <>
                  <span className="text-[var(--twilight)]/60 flex-shrink-0">·</span>
                  <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-[0.08em] flex-shrink-0">
                    {theater.neighborhood}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--coral)]/10 border border-[var(--coral)]/25 font-mono text-[0.62rem] font-semibold text-[var(--coral)] uppercase tracking-[0.06em]">
                {filmCount} {filmCount === 1 ? "film" : "films"}
              </span>
              <span className="font-mono text-[0.6rem] text-[var(--muted)]">
                {totalShowtimes} showtimes
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 self-center">
            <ChevronIcon open={isOpen} />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-[var(--twilight)]/35 px-3 sm:px-3.5 py-2.5 space-y-3">
          {theater.films.map((film) => (
            <div key={film.series_id || film.title} className="flex gap-2.5">
              <div className="flex-shrink-0 w-[44px] h-[66px] rounded-md overflow-hidden bg-[var(--dusk)] border border-[var(--twilight)]/40">
                {film.image_url ? (
                  <Image
                    src={film.image_url}
                    alt={film.title}
                    width={44}
                    height={66}
                    className="w-full h-full object-cover"
                    unoptimized
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
                    className="font-semibold text-[0.82rem] text-[var(--cream)] leading-snug line-clamp-1 hover:text-[var(--coral)] transition-colors"
                  >
                    {film.title}
                  </Link>
                ) : (
                  <h4 className="font-semibold text-[0.82rem] text-[var(--cream)] leading-snug line-clamp-1">
                    {film.title}
                  </h4>
                )}
                <div className="mt-1.5">
                  <TimeChips times={film.times} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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

export default function ShowtimesView({ portalSlug }: ShowtimesViewProps) {
  const searchParams = useSearchParams();
  const requestedDateParam = searchParams?.get("date") ?? null;
  const requestedDate = useMemo(
    () => resolveDateParam(requestedDateParam),
    [requestedDateParam],
  );

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [viewMode, setViewMode] = useState<"by-movie" | "by-theater">("by-movie");
  const [showSpecial, setShowSpecial] = useState(false);

  const [films, setFilms] = useState<Film[]>([]);
  const [theaters, setTheaters] = useState<TheaterGroup[]>([]);
  const [meta, setMeta] = useState<ShowtimesMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(true);

  const dateScrollRef = useRef<HTMLDivElement>(null);

  // Fetch meta on mount (dates, theaters, films)
  useEffect(() => {
    async function fetchMeta() {
      setMetaLoading(true);
      try {
        const dateStr = requestedDate || toLocalIsoDate(new Date());
        const params = new URLSearchParams({
          date: dateStr,
          meta: "true",
          include_chains: "true",
        });
        const res = await fetch(`/api/showtimes?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        setMeta(data.meta || null);
        setFilms(data.films || []);
        // Set initial date from meta if available
        if (data.meta?.available_dates?.length > 0) {
          if (
            requestedDate &&
            data.meta.available_dates.includes(requestedDate)
          ) {
            setSelectedDate(requestedDate);
          } else {
            setSelectedDate(data.meta.available_dates[0]);
          }
        } else {
          setSelectedDate(dateStr);
        }
      } catch {
        // fail silently
        setSelectedDate(requestedDate || toLocalIsoDate(new Date()));
      } finally {
        setMetaLoading(false);
        setLoading(false);
      }
    }
    fetchMeta();
  }, [requestedDate]);

  // Fetch showtimes when date, view mode, or special flag changes
  const fetchShowtimes = useCallback(async (date: string, mode: string, special: boolean) => {
    if (!date) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ date, mode: mode === "by-movie" ? "by-film" : "by-theater" });
      if (special) params.set("special", "true");
      params.set("include_chains", "true");
      const res = await fetch(`/api/showtimes?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (mode === "by-theater") {
        setTheaters(data.theaters || []);
      } else {
        setFilms(data.films || []);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when filters change (skip initial load — that's handled by meta fetch)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchShowtimes(selectedDate, viewMode, showSpecial);
  }, [selectedDate, viewMode, showSpecial, fetchShowtimes]);

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

  return (
    <div>
      {/* Date pills + summary */}
      <section className="mb-4 rounded-2xl border border-[var(--twilight)]/80 bg-[var(--void)]/70 backdrop-blur-md p-3 sm:p-4">
        <div ref={dateScrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-0.5">
          {datePills.map((dateStr) => {
            const isActive = selectedDate === dateStr;
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-full font-mono text-xs whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-[var(--gold)] to-[var(--coral)] text-[var(--void)] font-semibold shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
                    : "bg-[var(--night)]/70 border border-[var(--twilight)]/70 text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--coral)]/40"
                }`}
              >
                {formatDatePill(dateStr)}
              </button>
            );
          })}
        </div>

        {!loading && (filmCount > 0 || theaterCount > 0) && (
          <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-[var(--twilight)]/40">
            <span className="font-mono text-[0.62rem] text-[var(--muted)] uppercase tracking-[0.1em]">
              {filmCount} {filmCount === 1 ? "film" : "films"}
            </span>
            <span className="text-[var(--twilight)]/50">·</span>
            <span className="font-mono text-[0.62rem] text-[var(--muted)] uppercase tracking-[0.1em]">
              {theaterCount} {theaterCount === 1 ? "theater" : "theaters"}
            </span>
          </div>
        )}
      </section>

      {/* Controls row: view mode toggle + special screenings */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* By Movie / By Theater toggle */}
        <div className="inline-flex rounded-lg border border-[var(--twilight)]/60 overflow-hidden">
          <button
            onClick={() => setViewMode("by-movie")}
            className={`px-3 py-1.5 font-mono text-[0.68rem] transition-all ${
              viewMode === "by-movie" && !showSpecial
                ? "bg-[var(--coral)]/20 text-[var(--coral)] font-semibold"
                : "bg-[var(--night)]/40 text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            By Movie
          </button>
          <button
            onClick={() => setViewMode("by-theater")}
            className={`px-3 py-1.5 font-mono text-[0.68rem] border-l border-[var(--twilight)]/60 transition-all ${
              viewMode === "by-theater" && !showSpecial
                ? "bg-[var(--coral)]/20 text-[var(--coral)] font-semibold"
                : "bg-[var(--night)]/40 text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            By Theater
          </button>
        </div>

        {/* Special Screenings toggle */}
        <button
          onClick={() => setShowSpecial(!showSpecial)}
          className={`px-3 py-1.5 rounded-lg font-mono text-[0.68rem] transition-all border ${
            showSpecial
              ? "bg-[var(--gold)]/15 border-[var(--gold)]/40 text-[var(--gold)] font-semibold"
              : "bg-[var(--night)]/40 border-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--twilight)]/80"
          }`}
        >
          Special Screenings
        </button>
      </div>

      {/* Loading state */}
      {(loading || metaLoading) && <ShowtimesSkeleton />}

      {/* By-movie content */}
      {!loading && !metaLoading && viewMode === "by-movie" && films.length > 0 && (
        <div className="space-y-2.5">
          {films.map((film) =>
            film.theaters.length === 1 ? (
              <SingleTheaterCard
                key={film.series_id || film.title}
                film={film}
                portalSlug={portalSlug}
              />
            ) : (
              <MultiTheaterCard
                key={film.series_id || film.title}
                film={film}
                portalSlug={portalSlug}
              />
            )
          )}
        </div>
      )}

      {/* By-theater content */}
      {!loading && !metaLoading && viewMode === "by-theater" && theaters.length > 0 && (
        <div className="space-y-2.5">
          {theaters.map((theater) => (
            <TheaterAccordionCard
              key={theater.venue_id}
              theater={theater}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !metaLoading && (
        (viewMode === "by-movie" && films.length === 0) ||
        (viewMode === "by-theater" && theaters.length === 0)
      ) && (
        <div className="py-16 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--twilight)]/25 border border-[var(--twilight)]/50 mb-4">
            <CategoryIcon type="film" size={28} glow="subtle" />
          </div>
          <div className="text-[var(--muted)] font-mono text-sm">
            {showSpecial
              ? "No special screenings found for this date"
              : "No showtimes found for this date"
            }
          </div>
          <div className="text-[var(--muted)]/60 font-mono text-xs mt-2">
            Try a different day or check back later
          </div>
        </div>
      )}
    </div>
  );
}
