"use client";

import { useState, useMemo } from "react";
import Image from "@/components/SmartImage";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import LinkifyText from "../LinkifyText";
import Skeleton from "@/components/Skeleton";
import ScopedStyles from "@/components/ScopedStyles";
import { GenreChip } from "@/components/ActivityChip";
import { createCssVarClass } from "@/lib/css-utils";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series-utils";
import { usePortal } from "@/lib/portal-context";
import { SectionHeader } from "@/components/detail/SectionHeader";
import DetailShell from "@/components/detail/DetailShell";
import DetailHeroImage from "@/components/detail/DetailHeroImage";
import { DetailStickyBar } from "@/components/detail/DetailStickyBar";
import Dot from "@/components/ui/Dot";
import GettingThereSection from "@/components/GettingThereSection";
import { useDetailFetch } from "@/lib/hooks/useDetailFetch";
import { useDetailNavigation } from "@/lib/hooks/useDetailNavigation";
import { formatRecurrence, type Frequency, type DayOfWeek } from "@/lib/recurrence";
import {
  CaretDown,
  PlayCircle,
  Repeat,
  MapPin,
  CalendarBlank,
  FilmSlate,
  CaretRight,
  StarFour,
  Ticket,
  ArrowCounterClockwise,
  ArrowLeft,
} from "@phosphor-icons/react";
import { ShowtimesTheaterCard } from "@/components/detail/ShowtimesTheaterCard";

// ── Types ────────────────────────────────────────────────────────────────

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
    image_url?: string | null;
    address?: string | null;
    nearest_marta_station?: string | null;
    marta_walk_minutes?: number | null;
    marta_lines?: string[] | null;
    beltline_adjacent?: boolean | null;
    beltline_segment?: string | null;
    parking_type?: string[] | null;
    parking_free?: boolean | null;
    transit_score?: number | null;
  };
  events: {
    id: number;
    date: string;
    time: string | null;
    ticketUrl: string | null;
  }[];
};

type SeriesApiResponse = {
  series: SeriesData;
  events: unknown[];
  venueShowtimes: VenueShowtime[];
};

interface SeriesDetailViewProps {
  slug: string;
  portalSlug: string;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
  // Treat midnight placeholder as unknown time
  if (timeStr === "00:00:00" || timeStr === "00:00") return "";
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "EEE, MMM d");
}

// ── Component ────────────────────────────────────────────────────────────

export default function SeriesDetailView({ slug, portalSlug, onClose }: SeriesDetailViewProps) {
  const { portal } = usePortal();
  const { toEvent, toSpot, toFestival } = useDetailNavigation(portalSlug);
  const [expandedDates, setExpandedDates] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const fetchUrl = useMemo(() => {
    if (!portal?.id) return null;
    return `/api/series/${slug}?portal_id=${portal.id}`;
  }, [slug, portal?.id]);

  const { data, status, error, retry } = useDetailFetch<SeriesApiResponse>(fetchUrl, {
    entityLabel: "series",
  });

  const series = data?.series ?? null;
  const venueShowtimes = useMemo(() => data?.venueShowtimes ?? [], [data]);
  const totalEvents = useMemo(
    () => venueShowtimes.reduce((sum, vs) => sum + vs.events.length, 0),
    [venueShowtimes]
  );

  // Flatten all events sorted by date for the dates list
  const allEvents = useMemo(() => {
    const events: { id: number; date: string; time: string | null; ticketUrl: string | null; venueName?: string }[] = [];
    for (const vs of venueShowtimes) {
      for (const e of vs.events) {
        events.push({ ...e, venueName: vs.venue.name });
      }
    }
    return events.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  }, [venueShowtimes]);

  const nextEvent = allEvents[0] ?? null;

  // Single venue for venue section
  const singleVenue = useMemo(() => {
    if (venueShowtimes.length !== 1) return null;
    return venueShowtimes[0].venue;
  }, [venueShowtimes]);

  // Film date pills — unique sorted dates across all venues
  const seriesIsFilm = series?.series_type === "film";
  const filmDates = useMemo(() => {
    if (!seriesIsFilm) return [];
    const dateSet = new Set<string>();
    for (const vs of venueShowtimes) {
      for (const e of vs.events) {
        dateSet.add(e.date);
      }
    }
    return [...dateSet].sort();
  }, [venueShowtimes, seriesIsFilm]);

  // Active date for film theater cards — default to first date
  const activeDateKey = selectedDateKey ?? (filmDates[0] ?? null);

  // Theater cards for active date — grouped by venue, showtimes on that date
  const theaterCardsForDate = useMemo(() => {
    if (!activeDateKey) return venueShowtimes;
    return venueShowtimes.map((vs) => ({
      ...vs,
      events: vs.events.filter((e) => e.date === activeDateKey),
    })).filter((vs) => vs.events.length > 0);
  }, [venueShowtimes, activeDateKey]);

  // ── LOADING ──────────────────────────────────────────────────────────

  if (status === "loading") {
    const skeletonSidebar = (
      <div role="status" aria-label="Loading series details">
        <div className="aspect-[16/10] bg-[var(--dusk)]">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="px-5 pt-4 pb-3 space-y-2">
          <Skeleton className="h-5 w-20 rounded" delay="0.06s" />
          <Skeleton className="h-7 w-[75%] rounded" delay="0.1s" />
          <Skeleton className="h-4 w-[50%] rounded" delay="0.14s" />
        </div>
        <div className="mx-5 border-t border-[var(--twilight)]/40" />
        <div className="px-5 py-3">
          <Skeleton className="h-12 w-full rounded-lg" delay="0.2s" />
        </div>
      </div>
    );
    const skeletonContent = (
      <div className="p-4 lg:p-8 space-y-6">
        <Skeleton className="h-3 w-16 rounded" delay="0.24s" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full rounded" delay="0.28s" />
          <Skeleton className="h-4 w-[80%] rounded" delay="0.3s" />
        </div>
        <Skeleton className="h-3 w-32 rounded" delay="0.36s" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" delay="0.4s" />
          <Skeleton className="h-10 w-full rounded-lg" delay="0.44s" />
        </div>
      </div>
    );
    return <DetailShell onClose={onClose} sidebar={skeletonSidebar} content={skeletonContent} />;
  }

  // ── ERROR ────────────────────────────────────────────────────────────

  if (error || !series) {
    return (
      <DetailShell
        onClose={onClose}
        singleColumn
        content={
          <div className="flex flex-col items-center justify-center py-20 px-4" role="alert">
            <p className="text-[var(--soft)] mb-6">{error || "Series not found"}</p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--dusk)] transition-colors font-mono text-sm focus-ring"
              >
                <ArrowLeft size={16} weight="bold" />
                Go Back
              </button>
              <button
                onClick={retry}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:brightness-110 transition-all focus-ring"
              >
                <ArrowCounterClockwise size={16} weight="bold" />
                Try Again
              </button>
            </div>
          </div>
        }
      />
    );
  }

  // ── DERIVED VALUES ──────────────────────────────────────────────────

  const typeColor = getSeriesTypeColor(series.series_type);
  const typeLabel = getSeriesTypeLabel(series.series_type);
  const accentClass = createCssVarClass("--accent-color", typeColor, "accent");
  const isFilm = series.series_type === "film";
  const isRecurring = series.series_type === "recurring_show";

  const recurrenceLabel = isRecurring && series.frequency
    ? formatRecurrence(series.frequency as Frequency, series.day_of_week as DayOfWeek) ||
      (series.frequency.charAt(0).toUpperCase() + series.frequency.slice(1) +
        (series.day_of_week ? ` on ${series.day_of_week}s` : ""))
    : null;

  // ── SIDEBAR ─────────────────────────────────────────────────────────

  const sidebarContent = (
    <div className={`flex flex-col h-full ${accentClass?.className ?? ""}`}>
      {/* Hero */}
      {series.image_url ? (
        <DetailHeroImage
          imageUrl={series.image_url}
          alt={series.title}
          category={isFilm ? "film" : "other"}
        />
      ) : isFilm ? (
        <div className="aspect-[2/3] max-h-[260px] bg-gradient-to-b from-[var(--dusk)] to-[var(--night)] flex items-center justify-center">
          <FilmSlate size={48} weight="light" className="text-accent opacity-30" aria-hidden="true" />
        </div>
      ) : (
        /* Non-film series without images: skip the large hero, start with identity */
        null
      )}

      {/* Identity */}
      <div className="px-5 pt-4 pb-3 space-y-2">
        {/* Type badge */}
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-[0.14em] bg-accent-20 text-accent">
          {typeLabel}
        </span>

        {/* Title */}
        <h1 className="text-xl lg:text-2xl font-bold text-[var(--cream)] leading-tight">
          {series.title}
        </h1>

        {/* Recurring metadata */}
        {recurrenceLabel && (
          <div className="flex items-center gap-2 text-sm text-[var(--soft)]">
            <Repeat size={16} weight="light" className="text-accent flex-shrink-0" aria-hidden="true" />
            <span>{recurrenceLabel}</span>
          </div>
        )}

        {/* Film metadata */}
        {isFilm && (
          <p className="text-sm flex items-center gap-1.5 flex-wrap text-[var(--soft)]">
            {series.year && <span className="text-[var(--cream)]">{series.year}</span>}
            {series.rating && (
              <>
                {series.year && <Dot />}
                <span className="px-1 py-0.5 border border-[var(--muted)] rounded text-xs">{series.rating}</span>
              </>
            )}
            {series.runtime_minutes && (
              <>
                <Dot />
                <span>{Math.floor(series.runtime_minutes / 60)}h {series.runtime_minutes % 60}m</span>
              </>
            )}
          </p>
        )}

        {/* Venue link (single-venue) */}
        {singleVenue && (
          <button
            onClick={() => toSpot(singleVenue.slug)}
            className="flex items-center gap-1.5 text-sm text-[var(--soft)] hover:text-[var(--coral)] transition-colors text-left focus-ring"
          >
            <MapPin size={14} weight="light" className="flex-shrink-0" aria-hidden="true" />
            <span>{singleVenue.name}</span>
            {singleVenue.neighborhood && (
              <span className="text-[var(--muted)]">· {singleVenue.neighborhood}</span>
            )}
          </button>
        )}
      </div>

      {/* Next date CTA */}
      {nextEvent && (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-3">
            <button
              onClick={() => toEvent(nextEvent.id)}
              className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-lg bg-accent-20 text-accent text-sm font-medium hover:brightness-110 transition-all focus-ring"
            >
              <span>Next: {formatDate(nextEvent.date)}</span>
              {nextEvent.time && <span className="font-mono text-xs opacity-80">{formatTime(nextEvent.time)}</span>}
            </button>
          </div>
        </>
      )}

      {/* Director + Trailer (film only) */}
      {isFilm && (series.director || series.trailer_url) && (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-3 space-y-2">
            {series.director && (
              <p className="text-sm text-[var(--muted)]">
                Directed by <span className="text-[var(--soft)]">{series.director}</span>
              </p>
            )}
            {series.trailer_url && (
              <a
                href={series.trailer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-[var(--coral)] hover:text-[var(--cream)] transition-colors focus-ring"
              >
                <PlayCircle size={18} weight="fill" aria-hidden="true" />
                Watch Trailer
              </a>
            )}
          </div>
        </>
      )}

      {/* Festival parent link */}
      {series.festival && (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-2">
            <button
              onClick={() => toFestival(series.festival!.slug)}
              className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/25 hover:bg-[var(--gold)]/15 hover:border-[var(--gold)]/40 transition-colors text-left focus-ring"
            >
              <StarFour size={16} weight="fill" className="text-[var(--gold)] flex-shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono uppercase tracking-[0.14em] text-[var(--gold)]/70">Part of</p>
                <p className="text-[var(--cream)] font-medium text-sm truncate">{series.festival.name}</p>
              </div>
              <CaretRight size={14} weight="bold" className="text-[var(--gold)]/60 flex-shrink-0" />
            </button>
          </div>
        </>
      )}

      {/* Spacer + Genre pills */}
      <div className="hidden lg:flex flex-1" />
      {series.genres && series.genres.length > 0 && (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-3 flex flex-wrap gap-1.5">
            {series.genres.slice(0, 5).map((genre) => (
              <GenreChip
                key={genre}
                genre={genre}
                category={isFilm ? "film" : null}
                portalSlug={portalSlug}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ── CONTENT ─────────────────────────────────────────────────────────

  const DATES_COLLAPSED = 5;
  const showExpandDates = allEvents.length > DATES_COLLAPSED;
  const visibleEvents = expandedDates ? allEvents : allEvents.slice(0, DATES_COLLAPSED);

  const contentBody = (
    <div className={`px-4 lg:px-8 py-6 min-h-[calc(100dvh-4rem)] max-w-3xl ${accentClass?.className ?? ""}`}>
      {/* About */}
      {series.description && (
        <>
          <SectionHeader title="About" />
          <div className="text-sm text-[var(--soft)] leading-relaxed whitespace-pre-wrap pb-2">
            <LinkifyText text={series.description} />
          </div>
        </>
      )}

      {/* Venue section (single-venue series) */}
      {singleVenue && (
        <>
          <SectionHeader
            title="Venue"
            rightAction={
              <button
                onClick={() => toSpot(singleVenue.slug)}
                className="text-xs font-mono text-[var(--coral)] hover:text-[var(--cream)] transition-colors focus-ring"
              >
                View venue →
              </button>
            }
          />
          <div className="rounded-xl border border-[var(--twilight)] overflow-hidden bg-[var(--card-bg,var(--night))] mb-2">
            {singleVenue.image_url && (
              <div className="relative h-32 overflow-hidden">
                <Image
                  src={singleVenue.image_url}
                  alt={singleVenue.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 640px"
                  className="object-cover brightness-[0.85]"
                />
              </div>
            )}
            <div className="p-4 space-y-2">
              <button
                onClick={() => toSpot(singleVenue.slug)}
                className="text-left group focus-ring"
              >
                <h3 className="text-base font-semibold text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                  {singleVenue.name}
                </h3>
                {singleVenue.neighborhood && (
                  <p className="text-sm text-[var(--muted)]">{singleVenue.neighborhood}</p>
                )}
              </button>
              {singleVenue.address && (
                <p className="text-xs text-[var(--muted)]">{singleVenue.address}</p>
              )}
              <GettingThereSection transit={singleVenue} variant="compact" />
            </div>
          </div>
        </>
      )}

      {/* Upcoming Dates / Showtimes */}
      <SectionHeader
        title={
          totalEvents > 0
            ? `Upcoming ${isFilm ? "Showtimes" : "Dates"}`
            : `No Upcoming ${isFilm ? "Showtimes" : "Dates"}`
        }
        count={totalEvents > 0 ? totalEvents : undefined}
      />

      {allEvents.length > 0 ? (
        isFilm ? (
          /* ── Film path: date pill strip + theater cards ── */
          <div className="space-y-3">
            {/* Date pill strip */}
            {filmDates.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                {filmDates.map((dateStr) => {
                  const date = parseISO(dateStr);
                  const isActive = dateStr === activeDateKey;
                  const dayLabel = isToday(date) ? "Today" : isTomorrow(date) ? "Tmrw" : format(date, "EEE");
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDateKey(dateStr)}
                      className={`flex-shrink-0 flex flex-col items-center rounded-lg border transition-all px-2 py-1.5 min-w-[44px] focus-ring ${
                        isActive
                          ? "bg-[var(--coral)]/20 border-[var(--coral)]/50 text-[var(--coral)]"
                          : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--coral)]/30"
                      }`}
                    >
                      <span className="font-mono uppercase tracking-wider text-2xs">{dayLabel}</span>
                      <span className="font-mono font-bold leading-tight text-sm">{format(date, "d")}</span>
                      <span className="font-mono text-[var(--muted)] uppercase text-2xs">{format(date, "MMM")}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Theater cards for active date */}
            {theaterCardsForDate.length > 0 ? (
              <div className="space-y-2">
                {theaterCardsForDate.map((vs) => (
                  <ShowtimesTheaterCard
                    key={vs.venue.id}
                    theater={{
                      venue_name: vs.venue.name,
                      venue_slug: vs.venue.slug,
                      neighborhood: vs.venue.neighborhood,
                      showtimes: vs.events
                        .filter((e) => e.time != null)
                        .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
                        .map((e) => ({ time: e.time!, event_id: e.id })),
                      nearest_marta_station: vs.venue.nearest_marta_station,
                      marta_walk_minutes: vs.venue.marta_walk_minutes,
                      parking_type: vs.venue.parking_type,
                      parking_free: vs.venue.parking_free,
                    }}
                    portalSlug={portalSlug}
                    laneColor={typeColor}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[var(--muted)] text-sm py-3 text-center font-mono">
                No showtimes on this date
              </p>
            )}
          </div>
        ) : (
          /* ── Non-film path: flat date list (unchanged) ── */
          <div className="space-y-1">
            {visibleEvents.map((event, index) => (
              <button
                key={event.id}
                onClick={() => toEvent(event.id)}
                className={`w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg transition-colors focus-ring ${
                  index === 0
                    ? "py-2.5 bg-accent-20 hover:brightness-110"
                    : "py-2 hover:bg-[var(--twilight)]/30"
                }`}
              >
                <span className={`text-sm ${index === 0 ? "font-medium text-[var(--cream)]" : "text-[var(--soft)]"}`}>
                  {formatDate(event.date)}
                </span>
                {event.time && (
                  <span className="font-mono text-xs text-[var(--muted)]">{formatTime(event.time)}</span>
                )}
                {/* Show venue name for multi-venue series */}
                {venueShowtimes.length > 1 && event.venueName && (
                  <>
                    <span className="flex-1" />
                    <span className="text-xs text-[var(--muted)] truncate max-w-[140px]">{event.venueName}</span>
                  </>
                )}
                <CaretRight size={14} weight="bold" className={`ml-auto flex-shrink-0 ${index === 0 ? "text-accent" : "text-[var(--muted)]"}`} />
              </button>
            ))}

            {showExpandDates && (
              <button
                onClick={() => setExpandedDates((prev) => !prev)}
                aria-expanded={expandedDates}
                className="w-full py-2.5 min-h-[44px] text-sm font-medium text-accent hover:text-[var(--cream)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors flex items-center justify-center gap-2 mt-2 focus-ring"
              >
                {expandedDates ? "Show fewer dates" : `See all ${allEvents.length} dates`}
                <CaretDown
                  size={16}
                  weight="bold"
                  className={`transition-transform ${expandedDates ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
        )
      ) : (
        <div className="py-8 text-center border border-[var(--twilight)] rounded-xl bg-[var(--card-bg,var(--night))]">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
            <CalendarBlank size={24} weight="light" className="text-[var(--muted)]" aria-hidden="true" />
          </div>
          <p className="text-[var(--muted)] text-sm">No upcoming {isFilm ? "showtimes" : "dates"} scheduled</p>
          <p className="text-[var(--muted)] text-xs mt-1">Check back later for new dates</p>
        </div>
      )}
    </div>
  );

  // ── MOBILE STICKY BAR ───────────────────────────────────────────────

  const nextTicketUrl = nextEvent?.ticketUrl ?? null;
  const mobileBottomBar = nextTicketUrl ? (
    <DetailStickyBar
      primaryAction={{
        label: isFilm ? "Get Showtimes" : "Get Tickets",
        href: nextTicketUrl,
        icon: <Ticket size={16} weight="light" />,
      }}
      primaryColor={typeColor}
      containerClassName="max-w-3xl"
    />
  ) : undefined;

  // ── RENDER ──────────────────────────────────────────────────────────

  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <DetailShell
        onClose={onClose}
        sidebar={sidebarContent}
        content={contentBody}
        bottomBar={mobileBottomBar}
      />
    </>
  );
}
