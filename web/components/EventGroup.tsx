"use client";

import { useState } from "react";
import Link from "next/link";
import type { EventWithLocation } from "@/lib/search";
import { formatTime, formatTimeSplit } from "@/lib/formats";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { getReflectionClass } from "@/lib/card-utils";

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
}

export default function EventGroup({
  type,
  title,
  subtitle,
  events,
  portalSlug,
  skipAnimation,
  venueSlug,
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

  return (
    <div
      className={`rounded-sm border border-[var(--twilight)] mb-4 overflow-hidden card-atmospheric glow-accent reflection-accent bg-[var(--card-bg)] ${reflectionClass} ${skipAnimation ? "" : "animate-fade-in"} ${accentClass?.className ?? ""} ${
        categoryColor ? "border-l-[3px] border-l-[var(--accent-color)]" : ""
      }`}
    >
      <ScopedStyles css={accentClass?.css} />
      {/* Header - clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="group w-full p-3 flex items-center gap-3 hover:bg-[var(--twilight)]/20 transition-colors"
      >
        {/* Time of earliest event - matches EventCard format */}
        {(() => {
          const { time, period } = formatTimeSplit(events[0]?.start_time);
          return (
            <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
              <span className="font-mono text-sm font-semibold text-[var(--cream)] leading-none tabular-nums">
                {time}
              </span>
              {period && (
                <span className="font-mono text-[0.6rem] font-medium text-[var(--soft)] mt-0.5">{period}</span>
              )}
            </div>
          );
        })()}
        {dominantCategory && (
          <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded bg-accent-20">
            <CategoryIcon type={dominantCategory} size={18} glow="subtle" />
          </span>
        )}
        <div className="flex-1 min-w-0 text-left">
          {venueSlug ? (
            <Link
              href={portalSlug ? `/${portalSlug}?spot=${venueSlug}` : `/spots/${venueSlug}`}
              scroll={false}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-base text-[var(--cream)] hover:text-[var(--coral)] truncate block transition-colors leading-tight"
            >
              {title}
            </Link>
          ) : (
            <span className="font-semibold text-base text-[var(--cream)] group-hover:text-[var(--glow-color,var(--neon-magenta))] truncate block transition-colors leading-tight">{title}</span>
          )}
          {subtitle && <span className="text-sm text-[var(--soft)] mt-0.5 block">{subtitle}</span>}
        </div>
        {/* Event count badge - prominent styling */}
        <span
          className={`font-mono text-xs px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap font-medium ${
            categoryColor ? "bg-accent-20 text-accent" : "bg-[var(--twilight)] text-[var(--cream)]"
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
        <div className="border-t border-[var(--twilight)]/30">
          {groupedEvents.map((group, idx) => (
            <div
              key={group.title + idx}
              className={`px-3 py-2 ${idx > 0 ? "border-t border-[var(--twilight)]/20" : ""}`}
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
                    className="text-sm text-[var(--cream)] hover:text-[var(--coral)] truncate transition-colors"
                  >
                    {group.title}
                  </Link>
                ) : (
                  <span className="text-sm text-[var(--cream)] truncate">{group.title}</span>
                )}
              </div>

              {/* Showtimes row */}
              <div className="flex flex-wrap gap-1.5 ml-5">
                {group.events.map((event) => (
                  <Link
                    key={event.id}
                    href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
                    scroll={false}
                    className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--twilight)]/40 text-[var(--muted)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
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
