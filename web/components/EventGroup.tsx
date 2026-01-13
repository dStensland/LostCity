"use client";

import { useState } from "react";
import Link from "next/link";
import type { EventWithLocation } from "@/lib/search";

function formatTime(time: string | null): string {
  if (!time) return "TBA";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes}${period}`;
}

function formatPrice(event: EventWithLocation): string {
  if (event.is_free) return "Free";
  if (event.price_min === null) {
    // Try venue estimate
    const venueMin = event.venue?.typical_price_min;
    const venueMax = event.venue?.typical_price_max;
    if (venueMin != null) {
      if (venueMin === 0) return "Free";
      if (venueMin === venueMax) return `~$${venueMin}`;
      return `~$${venueMin}–${venueMax}`;
    }
    return "—";
  }
  if (event.price_min === event.price_max || event.price_max === null) {
    return `$${event.price_min}`;
  }
  return `$${event.price_min}–${event.price_max}`;
}

interface Props {
  type: "venue" | "category";
  title: string;
  subtitle?: string;
  events: EventWithLocation[];
  previewCount?: number;
}

export default function EventGroup({
  type,
  title,
  subtitle,
  events,
  previewCount = 3,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const previewEvents = events.slice(0, previewCount);
  const remainingCount = events.length - previewCount;
  const displayEvents = isExpanded ? events : previewEvents;

  const icon = type === "venue" ? "📍" : "🤝";
  const countLabel = type === "venue"
    ? `${events.length} showtime${events.length !== 1 ? "s" : ""}`
    : `${events.length} event${events.length !== 1 ? "s" : ""}`;

  return (
    <div className="event-group border border-[var(--twilight)] rounded-lg overflow-hidden bg-[var(--night)]/50 mb-3">
      {/* Group Header */}
      <div className="px-4 py-3 bg-[var(--dusk)]/50 border-b border-[var(--twilight)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg flex-shrink-0">{icon}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-[var(--cream)] truncate">{title}</h3>
              {subtitle && (
                <p className="text-xs text-[var(--muted)] truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <span className="font-mono text-xs text-[var(--soft)] whitespace-nowrap">
            {countLabel}
          </span>
        </div>
      </div>

      {/* Event List */}
      <div className="divide-y divide-[var(--twilight)]/50">
        {displayEvents.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--twilight)]/30 transition-colors"
          >
            <span className="font-mono text-xs text-[var(--coral)] w-16 flex-shrink-0">
              {formatTime(event.start_time)}
            </span>
            <span className="text-sm text-[var(--cream)] truncate flex-1 min-w-0">
              {event.title}
            </span>
            <span className="font-mono text-xs text-[var(--muted)] flex-shrink-0">
              {formatPrice(event)}
            </span>
          </Link>
        ))}
      </div>

      {/* Expand/Collapse Button */}
      {remainingCount > 0 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2.5 text-sm font-medium text-[var(--coral)] hover:text-[var(--rose)] hover:bg-[var(--twilight)]/30 transition-colors border-t border-[var(--twilight)]/50 flex items-center justify-center gap-2"
        >
          {isExpanded ? (
            <>
              <span>Show less</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </>
          ) : (
            <>
              <span>+{remainingCount} more</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}
