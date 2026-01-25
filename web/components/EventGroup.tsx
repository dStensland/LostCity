"use client";

import { useState } from "react";
import Link from "next/link";
import type { EventWithLocation } from "@/lib/search";
import { formatTime, formatTimeSplit } from "@/lib/formats";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";

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

// Get reflection color class based on category
function getReflectionClass(category: string | null): string {
  if (!category) return "";
  const reflectionMap: Record<string, string> = {
    music: "reflect-music",
    comedy: "reflect-comedy",
    art: "reflect-art",
    theater: "reflect-theater",
    film: "reflect-film",
    community: "reflect-community",
    food_drink: "reflect-food",
    food: "reflect-food",
    sports: "reflect-sports",
    fitness: "reflect-fitness",
    nightlife: "reflect-nightlife",
    family: "reflect-family",
  };
  return reflectionMap[category] || "";
}

// Group events by title to combine showtimes
interface GroupedEvent {
  title: string;
  category: string | null;
  events: EventWithLocation[];
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
}

export default function EventGroup({
  type,
  title,
  subtitle,
  events,
  portalSlug,
  skipAnimation,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group events by title for multi-showtime display
  const groupedEvents = groupEventsByTitle(events);

  // Get category for color accent
  const venueCategory = type === "venue" ? getVenueCategory(title) : null;
  const dominantCategory = venueCategory || events[0]?.category || null;
  const categoryColor = dominantCategory ? getCategoryColor(dominantCategory) : null;
  const reflectionClass = getReflectionClass(dominantCategory);

  return (
    <div
      className={`rounded-lg border border-[var(--twilight)] mb-4 overflow-hidden card-atmospheric ${reflectionClass} ${skipAnimation ? "" : "animate-fade-in"}`}
      style={{
        borderLeftWidth: categoryColor ? "3px" : undefined,
        borderLeftColor: categoryColor || undefined,
        backgroundColor: "var(--card-bg)",
        "--glow-color": categoryColor || "var(--neon-magenta)",
        "--reflection-color": categoryColor ? `color-mix(in srgb, ${categoryColor} 15%, transparent)` : undefined,
      } as React.CSSProperties}
    >
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
            <div className="flex-shrink-0 w-12 flex flex-col items-center justify-center">
              <span className="font-mono text-sm text-[var(--muted)] leading-none">
                {time}
              </span>
              {period && (
                <span className="font-mono text-[0.5rem] text-[var(--muted)] opacity-60">{period}</span>
              )}
            </div>
          );
        })()}
        {dominantCategory ? (
          <CategoryIcon type={dominantCategory} size={16} className="flex-shrink-0 opacity-70" />
        ) : (
          <svg className="w-4 h-4 text-[var(--muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
        <div className="flex-1 min-w-0 text-left">
          <span className="font-medium text-sm text-[var(--cream)] group-hover:text-[var(--glow-color,var(--neon-magenta))] truncate block transition-colors">{title}</span>
          {subtitle && <span className="text-xs text-[var(--muted)]">{subtitle}</span>}
        </div>
        <span className="font-mono text-[0.6rem] text-[var(--muted)] bg-[var(--twilight)]/50 px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap">
          {events.length} {events.length === 1 ? "thing" : "things"}
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
                <span className="text-sm text-[var(--cream)] truncate">{group.title}</span>
              </div>

              {/* Showtimes row */}
              <div className="flex flex-wrap gap-1.5 ml-5">
                {group.events.map((event) => (
                  <Link
                    key={event.id}
                    href={portalSlug ? `/${portalSlug}/events/${event.id}` : `/events/${event.id}`}
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
