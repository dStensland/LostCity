"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { CaretRight, CaretDown } from "@phosphor-icons/react";
import type { SectionProps } from "@/lib/detail/types";
import { buildEventUrl } from "@/lib/entity-urls";

const DATES_COLLAPSED = 5;

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "";
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

export function UpcomingDatesSection({ data, portalSlug }: SectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (data.entityType !== "series") return null;
  if (data.payload.series.series_type === "film") return null;

  const venueShowtimes = data.payload.venueShowtimes ?? [];

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const allEvents = useMemo(() => {
    const events: {
      id: number;
      date: string;
      time: string | null;
      ticketUrl: string | null;
      venueName?: string;
    }[] = [];
    for (const vs of venueShowtimes) {
      for (const e of vs.events) {
        events.push({ ...e, venueName: vs.venue.name });
      }
    }
    return events.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""),
    );
  }, [venueShowtimes]);

  if (allEvents.length === 0) return null;

  const showExpand = allEvents.length > DATES_COLLAPSED;
  const visible = expanded ? allEvents : allEvents.slice(0, DATES_COLLAPSED);

  return (
    <div className="space-y-1">
      {visible.map((event, index) => {
        const href = buildEventUrl(event.id, portalSlug, "canonical");
        return (
          <a
            key={event.id}
            href={href}
            className={`w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg transition-colors focus-ring ${
              index === 0
                ? "py-2.5 bg-[var(--coral)]/10 hover:bg-[var(--coral)]/20"
                : "py-2 hover:bg-[var(--twilight)]/30"
            }`}
          >
            <span
              className={`text-sm ${index === 0 ? "font-medium text-[var(--cream)]" : "text-[var(--soft)]"}`}
            >
              {formatDate(event.date)}
            </span>
            {event.time && (
              <span className="font-mono text-xs text-[var(--muted)]">
                {formatTime(event.time)}
              </span>
            )}
            {venueShowtimes.length > 1 && event.venueName && (
              <>
                <span className="flex-1" />
                <span className="text-xs text-[var(--muted)] truncate max-w-[140px]">
                  {event.venueName}
                </span>
              </>
            )}
            <CaretRight
              size={14}
              weight="bold"
              className={`ml-auto flex-shrink-0 ${index === 0 ? "text-[var(--coral)]" : "text-[var(--muted)]"}`}
            />
          </a>
        );
      })}

      {showExpand && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="w-full py-2.5 min-h-[44px] text-sm font-medium text-[var(--soft)] hover:text-[var(--cream)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--dusk)] transition-colors flex items-center justify-center gap-2 mt-2 focus-ring"
        >
          {expanded ? "Show fewer dates" : `See all ${allEvents.length} dates`}
          <CaretDown
            size={16}
            weight="bold"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </div>
  );
}
