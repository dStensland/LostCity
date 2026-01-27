"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import LinkifyText from "../LinkifyText";

type SeriesData = {
  id: string;
  title: string;
  slug: string;
  series_type: string;
  description: string | null;
  image_url: string | null;
  year: number | null;
  rating: string | null;
  runtime_minutes: number | null;
  director: string | null;
  trailer_url: string | null;
  genres: string[] | null;
  frequency: string | null;
  day_of_week: string | null;
};

type VenueShowtime = {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  };
  events: {
    id: number;
    date: string;
    time: string | null;
    ticketUrl: string | null;
  }[];
};

interface SeriesDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose: () => void;
}

// Series type config
const SERIES_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  film: { label: "Film", color: "#A5B4FC" },
  recurring_show: { label: "Recurring Show", color: "#F472B6" },
  festival_program: { label: "Festival", color: "#FBBF24" },
  convention: { label: "Convention", color: "#22D3EE" },
  tour: { label: "Tour", color: "#4ADE80" },
};

function getSeriesTypeLabel(type: string): string {
  return SERIES_TYPE_CONFIG[type]?.label || "Series";
}

function getSeriesTypeColor(type: string): string {
  return SERIES_TYPE_CONFIG[type]?.color || "#94A3B8";
}

function formatGenre(genre: string): string {
  return genre
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, "EEE, MMM d");
}

// Group events by date within venue
function groupEventsByDate(
  events: VenueShowtime["events"]
): Map<string, VenueShowtime["events"]> {
  const groups = new Map<string, VenueShowtime["events"]>();
  for (const event of events) {
    if (!groups.has(event.date)) {
      groups.set(event.date, []);
    }
    groups.get(event.date)!.push(event);
  }
  return groups;
}

export default function SeriesDetailView({ slug, portalSlug, onClose }: SeriesDetailViewProps) {
  const router = useRouter();
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [venueShowtimes, setVenueShowtimes] = useState<VenueShowtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    async function fetchSeries() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/series/${slug}`);
        if (!res.ok) {
          throw new Error("Series not found");
        }
        const data = await res.json();
        setSeries(data.series);
        setVenueShowtimes(data.venueShowtimes || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load series");
      } finally {
        setLoading(false);
      }
    }

    fetchSeries();
  }, [slug]);

  const handleEventClick = (id: number) => {
    router.push(`/${portalSlug}?event=${id}`, { scroll: false });
  };

  const handleVenueClick = (venueSlug: string) => {
    router.push(`/${portalSlug}?spot=${venueSlug}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="animate-fadeIn">
        {/* Hero skeleton with floating back button */}
        <div className="relative rounded-xl overflow-hidden mb-6 bg-[var(--dusk)]">
          <button
            onClick={onClose}
            className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-sm text-white/90 hover:text-white hover:bg-black/70 rounded-full font-mono text-xs transition-all z-10"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="p-6 flex items-start gap-4">
            <div className="w-28 h-40 skeleton-shimmer rounded-lg" />
            <div className="flex-1 space-y-3 pt-2">
              <div className="h-5 skeleton-shimmer rounded w-20" />
              <div className="h-7 skeleton-shimmer rounded w-3/4" />
              <div className="h-4 skeleton-shimmer rounded w-1/2" />
            </div>
          </div>
        </div>
        <div className="h-32 skeleton-shimmer rounded-xl" />
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="animate-fadeIn">
        <div className="relative rounded-xl overflow-hidden mb-6 bg-[var(--dusk)] border border-[var(--twilight)]">
          <button
            onClick={onClose}
            className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-sm text-white/90 hover:text-white hover:bg-black/70 rounded-full font-mono text-xs transition-all z-10"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[var(--muted)]">{error || "Series not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  const typeColor = getSeriesTypeColor(series.series_type);
  const typeLabel = getSeriesTypeLabel(series.series_type);
  const showImage = series.image_url && !imageError;
  const totalEvents = venueShowtimes.reduce((sum, vs) => sum + vs.events.length, 0);

  return (
    <div className="animate-fadeIn pb-8">
      {/* Hero with poster and info */}
      <div
        className="relative rounded-xl overflow-hidden mb-6 border border-[var(--twilight)]"
        style={{
          background: `linear-gradient(to bottom, ${typeColor}10, var(--dusk))`,
        }}
      >
        {/* Floating back button */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-sm text-white/90 hover:text-white hover:bg-black/70 rounded-full font-mono text-xs transition-all z-10"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="p-6 flex items-start gap-4">
          {/* Poster */}
          <div className="flex-shrink-0">
            {showImage ? (
              <div className="relative w-28 h-40 rounded-lg overflow-hidden border border-[var(--twilight)]">
                {!imageLoaded && (
                  <div className="absolute inset-0 skeleton-shimmer" />
                )}
                <Image
                  src={series.image_url!}
                  alt={series.title}
                  fill
                  className={`object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
              </div>
            ) : (
              <div
                className="w-28 h-40 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${typeColor}20` }}
              >
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: typeColor }}>
                  {series.series_type === "film" ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  )}
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Type badge */}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium uppercase tracking-wider mb-2"
              style={{
                backgroundColor: `${typeColor}20`,
                color: typeColor,
              }}
            >
              {typeLabel}
            </span>

            <h1 className="text-xl font-bold text-[var(--cream)] leading-tight mb-2">
              {series.title}
            </h1>

            {/* Film metadata */}
            {series.series_type === "film" && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)] mb-3">
                {series.year && <span>{series.year}</span>}
                {series.rating && (
                  <span className="px-1 py-0.5 border border-[var(--muted)] rounded text-[0.65rem]">
                    {series.rating}
                  </span>
                )}
                {series.runtime_minutes && (
                  <span>
                    {Math.floor(series.runtime_minutes / 60)}h {series.runtime_minutes % 60}m
                  </span>
                )}
              </div>
            )}

            {/* Recurring show metadata */}
            {series.series_type === "recurring_show" && series.frequency && (
              <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="capitalize">{series.frequency}</span>
                {series.day_of_week && <span className="capitalize">on {series.day_of_week}s</span>}
              </div>
            )}

            {series.director && (
              <p className="text-sm text-[var(--muted)] mb-2">
                Directed by <span className="text-[var(--soft)]">{series.director}</span>
              </p>
            )}

            {/* Genres */}
            {series.genres && series.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {series.genres.slice(0, 4).map((genre) => (
                  <span
                    key={genre}
                    className="px-2 py-0.5 rounded-full text-[0.65rem] font-medium border border-[var(--twilight)] text-[var(--soft)]"
                  >
                    {formatGenre(genre)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {series.description && (
        <div className="border border-[var(--twilight)] rounded-xl p-4 bg-[var(--dusk)] mb-6">
          <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-2">
            About
          </h2>
          <p className="text-[var(--soft)] text-sm leading-relaxed whitespace-pre-wrap">
            <LinkifyText text={series.description} />
          </p>
        </div>
      )}

      {/* Trailer link */}
      {series.trailer_url && (
        <a
          href={series.trailer_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80 transition-colors mb-6"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Watch Trailer
        </a>
      )}

      {/* Showtimes by venue */}
      <div>
        <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-4">
          {totalEvents > 0 ? (
            <>
              {totalEvents} Upcoming {series.series_type === "film" ? "Showtime" : "Event"}
              {totalEvents !== 1 ? "s" : ""}
            </>
          ) : (
            "No Upcoming Showtimes"
          )}
        </h2>

        {venueShowtimes.length > 0 ? (
          <div className="space-y-4">
            {venueShowtimes.map((vs) => {
              const eventsByDate = groupEventsByDate(vs.events);

              return (
                <div
                  key={vs.venue.id}
                  className="rounded-xl border border-[var(--twilight)] overflow-hidden bg-[var(--dusk)]"
                >
                  {/* Venue header */}
                  <button
                    onClick={() => handleVenueClick(vs.venue.slug)}
                    className="w-full p-3 border-b border-[var(--twilight)]/50 flex items-center gap-2 hover:bg-[var(--twilight)]/20 transition-colors group"
                  >
                    <svg
                      className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                      {vs.venue.name}
                    </span>
                    {vs.venue.neighborhood && (
                      <span className="text-xs text-[var(--muted)] font-mono">
                        ({vs.venue.neighborhood})
                      </span>
                    )}
                    <svg
                      className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors ml-auto"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Dates and times */}
                  <div className="divide-y divide-[var(--twilight)]/30">
                    {Array.from(eventsByDate.entries()).map(([date, dateEvents]) => (
                      <div key={date} className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          {/* Date */}
                          <div className="flex-shrink-0 w-24">
                            <span className="text-sm font-medium text-[var(--soft)]">
                              {formatDate(date)}
                            </span>
                          </div>

                          {/* Times */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {dateEvents.map((event) => (
                              <button
                                key={event.id}
                                onClick={() => handleEventClick(event.id)}
                                className="font-mono text-xs px-2 py-1 rounded bg-[var(--twilight)]/50 text-[var(--cream)] hover:bg-[var(--coral)] hover:text-[var(--void)] transition-colors"
                              >
                                {formatTime(event.time) || "Time TBA"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center border border-[var(--twilight)] rounded-xl bg-[var(--dusk)]">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[var(--muted)] text-sm">No upcoming showtimes scheduled</p>
            <p className="text-[var(--muted)] text-xs mt-1">Check back later for new dates</p>
          </div>
        )}
      </div>
    </div>
  );
}
