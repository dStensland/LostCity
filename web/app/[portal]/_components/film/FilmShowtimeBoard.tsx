"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock, FilmSlate, MapPin } from "@phosphor-icons/react";
import { buildFilmCapsule } from "@/lib/film-capsule";

type Mode = "by-film" | "by-theater";

type FilmVenue = {
  venue_id: number;
  venue_name: string;
  venue_slug: string;
  neighborhood: string | null;
  times: string[];
};

type FilmItem = {
  title: string;
  series_id: string | null;
  series_slug: string | null;
  image_url: string | null;
  genres?: string[];
  director?: string | null;
  year?: number | null;
  theaters: FilmVenue[];
};

type TheaterFilm = {
  title: string;
  series_id: string | null;
  series_slug: string | null;
  image_url: string | null;
  genres?: string[];
  director?: string | null;
  year?: number | null;
  times: string[];
};

type TheaterItem = {
  venue_id: number;
  venue_name: string;
  venue_slug: string;
  neighborhood: string | null;
  films: TheaterFilm[];
};

type ShowtimesMeta = {
  available_dates?: string[];
};

type ShowtimesResponse = {
  date: string;
  films?: FilmItem[];
  theaters?: TheaterItem[];
  meta?: ShowtimesMeta;
};

type FilmShowtimeBoardProps = {
  portalSlug: string;
  mode: Mode;
  compact?: boolean;
  hideHeader?: boolean;
  hideDateRail?: boolean;
  hideGenreFilter?: boolean;
  indieOnly?: boolean;
};

const CANONICAL_GENRES = [
  "action", "comedy", "documentary", "drama", "horror", "sci-fi",
  "thriller", "indie", "animation", "romance", "classic", "foreign",
] as const;

function normalizeGenre(genre: string): string {
  return genre.toLowerCase().replace(/[^a-z-]/g, "");
}

function getTheaterPriority(venueName: string): number {
  const normalized = venueName.toLowerCase();
  if (normalized.includes("plaza")) return 0;
  if (normalized.includes("tara")) return 1;
  if (normalized.includes("starlight")) return 2;
  return 10;
}

function sortVenuesByPriority<T extends { venue_name: string }>(venues: T[]): T[] {
  return [...venues].sort((a, b) => {
    const priorityDelta = getTheaterPriority(a.venue_name) - getTheaterPriority(b.venue_name);
    if (priorityDelta !== 0) return priorityDelta;
    return a.venue_name.localeCompare(b.venue_name);
  });
}

function formatDateLabel(isoDate: string): string {
  const utcMidday = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcMidday);
}

function formatTimeLabel(time: string): string {
  const hour = Number(time.slice(0, 2));
  const minute = time.slice(3, 5);
  if (Number.isNaN(hour)) return time;
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour >= 12 ? "PM" : "AM";
  return `${normalizedHour}:${minute} ${period}`;
}

function posterTone(index: number): string {
  const tones = [
    "from-slate-300/85 to-slate-500/85",
    "from-indigo-300/85 to-violet-500/85",
    "from-cyan-300/85 to-blue-500/85",
    "from-blue-300/85 to-sky-600/85",
  ];
  return tones[index % tones.length];
}

export default function FilmShowtimeBoard({
  portalSlug,
  mode,
  compact = false,
  hideHeader = false,
  hideDateRail = false,
  hideGenreFilter = false,
  indieOnly = false,
}: FilmShowtimeBoardProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [films, setFilms] = useState<FilmItem[]>([]);
  const [theaters, setTheaters] = useState<TheaterItem[]>([]);
  const [metaDates, setMetaDates] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());

  const load = useCallback(async (signal: AbortSignal, date: string | null) => {
    setError(null);
    setLoading(true);

    const params = new URLSearchParams({ mode, meta: "true" });
    params.set("include_chains", "true");
    if (date) params.set("date", date);

    try {
      const response = await fetch(`/api/showtimes?${params.toString()}`, { signal });
      if (!response.ok) throw new Error("Failed to load showtimes");

      const payload = await response.json() as ShowtimesResponse;
      if (signal.aborted) return;

      setFilms(payload.films || []);
      setTheaters(payload.theaters || []);
      setMetaDates(payload.meta?.available_dates || []);
      setSelectedDate(payload.date || date);
      setLoading(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!signal.aborted) {
        setError("Could not load showtimes right now.");
        setLoading(false);
      }
    }
  }, [mode]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal, selectedDate);
    return () => controller.abort();
  }, [load, selectedDate]);

  const dateRail = useMemo(() => {
    const unique = new Set<string>();
    if (selectedDate) unique.add(selectedDate);
    for (const date of metaDates) unique.add(date);
    return Array.from(unique).sort().slice(0, 7);
  }, [metaDates, selectedDate]);

  const indieFilteredFilms = useMemo(() => {
    if (!indieOnly) return films;

    const indieKeywords = [
      "plaza",
      "tara",
      "starlight",
      "landmark midtown",
      "arthouse",
      "art house",
      "indie",
      "independent",
    ];

    return films
      .map((film) => ({
        ...film,
        theaters: sortVenuesByPriority(film.theaters.filter((theater) =>
          indieKeywords.some((keyword) => theater.venue_name.toLowerCase().includes(keyword))
        )),
      }))
      .filter((film) => film.theaters.length > 0);
  }, [films, indieOnly]);

  const indieFilteredTheaters = useMemo(() => {
    if (!indieOnly) return theaters;

    const indieKeywords = [
      "plaza",
      "tara",
      "starlight",
      "landmark midtown",
      "arthouse",
      "art house",
      "indie",
      "independent",
    ];

    return theaters
      .filter((theater) =>
        indieKeywords.some((keyword) => theater.venue_name.toLowerCase().includes(keyword))
      )
      .sort((a, b) => {
        const priorityDelta = getTheaterPriority(a.venue_name) - getTheaterPriority(b.venue_name);
        if (priorityDelta !== 0) return priorityDelta;
        return b.films.length - a.films.length || a.venue_name.localeCompare(b.venue_name);
      });
  }, [indieOnly, theaters]);

  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    for (const film of indieFilteredFilms) {
      for (const g of film.genres || []) {
        const normalized = normalizeGenre(g);
        if (CANONICAL_GENRES.includes(normalized as typeof CANONICAL_GENRES[number])) {
          genreSet.add(normalized);
        }
      }
    }
    for (const theater of indieFilteredTheaters) {
      for (const film of theater.films) {
        for (const g of film.genres || []) {
          const normalized = normalizeGenre(g);
          if (CANONICAL_GENRES.includes(normalized as typeof CANONICAL_GENRES[number])) {
            genreSet.add(normalized);
          }
        }
      }
    }
    return CANONICAL_GENRES.filter((g) => genreSet.has(g));
  }, [indieFilteredFilms, indieFilteredTheaters]);

  const genreFilteredFilms = useMemo(() => {
    if (selectedGenres.size === 0) return indieFilteredFilms;
    return indieFilteredFilms.filter((film) =>
      (film.genres || []).some((g) => selectedGenres.has(normalizeGenre(g)))
    );
  }, [indieFilteredFilms, selectedGenres]);

  const genreFilteredTheaters = useMemo(() => {
    if (selectedGenres.size === 0) return indieFilteredTheaters;
    return indieFilteredTheaters
      .map((theater) => ({
        ...theater,
        films: theater.films.filter((film) =>
          (film.genres || []).some((g) => selectedGenres.has(normalizeGenre(g)))
        ),
      }))
      .filter((theater) => theater.films.length > 0);
  }, [indieFilteredTheaters, selectedGenres]);

  const toggleGenre = useCallback((genre: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) {
        next.delete(genre);
      } else {
        next.add(genre);
      }
      return next;
    });
  }, []);

  const visibleFilms = compact ? genreFilteredFilms.slice(0, 4) : genreFilteredFilms;
  const visibleTheaters = compact ? genreFilteredTheaters.slice(0, 6) : genreFilteredTheaters;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 rounded-xl skeleton-shimmer" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-[#27324a] bg-[#0b101d] p-4 sm:p-5">
      {!hideHeader && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#96a7c5]">
              {mode === "by-film" ? "Showtimes by Film" : "Showtimes by Venue"}
            </p>
            <h2 className="mt-1 text-2xl text-[#f6f7fb]">
              {selectedDate ? formatDateLabel(selectedDate) : "Today"}
            </h2>
          </div>

          <Link
            href={`/${portalSlug}?view=find&type=showtimes`}
            className="text-[0.68rem] uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]"
          >
            Open full finder
          </Link>
        </div>
      )}

      {!hideDateRail && dateRail.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {dateRail.map((date) => {
            const active = date === selectedDate;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`rounded-full border px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.14em] ${
                  active
                    ? "border-[#8da8ea66] bg-[#8da8ea1f] text-[#d9e4ff]"
                    : "border-[#33405f] bg-[#10182b] text-[#9eb0d1]"
                }`}
              >
                {formatDateLabel(date)}
              </button>
            );
          })}
        </div>
      )}

      {!hideGenreFilter && availableGenres.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {availableGenres.map((genre) => {
            const active = selectedGenres.has(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                className={`rounded-full border px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.14em] ${
                  active
                    ? "border-[#8da8ea66] bg-[#8da8ea1f] text-[#d9e4ff]"
                    : "border-[#33405f] bg-[#10182b] text-[#9eb0d1]"
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border border-[#475569] bg-[#0f172a] px-3 py-2 text-xs text-[#cbd5e1]">
          {error}
        </div>
      )}

      {mode === "by-film" ? (
        visibleFilms.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleFilms.map((film, index) => {
              const firstVenue = film.theaters[0];
              const hasMultipleVenues = film.theaters.length > 1;
              return (
                <article key={film.series_id || film.title} className="rounded-xl border border-[#30405f] bg-[#10182b] p-3">
                  <div className="flex gap-3">
                    <div className="relative h-20 w-14 overflow-hidden rounded-[3px] border border-[#3b4768] bg-[#0c1220]">
                      {film.image_url ? (
                        <Image
                          src={film.image_url}
                          alt={film.title}
                          fill
                          sizes="56px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className={`h-full w-full bg-gradient-to-br ${posterTone(index)}`} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-sm font-semibold text-[#f5f7fc]">{film.title}</h3>
                      {buildFilmCapsule({ genres: film.genres, director: film.director, year: film.year }) && (
                        <p className="text-[0.62rem] italic text-[#8ea4c8]">
                          {buildFilmCapsule({ genres: film.genres, director: film.director, year: film.year })}
                        </p>
                      )}
                      {firstVenue && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[0.68rem] text-[#9fb0cf]">
                          <MapPin size={11} />
                          {firstVenue.venue_name}
                        </p>
                      )}
                      <p className="mt-2 inline-flex items-center gap-1 text-[0.68rem] uppercase tracking-[0.12em] text-[#dbe4f7]">
                        <Clock size={11} />
                        {(firstVenue?.times || []).slice(0, 3).map(formatTimeLabel).join(" • ") || "Times pending"}
                      </p>
                      {hasMultipleVenues && (
                        <p className="mt-1 text-[0.66rem] uppercase tracking-[0.12em] text-[#9fb0cf]">
                          {film.theaters.length} venues today
                        </p>
                      )}
                      {hasMultipleVenues && film.series_slug && (
                        <Link
                          href={`/${portalSlug}/series/${film.series_slug}`}
                          className="mt-2 inline-flex text-[0.66rem] uppercase tracking-[0.12em] text-[#c9d9ff] hover:text-[#e1eaff]"
                        >
                          Open series page
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-[#30405f] bg-[#10182b] px-3 py-4 text-sm text-[#9eb0d1]">
            No showtimes posted for this date.
          </div>
        )
      ) : visibleTheaters.length > 0 ? (
        <div className="space-y-3">
          {visibleTheaters.map((venue) => (
            <article key={venue.venue_slug || venue.venue_id} className="rounded-xl border border-[#30405f] bg-[#10182b] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#f5f7fc]">{venue.venue_name}</h3>
                  <p className="text-[0.68rem] text-[#9fb0cf]">{venue.neighborhood || "Atlanta"}</p>
                </div>
                <span className="rounded-full border border-[#36507f] bg-[#12203a] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-[#bad0f3]">
                  {venue.films.length} films
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                {venue.films.slice(0, compact ? 2 : 4).map((film) => {
                  const capsule = buildFilmCapsule({ genres: film.genres, director: film.director, year: film.year });
                  return (
                    <div key={`${venue.venue_id}-${film.title}`}>
                      <p className="text-[0.72rem] text-[#d7e1f6]">
                        {film.series_slug ? (
                          <Link href={`/${portalSlug}/series/${film.series_slug}`} className="font-medium hover:text-[#eef3ff]">
                            {film.title}
                          </Link>
                        ) : (
                          <span className="font-medium">{film.title}</span>
                        )}
                        <span className="text-[#9fb0cf]"> • {film.times.slice(0, 3).map(formatTimeLabel).join(" • ") || "Times pending"}</span>
                      </p>
                      {capsule && !compact && (
                        <p className="text-[0.58rem] italic text-[#8ea4c8]">{capsule}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[#30405f] bg-[#10182b] px-3 py-4 text-sm text-[#9eb0d1]">
          No venue showtimes posted for this date.
        </div>
      )}

      {mode === "by-film" && compact && genreFilteredFilms.length > visibleFilms.length && (
        <Link
          href={`/${portalSlug}/showtimes`}
          className="mt-4 inline-flex text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]"
        >
          View all films
        </Link>
      )}

      {mode === "by-theater" && compact && genreFilteredTheaters.length > visibleTheaters.length && (
        <Link
          href={`/${portalSlug}/venues`}
          className="mt-4 inline-flex text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]"
        >
          View all venues
        </Link>
      )}

      {mode === "by-film" && genreFilteredFilms.length === 0 && (
        <div className="mt-4 flex items-center justify-center text-[#6e7f9f]">
          <FilmSlate size={18} />
        </div>
      )}
    </section>
  );
}
