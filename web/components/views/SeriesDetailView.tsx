"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/SmartImage";
import { format, parseISO } from "date-fns";
import LinkifyText from "../LinkifyText";
import Skeleton from "@/components/Skeleton";
import ScopedStyles from "@/components/ScopedStyles";
import { GenreChip } from "@/components/ActivityChip";
import { createCssVarClass } from "@/lib/css-utils";
import { usePortalOptional } from "@/lib/portal-context";
import { InfoCard } from "@/components/detail/InfoCard";
import { SectionHeader } from "@/components/detail/SectionHeader";
import NeonBackButton from "@/components/detail/NeonBackButton";
import { formatRecurrence, type Frequency, type DayOfWeek } from "@/lib/recurrence";
import {
  CaretRight,
  CaretDown,
  Play,
  Repeat,
  MapPin,
  CalendarBlank,
  FilmSlate,
  WarningCircle,
} from "@phosphor-icons/react";

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
  festival?: {
    id: string;
    slug: string;
    name: string;
    image_url: string | null;
    festival_type?: string | null;
    location: string | null;
    neighborhood: string | null;
  } | null;
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
  film: { label: "Film", color: "var(--series-type-film, #A5B4FC)" },
  recurring_show: { label: "Recurring Show", color: "var(--series-type-recurring, #F9A8D4)" },
  festival_program: { label: "Program", color: "var(--series-type-festival, #FBBF24)" },
  convention: { label: "Convention", color: "var(--series-type-convention, #22D3EE)" },
  tour: { label: "Tour", color: "var(--series-type-tour, #C4B5FD)" },
};

function getSeriesTypeLabel(type: string): string {
  return SERIES_TYPE_CONFIG[type]?.label || "Series";
}

function getSeriesTypeColor(type: string): string {
  return SERIES_TYPE_CONFIG[type]?.color || "var(--series-type-default, #94A3B8)";
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
  const searchParams = useSearchParams();
  const portalContext = usePortalOptional();
  const portalId = portalContext?.portal?.id || null;
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [venueShowtimes, setVenueShowtimes] = useState<VenueShowtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [expandedSingleVenue, setExpandedSingleVenue] = useState(false);
  const [expandedMultiVenue, setExpandedMultiVenue] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchSeries() {
      setLoading(true);
      setError(null);
      setImageLoaded(false);
      setImageError(false);
      setExpandedSingleVenue(false);
      setExpandedMultiVenue(false);

      try {
        const qs = portalId ? `?${new URLSearchParams({ portal_id: portalId }).toString()}` : "";
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`/api/series/${slug}${qs}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error("Series not found");
        }
        const data = await res.json();
        setSeries(data.series);
        setVenueShowtimes(data.venueShowtimes || []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load series");
      } finally {
        setLoading(false);
      }
    }

    fetchSeries();

    return () => controller.abort();
  }, [slug, portalId]);

  const navigateToDetail = (param: string, value: string | number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.delete("event");
    params.delete("spot");
    params.delete("series");
    params.delete("festival");
    params.delete("org");
    params.set(param, String(value));
    router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
  };

  const handleEventClick = (id: number) => navigateToDetail("event", id);
  const handleVenueClick = (venueSlug: string) => navigateToDetail("spot", venueSlug);
  const handleFestivalClick = (festivalSlug: string) => navigateToDetail("festival", festivalSlug);

  if (loading) {
    return (
      <div className="pt-6 pb-8" role="status" aria-label="Loading series details">
        {/* Hero skeleton with floating back button */}
        <div className="relative rounded-xl overflow-hidden mb-6 border border-[var(--twilight)] bg-[var(--dusk)]">
          <NeonBackButton onClose={onClose} />
          <div className="p-6 flex items-start gap-4">
            {/* Poster */}
            <Skeleton className="w-28 h-40 rounded-lg flex-shrink-0" />

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              {/* Type badge */}
              <Skeleton className="h-5 w-20 rounded" delay="0.06s" />
              {/* Title */}
              <Skeleton className="h-7 w-[75%] rounded mt-2" delay="0.1s" />
              {/* Metadata (year, rating, runtime) */}
              <div className="flex items-center gap-2 mt-3">
                <Skeleton className="h-4 w-10 rounded" delay="0.16s" />
                <Skeleton className="h-4 w-8 rounded" delay="0.18s" />
                <Skeleton className="h-4 w-14 rounded" delay="0.2s" />
              </div>
              {/* Genre pills */}
              <div className="flex gap-1.5 mt-3">
                <Skeleton className="h-5 w-16 rounded-full" delay="0.24s" />
                <Skeleton className="h-5 w-14 rounded-full" delay="0.26s" />
                <Skeleton className="h-5 w-18 rounded-full" delay="0.28s" />
              </div>
            </div>
          </div>
        </div>

        {/* Description skeleton */}
        <div className="border border-[var(--twilight)] rounded-xl p-4 bg-[var(--dusk)] mb-6">
          <Skeleton className="h-3 w-12 rounded mb-2" delay="0.32s" />
          <Skeleton className="h-4 w-full rounded" delay="0.36s" />
          <Skeleton className="h-4 w-[80%] rounded mt-1.5" delay="0.38s" />
        </div>

        {/* Showtimes section skeleton */}
        <Skeleton className="h-3 w-32 rounded mb-4" delay="0.42s" />
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" delay="0.46s" />
          <Skeleton className="h-24 w-full rounded-xl" delay="0.5s" />
        </div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="pt-6" role="alert">
        <div className="relative rounded-xl overflow-hidden mb-6 bg-[var(--dusk)] border border-[var(--twilight)]">
          <NeonBackButton onClose={onClose} />
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/50 flex items-center justify-center">
              <WarningCircle size={24} weight="light" className="text-[var(--muted)]" aria-hidden="true" />
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
  const accentClass = createCssVarClass("--accent-color", typeColor, "accent");

  return (
    <div className={`pt-6 pb-8 ${accentClass?.className ?? ""}`}>
      <ScopedStyles css={accentClass?.css} />
      {/* Hero with poster and info */}
      <div className="relative rounded-xl overflow-hidden mb-6 border border-[var(--twilight)] series-hero-bg">
        {/* Floating back button */}
        <NeonBackButton onClose={onClose} />
        <div className="p-6 flex items-start gap-4">
          {/* Poster */}
          <div className="flex-shrink-0">
            {showImage ? (
              <div className="relative w-28 h-40 rounded-lg overflow-hidden border border-[var(--twilight)]">
                {!imageLoaded && (
                  <Skeleton className="absolute inset-0" />
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
                className="w-28 h-40 rounded-lg flex items-center justify-center bg-accent-20"
              >
                {series.series_type === "film" ? (
                  <FilmSlate size={40} weight="light" className="text-accent" aria-hidden="true" />
                ) : (
                  <CalendarBlank size={40} weight="light" className="text-accent" aria-hidden="true" />
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Type badge */}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium uppercase tracking-widest mb-2 bg-accent-20 text-accent"
            >
              {typeLabel}
            </span>

            <h2 className="text-xl font-bold text-[var(--cream)] leading-tight mb-2">
              {series.title}
            </h2>

            {/* Film metadata */}
            {series.series_type === "film" && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)] mb-3">
                {series.year && <span>{series.year}</span>}
                {series.rating && (
                  <span className="px-1 py-0.5 border border-[var(--muted)] rounded text-xs">
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
                <Repeat size={16} weight="light" aria-hidden="true" />
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
                  <GenreChip
                    key={genre}
                    genre={genre}
                    category={series.series_type === "film" ? "film" : null}
                    portalSlug={portalSlug}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {series.festival && (
        <button
          onClick={() => handleFestivalClick(series.festival!.slug)}
          className={`w-full mb-5 flex items-center justify-between gap-3 rounded-lg border border-[var(--twilight)] bg-[var(--void)] px-4 py-3 min-h-[44px] text-left transition-colors hover:border-[var(--coral)]/50 focus-ring ${accentClass?.className ?? ""}`}
        >
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)]">Part of</p>
            <p className="text-[var(--cream)] font-medium truncate">{series.festival.name}</p>
          </div>
          <span className="text-xs font-mono text-[var(--soft)]">View festival</span>
        </button>
      )}

      {/* Description */}
      {series.description && (
        <InfoCard className="mb-6">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)] mb-2">
            About
          </h2>
          <p className="text-[var(--soft)] text-sm leading-relaxed whitespace-pre-wrap">
            <LinkifyText text={series.description} />
          </p>
        </InfoCard>
      )}

      {/* Trailer link */}
      {series.trailer_url && (
        <a
          href={series.trailer_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80 transition-colors mb-6 focus-ring"
        >
          <Play size={20} weight="fill" aria-hidden="true" />
          Watch Trailer
        </a>
      )}

      {/* Recurring show callout */}
      {series.series_type === "recurring_show" && series.frequency && (
        <div
          className="rounded-xl border p-4 mb-6 series-callout"
        >
          <div className="flex items-start gap-3">
            <Repeat size={20} weight="light" className="flex-shrink-0 mt-0.5 text-accent" aria-hidden="true" />
            <div>
              <p className="font-medium text-[var(--cream)]">
                {formatRecurrence(series.frequency as Frequency, series.day_of_week as DayOfWeek) || (series.frequency.charAt(0).toUpperCase() + series.frequency.slice(1))}
                {venueShowtimes[0]?.events[0]?.time && ` at ${formatTime(venueShowtimes[0].events[0].time)}`}
              </p>
              {venueShowtimes.length === 1 && venueShowtimes[0].venue && (
                <p className="text-sm text-[var(--muted)] mt-0.5">
                  at {venueShowtimes[0].venue.name}
                  {venueShowtimes[0].venue.neighborhood && ` (${venueShowtimes[0].venue.neighborhood})`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Showtimes by venue */}
      <div>
        <SectionHeader
          title={
            totalEvents > 0
              ? `${totalEvents} Upcoming ${series.series_type === "film" ? "Showtime" : "Event"}${totalEvents !== 1 ? "s" : ""}`
              : "No Upcoming Showtimes"
          }
        />

        {venueShowtimes.length > 0 ? (
          <div className="space-y-4">
            {/* Compact single-venue layout for recurring shows */}
            {series.series_type === "recurring_show" && venueShowtimes.length === 1 ? (
              <>
                <div className="rounded-xl border border-[var(--twilight)] overflow-hidden bg-[var(--dusk)]">
                  {/* Venue header */}
                  <button
                    onClick={() => handleVenueClick(venueShowtimes[0].venue.slug)}
                    className="w-full p-3 border-b border-[var(--twilight)]/50 flex items-center gap-2 hover:bg-[var(--twilight)]/20 transition-colors group focus-ring"
                  >
                    <MapPin size={16} weight="light" className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" />
                    <span className="font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                      {venueShowtimes[0].venue.name}
                    </span>
                    {venueShowtimes[0].venue.neighborhood && (
                      <span className="text-xs text-[var(--muted)] font-mono">
                        ({venueShowtimes[0].venue.neighborhood})
                      </span>
                    )}
                    <CaretRight size={16} weight="bold" className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors ml-auto" />
                  </button>

                  {/* Compact date list */}
                  <div className="p-3">
                    {venueShowtimes[0].events.length > 0 && (
                      <div className="space-y-1.5">
                        {(expandedSingleVenue ? venueShowtimes[0].events : venueShowtimes[0].events.slice(0, 3)).map((event, index) => (
                          <button
                            key={event.id}
                            onClick={() => handleEventClick(event.id)}
                            className={`w-full flex items-center gap-3 px-2 min-h-[44px] focus-ring ${
                              index === 0 ? "py-1.5 rounded-lg bg-[var(--twilight)]/30 hover:bg-[var(--coral)] hover:text-[var(--void)]" : "py-1 rounded hover:bg-[var(--twilight)]/30"
                            } transition-colors ${index === 0 ? "group/next" : "text-left"}`}
                          >
                            {index === 0 && <span className="text-xs font-medium text-accent">Next</span>}
                            <span className={`${index === 0 ? "text-sm font-medium text-[var(--cream)] group-hover/next:text-inherit" : "text-sm text-[var(--soft)]"}`}>
                              {formatDate(event.date)}
                            </span>
                            {event.time && (
                              <span className={`font-mono text-xs ${index === 0 ? "text-[var(--muted)] group-hover/next:text-inherit" : "text-[var(--muted)]"}`}>
                                {formatTime(event.time)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {venueShowtimes[0].events.length > 3 && (
                  <button
                    onClick={() => setExpandedSingleVenue((prev) => !prev)}
                    aria-expanded={expandedSingleVenue}
                    className="w-full py-2.5 min-h-[44px] text-sm font-medium text-accent hover:text-[var(--cream)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors flex items-center justify-center gap-2 focus-ring"
                  >
                    {expandedSingleVenue ? "Show fewer dates" : `See all ${venueShowtimes[0].events.length} dates`}
                    <CaretDown
                      size={16}
                      weight="bold"
                      className={`transition-transform ${expandedSingleVenue ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
              </>
            ) : (
              /* Standard multi-venue layout */
              <>
                {(expandedMultiVenue ? venueShowtimes : venueShowtimes.slice(0, 3)).map((vs) => {
                  const eventsByDate = groupEventsByDate(vs.events);

                  return (
                    <div
                      key={vs.venue.id}
                      className="rounded-xl border border-[var(--twilight)] overflow-hidden bg-[var(--dusk)]"
                    >
                      {/* Venue header */}
                      <button
                        onClick={() => handleVenueClick(vs.venue.slug)}
                        className="w-full p-3 border-b border-[var(--twilight)]/50 flex items-center gap-2 hover:bg-[var(--twilight)]/20 transition-colors group focus-ring"
                      >
                        <MapPin size={16} weight="light" className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" />
                        <span className="font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                          {vs.venue.name}
                        </span>
                        {vs.venue.neighborhood && (
                          <span className="text-xs text-[var(--muted)] font-mono">
                            ({vs.venue.neighborhood})
                          </span>
                        )}
                        <CaretRight size={16} weight="bold" className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors ml-auto" />
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
                                    className="font-mono text-xs px-2 py-1 min-h-[44px] rounded bg-[var(--twilight)]/50 text-[var(--cream)] hover:bg-[var(--coral)] hover:text-[var(--void)] transition-colors focus-ring"
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
                {venueShowtimes.length > 3 && (
                  <button
                    onClick={() => setExpandedMultiVenue((prev) => !prev)}
                    aria-expanded={expandedMultiVenue}
                    className="w-full py-2.5 min-h-[44px] text-sm font-medium text-accent hover:text-[var(--cream)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors flex items-center justify-center gap-2 focus-ring"
                  >
                    {expandedMultiVenue ? "Show fewer venues" : `See all ${venueShowtimes.length} venues`}
                    <CaretDown
                      size={16}
                      weight="bold"
                      className={`transition-transform ${expandedMultiVenue ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="py-8 text-center border border-[var(--twilight)] rounded-xl bg-[var(--dusk)]">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <CalendarBlank size={24} weight="light" className="text-[var(--muted)]" />
            </div>
            <p className="text-[var(--muted)] text-sm">No upcoming showtimes scheduled</p>
            <p className="text-[var(--muted)] text-xs mt-1">Check back later for new dates</p>
          </div>
        )}
      </div>
    </div>
  );
}
