"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format, parseISO, isSameDay } from "date-fns";
import { getSeriesTypeColor } from "@/lib/series-utils";
import type { FestivalInfo, FestivalSummary } from "@/lib/event-grouping";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { formatTimeSplit, getLocalDateString } from "@/lib/formats";
import { computeCountdown, formatFestivalDates } from "@/lib/moments-utils";

interface Props {
  festival: FestivalInfo;
  summary: FestivalSummary;
  portalSlug?: string;
  skipAnimation?: boolean;
  className?: string;
  disableMargin?: boolean;
  contextLabel?: string;
  contextColor?: string;
}

/**
 * Collapsed festival/convention card that shows a summary
 * instead of individual events/showtimes
 */
const FestivalCard = memo(function FestivalCard({
  festival,
  summary,
  portalSlug,
  skipAnimation,
  className,
  disableMargin,
  contextLabel,
  contextColor,
}: Props) {
  const typeColor = getSeriesTypeColor("festival_program");
  const formatFestivalType = (value?: string | null) => {
    if (!value) return "Festival";
    const normalized = value.toLowerCase();
    if (normalized === "festival") return "Festival";
    if (normalized === "conference") return "Conference";
    if (normalized === "convention") return "Convention";
    return normalized
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };
  const searchParams = useSearchParams();
  const typeLabel = formatFestivalType(festival.festival_type);
  const festivalUrl = useMemo(() => {
    if (!portalSlug) return `/festivals/${festival.slug}`;
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.delete("event");
    params.delete("spot");
    params.delete("series");
    params.delete("festival");
    params.delete("org");
    params.set("festival", festival.slug);
    return `/${portalSlug}?${params.toString()}`;
  }, [portalSlug, festival.slug, searchParams]);
  const accentClass = createCssVarClass("--accent-color", typeColor, "accent");
  const contextAccentClass = contextColor
    ? createCssVarClass("--context-accent", contextColor, "context-accent")
    : null;
  const scopedCss = [accentClass?.css, contextAccentClass?.css].filter(Boolean).join("\n");
  const contextLabelClass = contextColor ? "text-[var(--context-accent)]" : "text-accent";

  // Format date range
  const startDate = parseISO(summary.startDate);
  const endDate = parseISO(summary.endDate);
  const isSingleDay = isSameDay(startDate, endDate);

  // Calculate days
  const dayCount = isSingleDay
    ? 1
    : Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const firstVenue = summary.venues[0];
  const locationLabel = festival.location || firstVenue?.name;

  const formatCompactTime = (time: string | null) => {
    if (!time) return null;
    const { time: t, period } = formatTimeSplit(time, false);
    if (t === "TBA") return null;
    return period ? `${t}${period}` : t;
  };

  const startTimeLabel = formatCompactTime(summary.startTime);
  const endTimeLabel = formatCompactTime(summary.endTime);
  const timeRangeLabel =
    startTimeLabel && endTimeLabel
      ? `${startTimeLabel}–${endTimeLabel}`
      : startTimeLabel;

  const isStandalone = summary.eventCount === 0;
  const dateRangeLabel = formatFestivalDates(summary.startDate, summary.endDate);

  return (
    <>
      <ScopedStyles css={scopedCss} />
      <Link
        href={festivalUrl}
        scroll={false}
        className={`block p-3 ${disableMargin ? "" : "mb-4"} rounded-sm border border-[var(--twilight)] card-atmospheric glow-accent reflection-accent group overflow-hidden bg-[var(--card-bg)] border-l-[3px] border-l-[var(--accent-color)] ${accentClass?.className ?? ""} ${contextAccentClass?.className ?? ""} ${skipAnimation ? "" : "animate-card-emerge"} ${className ?? ""}`}
      >
      <div className="flex gap-3">
        {/* Date cell - matches EventCard time cell */}
        <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
          <span className="font-mono text-[0.65rem] font-semibold text-[var(--coral)] leading-none uppercase tracking-wide">
            {format(startDate, "MMM")}
          </span>
          <span className="font-mono text-base font-bold text-[var(--cream)] leading-none tabular-nums mt-1">
            {format(startDate, "d")}
          </span>
          {dayCount > 1 && (
            <span className="font-mono text-[0.6rem] font-medium text-[var(--soft)] mt-0.5">
              {dayCount} days
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile: Stacked layout matching EventCard */}
          <div className="sm:hidden">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded bg-accent-20"
              >
                <span className="text-xs font-bold text-accent">
                  {typeLabel.charAt(0)}
                </span>
              </span>
            </div>
            {contextLabel && (
              <div className={`text-[0.6rem] font-mono uppercase tracking-wider ${contextLabelClass} mb-1`}>
                {contextLabel}
              </div>
            )}
            <h3 className="text-[var(--cream)] font-bold text-lg leading-tight line-clamp-2 group-hover:text-[var(--glow-color)] transition-colors mb-1">
              {festival.name}
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
              <span
                className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded bg-accent-20"
              >
                <span className="text-sm font-bold text-accent">
                  {typeLabel.charAt(0)}
                </span>
              </span>
              <span className="text-[var(--cream)] font-bold text-lg transition-colors line-clamp-1 group-hover:text-[var(--glow-color)]">
                {festival.name}
              </span>
            </div>
          </div>

          {/* Details row - matches EventCard style */}
          {isStandalone ? (
            <StandaloneDetails
              festival={festival}
              summary={summary}
              locationLabel={locationLabel}
              dateRangeLabel={dateRangeLabel}
              typeLabel={typeLabel}
              isSingleDay={isSingleDay}
            />
          ) : (
            <LinkedDetails
              summary={summary}
              locationLabel={locationLabel}
              timeRangeLabel={timeRangeLabel}
              typeLabel={typeLabel}
              isSingleDay={isSingleDay}
            />
          )}
        </div>

      </div>
      </Link>
    </>
  );
});

/** Details row for standalone festivals (no linked events) */
function StandaloneDetails({
  festival,
  summary,
  locationLabel,
  dateRangeLabel,
  typeLabel,
  isSingleDay,
}: {
  festival: FestivalInfo;
  summary: FestivalSummary;
  locationLabel: string | undefined;
  dateRangeLabel: string | null;
  typeLabel: string;
  isSingleDay: boolean;
}) {
  const today = getLocalDateString();
  const countdown = computeCountdown(
    {
      id: festival.id,
      name: festival.name,
      slug: festival.slug,
      announced_start: summary.startDate,
      announced_end: summary.endDate,
      typical_month: null,
      free: festival.free ?? false,
      website: null,
      typical_duration_days: null,
      location: festival.location ?? null,
      neighborhood: festival.neighborhood ?? null,
      categories: summary.categories,
      ticket_url: null,
      description: null,
      image_url: festival.image_url,
      producer_id: null,
    },
    today
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--soft)] mt-1">
      {!isSingleDay && dateRangeLabel && (
        <span className="font-medium">{dateRangeLabel}</span>
      )}
      {locationLabel && (
        <>
          {!isSingleDay && dateRangeLabel && <span className="opacity-40">·</span>}
          <span className="truncate max-w-[40%]" title={locationLabel}>{locationLabel}</span>
        </>
      )}
      {countdown.urgency !== "tbd" && countdown.urgency !== "month-label" && (
        <>
          <span className="opacity-40">·</span>
          <span className="font-mono text-[0.7rem] text-[var(--coral)]">
            {countdown.text}
          </span>
        </>
      )}
      {festival.free && (
        <>
          <span className="opacity-40">·</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-mono font-medium bg-green-900/30 text-green-400">
            Free
          </span>
        </>
      )}
      {!isSingleDay && (
        <>
          <span className="opacity-40">·</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-mono font-medium bg-accent-20 text-accent">
            {typeLabel}
          </span>
        </>
      )}
      {summary.categories.length > 0 && (
        <>
          <span className="opacity-40">·</span>
          <span className="font-mono text-[0.65rem] text-[var(--muted)]">
            {summary.categories.slice(0, 2).join(", ")}
          </span>
        </>
      )}
    </div>
  );
}

/** Details row for festivals with linked events */
function LinkedDetails({
  summary,
  locationLabel,
  timeRangeLabel,
  typeLabel,
  isSingleDay,
}: {
  summary: FestivalSummary;
  locationLabel: string | undefined;
  timeRangeLabel: string | null | undefined;
  typeLabel: string;
  isSingleDay: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 text-sm text-[var(--soft)] mt-1">
        {locationLabel && (
          <span className="truncate max-w-[40%] font-medium" title={locationLabel}>{locationLabel}</span>
        )}
        {summary.venues.length > 1 && (
          <>
            <span className="opacity-40">·</span>
            <span>+{summary.venues.length - 1} venues</span>
          </>
        )}
        <span className="opacity-40">·</span>
        <span className="font-mono text-[0.7rem] text-[var(--muted)]">
          {timeRangeLabel || "Times vary"}
        </span>
        <span className="opacity-40">·</span>
        <span>{summary.programCount} program{summary.programCount !== 1 ? "s" : ""}</span>
        <span className="opacity-40">·</span>
        <span>{summary.eventCount} session{summary.eventCount !== 1 ? "s" : ""}</span>
        {!isSingleDay && (
          <>
            <span className="opacity-40">·</span>
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-mono font-medium bg-accent-20 text-accent"
            >
              {typeLabel}
            </span>
          </>
        )}
      </div>

      {/* Venue pills (if multiple) */}
      {summary.venues.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {summary.venues.slice(0, 3).map((venue) => (
            <span
              key={venue.id}
              className="font-mono text-[0.6rem] px-1.5 py-0.5 rounded bg-[var(--twilight)]/40 text-[var(--soft)]"
            >
              {venue.name}
            </span>
          ))}
          {summary.venues.length > 3 && (
            <span className="font-mono text-[0.6rem] px-1.5 py-0.5 text-[var(--muted)]">
              +{summary.venues.length - 3} more
            </span>
          )}
        </div>
      )}
    </>
  );
}

export default FestivalCard;
