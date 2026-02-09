"use client";

import { memo } from "react";
import Link from "next/link";
import {
  CalendarBlank,
  FilmSlate,
  Repeat,
  Tent,
  Compass,
  GraduationCap,
  Buildings,
} from "@phosphor-icons/react/dist/ssr";
import { getSeriesTypeColor } from "@/lib/series-utils";
import { formatTimeSplit, formatCompactCount } from "@/lib/formats";
import { formatRecurrence, type Frequency, type DayOfWeek } from "@/lib/recurrence";
import SeriesBadge from "./SeriesBadge";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import RSVPButton from "./RSVPButton";

export interface SeriesVenueGroup {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  };
  showtimes: { id: number; time: string | null; ticket_url?: string | null; source_url?: string | null }[];
}

export interface SeriesInfo {
  id: string;
  slug: string;
  title: string;
  series_type: string;
  image_url: string | null;
  frequency?: string | null;
  day_of_week?: string | null;
  rsvp_count?: number;
  interested_count?: number;
  recommendation_count?: number;
}

interface Props {
  series: SeriesInfo;
  venueGroups: SeriesVenueGroup[];
  portalSlug?: string;
  skipAnimation?: boolean;
  className?: string;
  disableMargin?: boolean;
  contextLabel?: string;
  contextColor?: string;
}

// Known ticketing platform domains
const TICKETING_DOMAINS = [
  "eventbrite.com",
  "ticketmaster.com",
  "axs.com",
  "dice.fm",
  "seetickets.us",
  "etix.com",
  "ticketweb.com",
  "showclix.com",
  "ticketfly.com",
  "universe.com",
  "resident-advisor.net",
  "songkick.com",
];

// Common reservation platforms
const RESERVATION_DOMAINS = [
  "resy.com",
  "opentable.com",
  "tock.com",
  "exploretock.com",
  "sevenrooms.com",
  "toasttab.com",
];

function isTicketingUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TICKETING_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

function isReservationUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return RESERVATION_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

function getLinkOutLabel({
  url,
  hasTicketUrl,
  isExternal,
}: {
  url: string;
  hasTicketUrl: boolean;
  isExternal: boolean;
}): string {
  if (isReservationUrl(url)) return "Reserve";
  if (isTicketingUrl(url)) return "Tickets";
  if (!isExternal) return "Details";
  return hasTicketUrl ? "Tickets" : "Details";
}

function SeriesTypeIcon({
  type,
  size = 18,
  className = "",
}: {
  type: string;
  size?: number;
  className?: string;
}) {
  switch (type) {
    case "film":
      return <FilmSlate size={size} weight="light" className={className} />;
    case "festival_program":
      return <Tent size={size} weight="light" className={className} />;
    case "recurring_show":
      return <Repeat size={size} weight="light" className={className} />;
    case "class_series":
      return <GraduationCap size={size} weight="light" className={className} />;
    case "tour":
      return <Compass size={size} weight="light" className={className} />;
    case "convention":
      return <Buildings size={size} weight="light" className={className} />;
    default:
      return <CalendarBlank size={size} weight="light" className={className} />;
  }
}

const SeriesCard = memo(function SeriesCard({
  series,
  venueGroups,
  portalSlug,
  skipAnimation,
  className,
  disableMargin,
  contextLabel,
  contextColor,
}: Props) {
  const typeColor = getSeriesTypeColor(series.series_type);
  const seriesUrl = portalSlug ? `/${portalSlug}?series=${series.slug}` : `/series/${series.slug}`;
  const accentClass = createCssVarClass("--accent-color", typeColor, "accent");
  const contextAccentClass = contextColor
    ? createCssVarClass("--context-accent", contextColor, "context-accent")
    : null;
  const scopedCss = [accentClass?.css, contextAccentClass?.css].filter(Boolean).join("\n");
  const contextLabelClass = contextColor ? "text-[var(--context-accent)]" : "text-accent";

  // Get total showtime count
  const totalShowtimes = venueGroups.reduce((sum, vg) => sum + vg.showtimes.length, 0);

  const firstShowtime = venueGroups[0]?.showtimes[0];
  const firstVenue = venueGroups[0]?.venue;

  // Format the first showtime like EventCard does
  const timeParts = firstShowtime?.time
    ? formatTimeSplit(firstShowtime.time, false)
    : null;

  // Recurrence pattern for recurring shows
  const recurrenceText = formatRecurrence(
    (series.frequency as Frequency) || null,
    (series.day_of_week as DayOfWeek) || null
  );
  const goingCount = series.rsvp_count ?? 0;
  const interestedCount = series.interested_count ?? 0;
  const recommendationCount = series.recommendation_count ?? 0;
  const hasSocialProof = goingCount > 0 || interestedCount > 0 || recommendationCount > 0;
  const primaryShowtime = venueGroups[0]?.showtimes[0];
  const primaryEventId = primaryShowtime?.id;
  const primaryTicketUrl = primaryShowtime?.ticket_url ?? null;
  const primarySourceUrl = primaryShowtime?.source_url ?? null;
  const linkOutUrl = primaryTicketUrl || primarySourceUrl;
  const isExternalLinkOut = Boolean(linkOutUrl);
  const isTicketLinkOut = Boolean(primaryTicketUrl) || isTicketingUrl(primarySourceUrl);
  const linkOutLabel = linkOutUrl
    ? getLinkOutLabel({
        url: linkOutUrl,
        hasTicketUrl: Boolean(primaryTicketUrl),
        isExternal: true,
      })
    : "Details";

  return (
    <>
      <ScopedStyles css={scopedCss} />
      <div
        className={`${disableMargin ? "" : "mb-4"} rounded-sm border border-[var(--twilight)] card-atmospheric glow-accent reflection-accent group overflow-hidden bg-[var(--card-bg)] border-l-[3px] border-l-[var(--accent-color)] ${accentClass?.className ?? ""} ${contextAccentClass?.className ?? ""} ${skipAnimation ? "" : "animate-card-emerge"} ${className ?? ""}`}
      >
        <div className="flex gap-3">
          <Link
            href={seriesUrl}
            scroll={false}
            className="block flex-1 min-w-0 p-3"
          >
            <div className="flex gap-3">
              {/* Time cell - matches EventCard typography */}
              <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
                <span className="font-mono text-[0.65rem] font-semibold text-[var(--coral)] leading-none uppercase tracking-wide">
                  {totalShowtimes} {series.series_type === "film" ? (totalShowtimes === 1 ? "show" : "shows") : (totalShowtimes === 1 ? "time" : "times")}
                </span>
                {timeParts && (
                  <>
                    <span className="font-mono text-base font-bold text-[var(--cream)] leading-none tabular-nums mt-1">
                      {timeParts.time}
                    </span>
                    {timeParts.period && (
                      <span className="font-mono text-[0.6rem] font-medium text-[var(--soft)] mt-0.5">
                        {timeParts.period}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Mobile: Stacked layout matching EventCard */}
                <div className="sm:hidden">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-accent-20">
                      <SeriesTypeIcon
                        type={series.series_type}
                        size={18}
                        className="text-accent icon-neon-subtle"
                      />
                    </span>
                  </div>
                  {contextLabel && (
                    <div className={`text-[0.6rem] font-mono uppercase tracking-wider ${contextLabelClass} mb-1`}>
                      {contextLabel}
                    </div>
                  )}
                  <h3 className="text-[var(--cream)] font-bold text-lg leading-tight line-clamp-2 group-hover:text-[var(--glow-color)] transition-colors mb-1">
                    {series.title}
                  </h3>
                </div>

                {/* Desktop: Inline layout matching EventCard */}
                <div className="hidden sm:block">
                  {contextLabel && (
                    <div className={`text-[0.6rem] font-mono uppercase tracking-wider ${contextLabelClass} mb-0.5`}>
                      {contextLabel}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded bg-accent-20">
                      <SeriesTypeIcon
                        type={series.series_type}
                        size={20}
                        className="text-accent icon-neon-subtle"
                      />
                    </span>
                    <span className="text-[var(--cream)] font-bold text-lg transition-colors line-clamp-1 group-hover:text-[var(--glow-color)]">
                      {series.title}
                    </span>
                  </div>
                </div>

                {/* Details row - matches EventCard style */}
                <div className="flex items-center gap-1.5 text-sm text-[var(--soft)] mt-1">
                  {firstVenue && (
                    <span className="truncate max-w-[40%] font-medium" title={firstVenue.name}>
                      {firstVenue.name}
                    </span>
                  )}
                  {venueGroups.length > 1 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>+{venueGroups.length - 1} more venues</span>
                    </>
                  )}
                  {firstVenue?.neighborhood && venueGroups.length === 1 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="truncate">{firstVenue.neighborhood}</span>
                    </>
                  )}
                  <span className="opacity-40">·</span>
                  <SeriesBadge
                    seriesType={series.series_type}
                    frequency={series.frequency as Frequency}
                    dayOfWeek={series.day_of_week as DayOfWeek}
                    compact
                  />
                </div>

                {/* Recurrence, showtime, and social proof pills */}
                {(recurrenceText || totalShowtimes > 1 || hasSocialProof) && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {recurrenceText && (
                      <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] px-1.5 py-0.5 rounded font-medium bg-accent-20 text-accent">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {recurrenceText}
                      </span>
                    )}
                    {totalShowtimes > 1 && (
                      <span className="font-mono text-[0.6rem] px-1.5 py-0.5 rounded bg-[var(--twilight)]/40 text-[var(--soft)]">
                        {totalShowtimes} showtimes
                      </span>
                    )}
                    {goingCount > 0 && (
                      <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] font-medium px-1.5 py-0.5 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20 text-[var(--coral)]">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {formatCompactCount(goingCount)} going
                      </span>
                    )}
                    {interestedCount > 0 && (
                      <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] font-medium px-1.5 py-0.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)]">
                        {formatCompactCount(interestedCount)} maybe
                      </span>
                    )}
                    {recommendationCount > 0 && (
                      <span className="inline-flex items-center gap-1 font-mono text-[0.6rem] font-medium px-1.5 py-0.5 rounded-lg bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 text-[var(--lavender)]">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        {formatCompactCount(recommendationCount)} rec&apos;d
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Link>
          {primaryEventId && (
            <div className="flex items-start gap-2 pt-3 pr-3 pb-3 flex-shrink-0">
              <RSVPButton eventId={primaryEventId} variant="compact" />
              {isExternalLinkOut && linkOutUrl && (
                <a
                  href={linkOutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={linkOutLabel}
                  className="w-11 h-11 inline-flex items-center justify-center rounded-xl border border-[var(--twilight)]/80 bg-[var(--dusk)]/70 text-[var(--muted)] backdrop-blur-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] hover:text-[var(--cream)] hover:border-[var(--cta-border,rgba(255,107,122,0.7))] hover:shadow-[0_0_18px_var(--cta-glow,rgba(255,107,122,0.25))] transition-all"
                >
                  {isTicketLinkOut ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v8a1 1 0 001 1h8" />
                    </svg>
                  )}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
});

export default SeriesCard;
