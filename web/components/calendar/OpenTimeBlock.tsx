"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import type { CalendarEvent } from "@/lib/types/calendar";

interface OpenTimeBlockProps {
  events: CalendarEvent[];
  selectedDate: Date;
}

interface TimeGap {
  startHour: number;
  endHour: number;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

function findFirstGap(events: CalendarEvent[]): TimeGap | null {
  // Only consider going-status events that have a start_time
  const timed = events
    .filter((e) => e.rsvp_status === "going" && e.start_time !== null)
    .map((e) => {
      const [h, m] = (e.start_time as string).split(":").map(Number);
      // hour as decimal to account for minutes
      const startDecimal = h + m / 60;
      let endDecimal: number;
      if (e.end_time) {
        const [eh, em] = e.end_time.split(":").map(Number);
        endDecimal = eh + em / 60;
      } else {
        // Assume 2-hour event if no end time
        endDecimal = startDecimal + 2;
      }
      return { startDecimal, endDecimal };
    })
    .sort((a, b) => a.startDecimal - b.startDecimal);

  if (timed.length < 2) return null;

  for (let i = 0; i < timed.length - 1; i++) {
    const gapStart = timed[i].endDecimal;
    const gapEnd = timed[i + 1].startDecimal;
    const gapHours = gapEnd - gapStart;

    if (gapHours >= 1) {
      return {
        startHour: Math.ceil(gapStart),
        endHour: Math.floor(gapEnd),
      };
    }
  }

  return null;
}

export function OpenTimeBlock({ events, selectedDate }: OpenTimeBlockProps) {
  const gap = findFirstGap(events);

  if (!gap) return null;

  const dateParam = format(selectedDate, "yyyy-MM-dd");
  const exploreHref = `/${DEFAULT_PORTAL_SLUG}?view=happening&date=${dateParam}`;

  return (
    <div className="bg-gradient-to-r from-[var(--coral)]/10 to-[var(--gold)]/10 border border-[var(--coral)]/20 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span aria-hidden="true">✨</span>
            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--coral)]">
              OPEN TIME
            </span>
          </div>
          <p className="text-sm font-medium text-[var(--cream)]">
            You&apos;re free {formatHour(gap.startHour)}–{formatHour(gap.endHour)}
          </p>
        </div>
        <Link
          href={exploreHref}
          className="text-xs font-mono text-[var(--coral)] hover:underline flex-shrink-0 mt-0.5"
        >
          Explore nearby →
        </Link>
      </div>
    </div>
  );
}
