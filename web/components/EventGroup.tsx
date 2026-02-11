"use client";

import { useState } from "react";
import Link from "next/link";
import type { EventWithLocation } from "@/lib/search";
import { decodeHtmlEntities, formatTime, formatTimeSplit } from "@/lib/formats";
import CategoryIcon, { getCategoryColor, getCategoryLabel, type CategoryType } from "./CategoryIcon";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { getReflectionClass } from "@/lib/card-utils";
import Image from "@/components/SmartImage";

// Map known venues to their primary category type
const VENUE_CATEGORY_MAP: Record<string, string> = {
  // Movie theaters
  "plaza theatre": "film",
  "tara theatre": "film",
  "landmark midtown art cinema": "film",
  "regal": "film",
  "amc": "film",
  "cinemark": "film",
  "silverspot": "film",
  // Sports venues
  "state farm arena": "sports",
  "mercedes-benz stadium": "sports",
  "truist park": "sports",
  "georgia tech": "sports",
  "bobby dodd": "sports",
  // Music venues
  "the earl": "music",
  "variety playhouse": "music",
  "tabernacle": "music",
  "fox theatre": "theater",
  "the masquerade": "music",
  "terminal west": "music",
  "coca-cola roxy": "music",
  "buckhead theatre": "music",
  // Comedy
  "laughing skull": "comedy",
  "punchline": "comedy",
  // Art
  "high museum": "art",
  "atlanta contemporary": "art",
};

function getVenueCategory(venueName: string): string | null {
  const lowerName = venueName.toLowerCase();
  if (VENUE_CATEGORY_MAP[lowerName]) {
    return VENUE_CATEGORY_MAP[lowerName];
  }
  for (const [key, category] of Object.entries(VENUE_CATEGORY_MAP)) {
    if (lowerName.includes(key)) {
      return category;
    }
  }
  return null;
}

// Group events by title to combine showtimes
interface GroupedEvent {
  title: string;
  category: string | null;
  events: EventWithLocation[];
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
  } | null;
}

function groupEventsByTitle(events: EventWithLocation[]): GroupedEvent[] {
  const groups = new Map<string, GroupedEvent>();

  for (const event of events) {
    const key = event.title.toLowerCase().trim();
    if (!groups.has(key)) {
      groups.set(key, {
        title: event.title,
        category: event.category,
        events: [],
        series: event.series || null,
      });
    }
    groups.get(key)!.events.push(event);
  }

  // Sort each group's events by time
  for (const group of groups.values()) {
    group.events.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }

  // Return groups sorted by earliest showtime
  return Array.from(groups.values()).sort((a, b) =>
    (a.events[0]?.start_time || "").localeCompare(b.events[0]?.start_time || "")
  );
}

interface Props {
  type: "venue" | "category";
  title: string;
  subtitle?: string;
  events: EventWithLocation[];
  portalSlug?: string;
  skipAnimation?: boolean;
  venueSlug?: string;
  density?: "comfortable" | "compact";
}

export default function EventGroup({
  type,
  title,
  subtitle,
  events,
  portalSlug,
  skipAnimation,
  venueSlug,
  density = "comfortable",
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group events by title for multi-showtime display
  const groupedEvents = groupEventsByTitle(events);

  // Get category for color accent
  const venueCategory = type === "venue" ? getVenueCategory(title) : null;
  const dominantCategory = venueCategory || events[0]?.category || null;
  const categoryColor = dominantCategory ? getCategoryColor(dominantCategory) : null;
  const reflectionClass = getReflectionClass(dominantCategory);
  const accentColor = categoryColor || "var(--neon-magenta)";
  const accentClass = createCssVarClass("--accent-color", accentColor, "accent");
  const displayTitle = decodeHtmlEntities(title);
  const displaySubtitle = subtitle ? decodeHtmlEntities(subtitle) : null;
  const railImageUrl =
    events.find((event) => event.image_url)?.image_url ||
    events.find((event) => event.series?.image_url)?.series?.image_url ||
    null;
  const compactTime = formatTimeSplit(events[0]?.start_time || null);
  const compactTimeLabel = compactTime.time === "TBA"
    ? `${events.length} ${events.length === 1 ? "item" : "items"}`
    : `${compactTime.time}${compactTime.period ? ` ${compactTime.period}` : ""}`;
  const compactChipLabel = type === "category"
    ? "Category"
    : dominantCategory
      ? getCategoryLabel(dominantCategory as CategoryType)
      : "Venue";

  if (density === "compact") {
    return (
      <div
        className={`find-row-card rounded-xl border border-[var(--twilight)]/75 mb-2.5 overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${reflectionClass} ${skipAnimation ? "" : "animate-fade-in"} ${accentClass?.className ?? ""} ${
          categoryColor ? "border-l-[2px] border-l-[var(--accent-color)]" : ""
        }`}
        tabIndex={0}
        data-list-row="true"
        aria-label={displayTitle}
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
        }}
      >
        <ScopedStyles css={accentClass?.css} />
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          data-row-primary-link="true"
          className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left"
        >
          <span className="flex-shrink-0 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent-color)] min-w-[76px] sm:min-w-[82px]">
            {compactTimeLabel}
          </span>
          <span className="truncate text-[0.94rem] sm:text-[0.98rem] font-medium text-[var(--cream)] group-hover:text-[var(--accent-color)] transition-colors">
            {displayTitle}
          </span>
          <span className="inline-block max-w-[76px] sm:max-w-[120px] truncate flex-shrink-0 font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
            {compactChipLabel}
          </span>
          <span className="flex-shrink-0 font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
          <svg
            className={`w-4 h-4 text-[var(--muted)] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="border-t border-[var(--twilight)]/45 bg-[var(--void)]/30">
            {groupedEvents.map((group, idx) => (
              <div
                key={group.title + idx}
                className={`px-4 py-2.5 ${idx > 0 ? "border-t border-[var(--twilight)]/25" : ""}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {group.category && (
                    <CategoryIcon type={group.category} size={12} className="flex-shrink-0 opacity-50" glow="subtle" />
                  )}
                  {group.series ? (
                    <Link
                      href={portalSlug ? `/${portalSlug}?series=${group.series.slug}` : `/series/${group.series.slug}`}
                      scroll={false}
                      className="text-sm text-[var(--cream)] hover:text-[var(--accent-color)] truncate transition-colors"
                    >
                      {decodeHtmlEntities(group.title)}
                    </Link>
                  ) : (
                    <span className="text-sm text-[var(--cream)] truncate">{decodeHtmlEntities(group.title)}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 ml-5">
                  {group.events.map((event) => (
                    <Link
                      key={event.id}
                      href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
                      scroll={false}
                      className="font-mono text-xs px-2 py-0.5 rounded-md bg-[var(--twilight)]/45 text-[var(--muted)] border border-[var(--twilight)]/50 hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
                    >
                      {formatTime(event.start_time)}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`find-row-card rounded-2xl border border-[var(--twilight)]/75 mb-3 sm:mb-4 overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${reflectionClass} ${skipAnimation ? "" : "animate-fade-in"} ${accentClass?.className ?? ""} ${
        categoryColor ? "border-l-[2px] border-l-[var(--accent-color)]" : ""
      }`}
      tabIndex={0}
      data-list-row="true"
      aria-label={displayTitle}
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
      }}
    >
      <ScopedStyles css={accentClass?.css} />
      {/* Header - clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        data-row-primary-link="true"
        className="w-full p-3.5 sm:p-4 flex items-start gap-3 sm:gap-4 hover:bg-[var(--twilight)]/20 transition-colors"
      >
        {/* Time of earliest event - matches EventCard format */}
        {(() => {
          const { time, period } = formatTimeSplit(events[0]?.start_time);
          return (
            <div className={`hidden sm:flex flex-shrink-0 self-stretch ${railImageUrl ? "relative w-[124px] -ml-3.5 sm:-ml-4 -my-3.5 sm:-my-4 overflow-hidden list-rail-media border-r border-[var(--twilight)]/60" : "w-[72px] flex-col items-start justify-center gap-1.5 pr-3 border-r border-[var(--twilight)]/60"}`}>
              {railImageUrl && (
                <>
                  <Image
                    src={railImageUrl}
                    alt={displayTitle}
                    fill
                    sizes="124px"
                    className="object-cover scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/56 to-black/20 pointer-events-none" />
                </>
              )}
              <div className={`relative z-10 flex flex-col items-start justify-center gap-1.5 ${railImageUrl ? "h-full pl-3 pr-2 py-3 sm:py-4" : ""}`}>
                <span className="font-mono text-[0.62rem] font-semibold text-[var(--accent-color)] leading-none uppercase tracking-[0.12em]">
                  {events.length} {events.length === 1 ? "item" : "items"}
                </span>
                <span className={`font-mono text-[1.42rem] font-bold leading-none tabular-nums ${railImageUrl ? "text-white" : "text-[var(--cream)]"}`}>
                  {time}
                </span>
                {period && (
                  <span className={`font-mono text-[0.58rem] font-medium uppercase tracking-[0.12em] ${railImageUrl ? "text-white/78" : "text-[var(--soft)]"}`}>{period}</span>
                )}
              </div>
            </div>
          );
        })()}
        {dominantCategory && (
          <span className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-accent-20 border border-[var(--twilight)]/55">
            <CategoryIcon type={dominantCategory} size={18} glow="subtle" />
          </span>
        )}
        <div className="flex-1 min-w-0 text-left">
          {venueSlug ? (
            <Link
              href={portalSlug ? `/${portalSlug}?spot=${venueSlug}` : `/spots/${venueSlug}`}
              scroll={false}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-[1.24rem] text-[var(--cream)] hover:text-[var(--accent-color)] truncate block transition-colors leading-tight"
            >
              {displayTitle}
            </Link>
          ) : (
            <span className="font-semibold text-[1.24rem] text-[var(--cream)] group-hover:text-[var(--accent-color)] truncate block transition-colors leading-tight">{displayTitle}</span>
          )}
          {displaySubtitle && <span className="text-sm text-[var(--text-tertiary)] mt-1 block truncate">{displaySubtitle}</span>}
        </div>
        {/* Event count badge - prominent styling */}
        <span
          className={`font-mono text-[0.62rem] px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap font-medium ${
            categoryColor ? "bg-accent-20 text-accent border border-[var(--twilight)]/45" : "bg-[var(--twilight)] text-[var(--cream)] border border-[var(--twilight)]/60"
          }`}
        >
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
        <svg
          className={`w-5 h-5 text-[var(--muted)] transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Event List - only show when expanded */}
      {isExpanded && (
        <div className="border-t border-[var(--twilight)]/45 bg-[var(--void)]/30">
          {groupedEvents.map((group, idx) => (
            <div
              key={group.title + idx}
              className={`px-4 py-2.5 ${idx > 0 ? "border-t border-[var(--twilight)]/25" : ""}`}
            >
              {/* Event title row */}
              <div className="flex items-center gap-2 mb-1">
                {group.category && (
                  <CategoryIcon type={group.category} size={12} className="flex-shrink-0 opacity-50" glow="subtle" />
                )}
                {group.series ? (
                  <Link
                    href={portalSlug ? `/${portalSlug}?series=${group.series.slug}` : `/series/${group.series.slug}`}
                    scroll={false}
                    className="text-sm text-[var(--cream)] hover:text-[var(--accent-color)] truncate transition-colors"
                  >
                    {decodeHtmlEntities(group.title)}
                  </Link>
                ) : (
                  <span className="text-sm text-[var(--cream)] truncate">{decodeHtmlEntities(group.title)}</span>
                )}
              </div>

              {/* Showtimes row */}
              <div className="flex flex-wrap gap-1.5 ml-5">
                {group.events.map((event) => (
                  <Link
                    key={event.id}
                    href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
                    scroll={false}
                    className="font-mono text-xs px-2 py-0.5 rounded-md bg-[var(--twilight)]/45 text-[var(--muted)] border border-[var(--twilight)]/50 hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
                  >
                    {formatTime(event.start_time)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
