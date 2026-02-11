"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format, parseISO, isSameDay } from "date-fns";
import { getSeriesTypeColor } from "@/lib/series-utils";
import type { FestivalInfo, FestivalSummary } from "@/lib/event-grouping";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { decodeHtmlEntities, formatTimeSplit, getLocalDateString } from "@/lib/formats";
import { computeCountdown, formatFestivalDates } from "@/lib/moments-utils";
import Image from "@/components/SmartImage";

interface Props {
  festival: FestivalInfo;
  summary: FestivalSummary;
  portalSlug?: string;
  skipAnimation?: boolean;
  className?: string;
  disableMargin?: boolean;
  contextLabel?: string;
  contextColor?: string;
  density?: "comfortable" | "compact";
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
  density = "comfortable",
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
  const festivalName = decodeHtmlEntities(festival.name);
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
  const locationLabel = decodeHtmlEntities(festival.location || firstVenue?.name || "");

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
  const compactTimeLabel = format(startDate, "MMM d");

  if (density === "compact") {
    return (
      <>
        <ScopedStyles css={scopedCss} />
        <Link
          href={festivalUrl}
          scroll={false}
          className={`find-row-card block ${disableMargin ? "" : "mb-2.5"} rounded-xl border border-[var(--twilight)]/75 group overflow-hidden border-l-[2px] border-l-[var(--accent-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${accentClass?.className ?? ""} ${contextAccentClass?.className ?? ""} ${skipAnimation ? "" : "animate-card-emerge"} ${className ?? ""}`}
          tabIndex={0}
          data-list-row="true"
          data-row-primary-link="true"
          aria-label={festivalName}
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
          }}
        >
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex-shrink-0 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent-color)] min-w-[76px] sm:min-w-[82px]">
                {compactTimeLabel}
              </span>
              <span className="truncate text-[0.94rem] sm:text-[0.98rem] font-medium text-[var(--cream)] group-hover:text-[var(--accent-color)] transition-colors">
                {festivalName}
              </span>
              <span className="inline-block max-w-[84px] sm:max-w-[120px] truncate flex-shrink-0 font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                {typeLabel}
              </span>
            </div>
          </div>
        </Link>
      </>
    );
  }

  return (
    <>
      <ScopedStyles css={scopedCss} />
      <Link
        href={festivalUrl}
        scroll={false}
        className={`find-row-card block ${disableMargin ? "" : "mb-3 sm:mb-4"} rounded-2xl border border-[var(--twilight)]/75 group overflow-hidden border-l-[2px] border-l-[var(--accent-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${accentClass?.className ?? ""} ${contextAccentClass?.className ?? ""} ${skipAnimation ? "" : "animate-card-emerge"} ${className ?? ""}`}
        tabIndex={0}
        data-list-row="true"
        data-row-primary-link="true"
        aria-label={festivalName}
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
        }}
      >
      <div className="p-3.5 sm:p-4 flex gap-3 sm:gap-4">
        {/* Date cell - matches EventCard time cell */}
        <div className={`hidden sm:flex flex-shrink-0 self-stretch ${festival.image_url ? "relative w-[124px] -ml-3.5 sm:-ml-4 -my-3.5 sm:-my-4 overflow-hidden list-rail-media border-r border-[var(--twilight)]/60" : "w-[72px] flex-col items-start justify-center gap-1.5 pr-3 border-r border-[var(--twilight)]/60"}`}>
          {festival.image_url && (
            <>
              <Image
                src={festival.image_url}
                alt={festivalName}
                fill
                sizes="124px"
                className="object-cover scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/56 to-black/20 pointer-events-none" />
            </>
          )}
          <div className={`relative z-10 flex flex-col items-start justify-center gap-1.5 ${festival.image_url ? "h-full pl-3 pr-2 py-3 sm:py-4" : ""}`}>
            <span className="font-mono text-[0.62rem] font-semibold text-[var(--accent-color)] leading-none uppercase tracking-[0.12em]">
              {format(startDate, "MMM")}
            </span>
            <span className={`font-mono text-[1.42rem] font-bold leading-none tabular-nums ${festival.image_url ? "text-white" : "text-[var(--cream)]"}`}>
              {format(startDate, "d")}
            </span>
            {dayCount > 1 && (
              <span className={`font-mono text-[0.58rem] font-medium uppercase tracking-[0.1em] ${festival.image_url ? "text-white/78" : "text-[var(--soft)]"}`}>
                {dayCount} days
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile: Stacked layout matching EventCard */}
          <div className="sm:hidden">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent-20 border border-[var(--twilight)]/50"
              >
                <span className="text-xs font-bold text-accent">
                  {typeLabel.charAt(0)}
                </span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[var(--twilight)]/65 bg-[var(--dusk)]/75 font-mono text-[0.62rem] text-[var(--soft)]">
                {format(startDate, "MMM d")}
              </span>
            </div>
            {contextLabel && (
              <div className={`text-[0.6rem] font-mono uppercase tracking-wider ${contextLabelClass} mb-1`}>
                {contextLabel}
              </div>
            )}
            <h3 className="text-[var(--cream)] font-semibold text-[1.03rem] leading-tight line-clamp-2 group-hover:text-[var(--accent-color)] transition-colors mb-1.5">
              {festivalName}
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
              <span
                className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-accent-20 border border-[var(--twilight)]/55"
              >
                <span className="text-sm font-bold text-accent">
                  {typeLabel.charAt(0)}
                </span>
              </span>
              <span className="text-[var(--cream)] font-semibold text-[1.3rem] transition-colors line-clamp-1 group-hover:text-[var(--accent-color)] leading-tight">
                {festivalName}
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
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
      {!isSingleDay && dateRangeLabel && (
        <span className="font-medium">{dateRangeLabel}</span>
      )}
      {locationLabel && (
        <>
          {!isSingleDay && dateRangeLabel && <span className="opacity-40">·</span>}
          <span className="truncate max-w-[70%] sm:max-w-[45%] text-[var(--text-base)]" title={locationLabel}>{locationLabel}</span>
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
      <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed flex-wrap">
        {locationLabel && (
          <span className="truncate max-w-[70%] sm:max-w-[45%] font-medium text-[var(--text-base)]" title={locationLabel}>{locationLabel}</span>
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
