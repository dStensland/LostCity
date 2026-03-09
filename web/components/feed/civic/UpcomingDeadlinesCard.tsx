"use client";

import Link from "next/link";
import { ClockCountdown, ArrowRight } from "@phosphor-icons/react";
import { formatSmartDate, formatTime } from "@/lib/formats";
import type { CityPulseSection as CityPulseSectionData } from "@/lib/city-pulse/types";

interface UpcomingDeadlinesCardProps {
  lineupSections: CityPulseSectionData[];
  portalSlug: string;
  minItems?: number;
}

type DeadlineItem = {
  id: number;
  title: string;
  href: string;
  dateLabel: string;
  timeLabel: string;
  timestamp: number;
};

export default function UpcomingDeadlinesCard({
  lineupSections,
  portalSlug,
  minItems = 3,
}: UpcomingDeadlinesCardProps) {
  const deadlines = computeDeadlines(lineupSections, portalSlug);
  if (deadlines.length < minItems) return null;

  return (
    <section className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-md"
            style={{
              backgroundColor: "color-mix(in srgb, var(--action-primary) 12%, transparent)",
            }}
          >
            <ClockCountdown weight="duotone" className="w-3.5 h-3.5 text-[var(--action-primary)]" />
          </div>
          <span className="font-mono text-xs font-bold tracking-[0.1em] uppercase text-[var(--cream)]">
            Upcoming
          </span>
        </div>
        <span className="font-mono text-2xs text-[var(--muted)]">
          Next {deadlines.length} actions
        </span>
      </div>

      {/* Timeline items */}
      <div className="px-4 pb-3.5 space-y-1">
        {deadlines.map((item, index) => (
          <Link
            key={item.id}
            href={item.href}
            scroll={false}
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 -mx-1 hover:bg-[var(--action-primary)]/[0.04] transition-colors"
          >
            {/* Timeline dot + connector */}
            <div className="flex flex-col items-center shrink-0 self-stretch">
              <div
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{
                  backgroundColor: index === 0 ? "var(--action-primary)" : "var(--twilight)",
                }}
              />
              {index < deadlines.length - 1 && (
                <div className="w-px flex-1 mt-1 bg-[var(--twilight)]/60" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <span className="text-sm text-[var(--cream)] group-hover:text-[var(--action-primary)] transition-colors line-clamp-1">
                {item.title}
              </span>
              <span className="block font-mono text-2xs text-[var(--muted)] mt-0.5">
                {item.dateLabel} &middot; {item.timeLabel}
              </span>
            </div>

            <ArrowRight
              weight="bold"
              className="w-3 h-3 shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-60 transition-opacity"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

function computeDeadlines(
  lineupSections: CityPulseSectionData[],
  portalSlug: string,
): DeadlineItem[] {
  const seen = new Set<number>();
  const candidates: DeadlineItem[] = [];

  for (const section of lineupSections) {
    for (const item of section.items) {
      if (item.item_type !== "event") continue;

      const event = item.event;
      if (seen.has(event.id)) continue;
      seen.add(event.id);

      const fallbackIso = `${event.start_date}T23:59:00`;
      const eventIso = event.start_time
        ? `${event.start_date}T${event.start_time}`
        : fallbackIso;
      const parsedTimestamp = Date.parse(eventIso);
      const timestamp = Number.isNaN(parsedTimestamp)
        ? Date.parse(`${event.start_date}T00:00:00`)
        : parsedTimestamp;
      if (!Number.isFinite(timestamp)) continue;

      candidates.push({
        id: event.id,
        title: event.title,
        href: `/${portalSlug}?event=${event.id}`,
        dateLabel: formatSmartDate(event.start_date).label,
        timeLabel: formatTime(event.start_time, event.is_all_day),
        timestamp,
      });
    }
  }

  return candidates
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, 5);
}
