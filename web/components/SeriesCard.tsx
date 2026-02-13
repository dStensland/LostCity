"use client";

import { memo, useMemo } from "react";
import type { CSSProperties } from "react";
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
import { getSeriesTypeColor, getSeriesTypeLabel } from "@/lib/series-utils";
import { decodeHtmlEntities, formatTimeSplit, formatCompactCount } from "@/lib/formats";
import { formatRecurrence, type Frequency, type DayOfWeek } from "@/lib/recurrence";
import SeriesBadge from "./SeriesBadge";
import RSVPButton from "./RSVPButton";
import { isTicketingUrl, getLinkOutLabel } from "@/lib/card-utils";
import Image from "@/components/SmartImage";

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
  blurhash?: string | null;
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
  density?: "comfortable" | "compact";
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
  density = "comfortable",
}: Props) {
  const typeColor = getSeriesTypeColor(series.series_type);
  const seriesTitle = decodeHtmlEntities(series.title);
  const seriesUrl = useMemo(() => {
    if (!portalSlug) return `/series/${series.slug}`;
    return `/${portalSlug}?series=${series.slug}`;
  }, [portalSlug, series.slug]);
  const contextLabelClass = contextColor ? "text-[var(--context-accent)]" : "text-accent";

  // Get total showtime count
  const totalShowtimes = venueGroups.reduce((sum, vg) => sum + vg.showtimes.length, 0);

  const firstShowtime = venueGroups[0]?.showtimes[0];
  const firstVenue = venueGroups[0]?.venue;
  const firstVenueName = firstVenue?.name ? decodeHtmlEntities(firstVenue.name) : null;
  const firstVenueNeighborhood = firstVenue?.neighborhood ? decodeHtmlEntities(firstVenue.neighborhood) : null;
  const railImageUrl = series.image_url ?? undefined;
  const railBlurhash = series.blurhash || null;
  const hasRailImage = Boolean(railImageUrl);

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
  const compactSeriesTypeLabel = getSeriesTypeLabel(series.series_type);
  const compactTimeLabel = timeParts
    ? `${timeParts.time}${timeParts.period ? ` ${timeParts.period}` : ""}`
    : `${totalShowtimes} ${totalShowtimes === 1 ? "show" : "shows"}`;

  if (density === "compact") {
    return (
      <div
        className={`find-row-card ${disableMargin ? "" : "mb-2.5"} rounded-xl border border-[var(--twilight)]/75 group overflow-hidden border-l-[2px] border-l-[var(--accent-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${skipAnimation ? "" : "animate-card-emerge"} ${className ?? ""}`}
        tabIndex={0}
        data-list-row="true"
        aria-label={`${seriesTitle}, ${totalShowtimes} showtimes`}
        style={
          {
            "--accent-color": typeColor,
            "--context-accent": contextColor,
            "--cta-border": "color-mix(in srgb, var(--accent-color) 70%, transparent)",
            "--cta-glow": "color-mix(in srgb, var(--accent-color) 35%, transparent)",
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
          } as CSSProperties
        }
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3 py-2.5">
          <Link href={seriesUrl} scroll={false} data-row-primary-link="true" className="min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex-shrink-0 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent-color)] min-w-[76px] sm:min-w-[82px]">
                  {compactTimeLabel}
                </span>
                <span className="truncate text-[0.94rem] sm:text-[0.98rem] font-medium text-[var(--cream)] group-hover:text-[var(--accent-color)] transition-colors">
                  {seriesTitle}
                </span>
                <span className="inline-block max-w-[84px] sm:max-w-[120px] truncate flex-shrink-0 font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                  {compactSeriesTypeLabel}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-1.5 font-mono text-[0.62rem] text-[var(--muted)] min-w-0">
                {recurrenceText && (
                  <>
                    <span className="truncate">{recurrenceText}</span>
                    {(firstVenueName || totalShowtimes > 0) && <span className="opacity-40">·</span>}
                  </>
                )}
                {firstVenueName && (
                  <>
                    <span className="truncate">{firstVenueName}</span>
                    {firstVenueNeighborhood && <span className="opacity-40">·</span>}
                  </>
                )}
                {firstVenueNeighborhood && <span className="truncate">{firstVenueNeighborhood}</span>}
                {!firstVenueName && !firstVenueNeighborhood && totalShowtimes > 0 && (
                  <span className="truncate">
                    {totalShowtimes} {totalShowtimes === 1 ? "show" : "shows"}
                  </span>
                )}

                {goingCount > 0 && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="text-[var(--coral)] font-medium">{formatCompactCount(goingCount)} going</span>
                  </>
                )}
                {interestedCount > 0 && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="text-[var(--gold)] font-medium">{formatCompactCount(interestedCount)} maybe</span>
                  </>
                )}
                {recommendationCount > 0 && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="text-[var(--lavender)] font-medium">{formatCompactCount(recommendationCount)} rec&apos;d</span>
                  </>
                )}
              </div>
            </div>
          </Link>
          {primaryEventId && (
            <div className="flex items-center gap-1.5">
              <div data-row-save-action="true">
                <RSVPButton eventId={primaryEventId} variant="compact" className="list-save-trigger" />
              </div>
              {isExternalLinkOut && linkOutUrl && (
                <a
                  href={linkOutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={linkOutLabel}
                  data-row-open-action="true"
                  className="hidden sm:inline-flex w-9 h-9 items-center justify-center rounded-lg border border-[var(--twilight)]/75 bg-[var(--dusk)]/72 text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--cta-border,rgba(255,107,122,0.7))] hover:shadow-[0_0_14px_var(--cta-glow,rgba(255,107,122,0.2))] transition-all"
                >
                  {isTicketLinkOut ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    );
  }

  return (
    <div
      className={`find-row-card ${disableMargin ? "" : "mb-3 sm:mb-4"} rounded-2xl border border-[var(--twilight)]/75 group overflow-hidden border-l-[2px] border-l-[var(--accent-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${skipAnimation ? "" : "animate-card-emerge"} ${className ?? ""}`}
      tabIndex={0}
      data-list-row="true"
      aria-label={`${seriesTitle}, ${totalShowtimes} showtimes`}
      style={
        {
          "--accent-color": typeColor,
          "--context-accent": contextColor,
          "--cta-border": "color-mix(in srgb, var(--accent-color) 70%, transparent)",
          "--cta-glow": "color-mix(in srgb, var(--accent-color) 35%, transparent)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
        } as CSSProperties
      }
    >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
          <Link
            href={seriesUrl}
            scroll={false}
            data-row-primary-link="true"
            className="block min-w-0 p-3.5 sm:p-4"
          >
            <div className="flex gap-3 sm:gap-4">
              {/* Time cell - matches EventCard typography */}
              <div
                className={`hidden sm:flex flex-shrink-0 self-stretch relative w-[124px] -ml-3.5 sm:-ml-4 -my-3.5 sm:-my-4 overflow-hidden border-r border-[var(--twilight)]/60 ${
                  hasRailImage ? "list-rail-media" : "bg-[var(--night)]/44"
                }`}
                style={{ borderTopLeftRadius: "inherit", borderBottomLeftRadius: "inherit" }}
              >
                {railImageUrl && (
                  <>
                    <Image
                      src={railImageUrl}
                      alt={seriesTitle}
                      fill
                      blurhash={railBlurhash}
                      sizes="124px"
                      className="object-cover scale-[1.03] transform-gpu will-change-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/56 to-black/20 pointer-events-none" />
                  </>
                )}
                <div className="relative z-10 flex h-full flex-col items-start justify-center gap-1.5 pl-3 pr-2 py-3 sm:py-4">
                  <span className="font-mono text-[0.62rem] font-semibold leading-none uppercase tracking-[0.12em] text-[var(--accent-color)]">
                    {totalShowtimes} {series.series_type === "film" ? (totalShowtimes === 1 ? "show" : "shows") : (totalShowtimes === 1 ? "time" : "times")}
                  </span>
                  {timeParts && (
                    <>
                      <span className={`font-mono text-[1.42rem] font-bold leading-none tabular-nums ${hasRailImage ? "text-white" : "text-[var(--cream)]"}`}>
                        {timeParts.time}
                      </span>
                      {timeParts.period && (
                        <span className={`font-mono text-[0.58rem] font-medium uppercase tracking-[0.12em] ${hasRailImage ? "text-white/78" : "text-[var(--soft)]"}`}>
                          {timeParts.period}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Mobile: Stacked layout matching EventCard */}
                <div className="sm:hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent-20 border border-[var(--twilight)]/50">
                      <SeriesTypeIcon
                        type={series.series_type}
                        size={16}
                        className="text-accent icon-neon-subtle"
                      />
                    </span>
                    <span className="inline-flex items-baseline gap-1 font-mono text-[0.98rem] font-bold leading-none text-[var(--accent-color)]">
                      {totalShowtimes} {totalShowtimes === 1 ? "show" : "times"}
                      {timeParts && (
                        <>
                          <span className="text-[var(--muted)] mx-0.5">@</span>
                          <span className="text-[var(--cream)]">{timeParts.time}</span>
                          {timeParts.period && <span className="text-[0.58rem] font-medium text-[var(--soft)] uppercase tracking-[0.1em]">{timeParts.period}</span>}
                        </>
                      )}
                    </span>
                  </div>
                  {contextLabel && (
                    <div className={`text-[0.6rem] font-mono uppercase tracking-wider ${contextLabelClass} mb-1`}>
                      {contextLabel}
                    </div>
                  )}
                  <h3 className="text-[var(--cream)] font-semibold text-[1.03rem] leading-tight line-clamp-2 group-hover:text-[var(--accent-color)] transition-colors mb-1.5">
                    {seriesTitle}
                  </h3>
                </div>

                {/* Desktop: Inline layout matching EventCard */}
                <div className="hidden sm:block">
                  {contextLabel && (
                    <div className={`text-[0.6rem] font-mono uppercase tracking-wider ${contextLabelClass} mb-0.5`}>
                      {contextLabel}
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-accent-20 border border-[var(--twilight)]/55">
                      <SeriesTypeIcon
                        type={series.series_type}
                        size={18}
                        className="text-accent icon-neon-subtle"
                      />
                    </span>
                    <span className="text-[var(--cream)] font-semibold text-[1.3rem] transition-colors line-clamp-1 group-hover:text-[var(--accent-color)] leading-tight">
                      {seriesTitle}
                    </span>
                  </div>
                </div>

                {/* Details row - matches EventCard style */}
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed flex-wrap">
                  {firstVenueName && (
                    <span className="truncate max-w-[70%] sm:max-w-[45%] font-medium text-[var(--text-base)]" title={firstVenueName}>
                      {firstVenueName}
                    </span>
                  )}
                  {venueGroups.length > 1 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>+{venueGroups.length - 1} more venues</span>
                    </>
                  )}
                  {firstVenueNeighborhood && venueGroups.length === 1 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="truncate text-[var(--text-tertiary)]">{firstVenueNeighborhood}</span>
                    </>
                  )}
                  <span className="hidden sm:contents">
                    <span className="opacity-40">·</span>
                    <SeriesBadge
                      seriesType={series.series_type}
                      frequency={series.frequency as Frequency}
                      dayOfWeek={series.day_of_week as DayOfWeek}
                      compact
                    />
                  </span>
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
                    {/* Mobile: collapsed social proof — single summary pill */}
                    {hasSocialProof && (() => {
                      const counts = [
                        { type: "going" as const, count: goingCount, label: "going", color: "coral" },
                        { type: "interested" as const, count: interestedCount, label: "maybe", color: "gold" },
                        { type: "recommended" as const, count: recommendationCount, label: "rec'd", color: "lavender" },
                      ];
                      const dominant = counts.reduce((a, b) => (b.count > a.count ? b : a));
                      const totalCount = goingCount + interestedCount + recommendationCount;
                      if (totalCount <= 0) return null;
                      return (
                        <span className={`sm:hidden inline-flex items-center gap-1 font-mono text-[0.6rem] font-medium px-1.5 py-0.5 rounded-lg ${
                          dominant.color === "coral"
                            ? "bg-[var(--coral)]/10 border border-[var(--coral)]/20 text-[var(--coral)]"
                            : dominant.color === "gold"
                              ? "bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)]"
                              : "bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 text-[var(--lavender)]"
                        }`}>
                          {dominant.type === "going" && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {dominant.type === "recommended" && (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          )}
                          {formatCompactCount(totalCount)} {dominant.label}
                        </span>
                      );
                    })()}
                    {/* Desktop: separate pills */}
                    <span className="hidden sm:contents">
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
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
          {primaryEventId && (
            <div className="flex flex-col items-end gap-2 pt-3 pr-3 pb-3 sm:pt-4 sm:pr-4 sm:pb-4 flex-shrink-0">
              <div className="flex items-start gap-1.5 sm:gap-2">
                <div data-row-save-action="true">
                  <RSVPButton eventId={primaryEventId} variant="compact" className="list-save-trigger" />
                </div>
                {isExternalLinkOut && linkOutUrl && (
                  <a
                    href={linkOutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={linkOutLabel}
                    data-row-open-action="true"
                    className="hidden sm:inline-flex w-10 h-10 items-center justify-center rounded-xl border border-[var(--twilight)]/75 bg-[var(--dusk)]/72 text-[var(--muted)] backdrop-blur-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] hover:text-[var(--cream)] hover:border-[var(--cta-border,rgba(255,107,122,0.7))] hover:shadow-[0_0_18px_var(--cta-glow,rgba(255,107,122,0.25))] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
                  >
                    {isTicketLinkOut ? (
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    ) : (
                      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v8a1 1 0 001 1h8" />
                      </svg>
                    )}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
    </div>
  );
});

export default SeriesCard;
