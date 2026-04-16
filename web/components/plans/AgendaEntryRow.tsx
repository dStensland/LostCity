"use client";

import { buildEventUrl } from "@/lib/entity-urls";
import { formatTime } from "./utils";

interface AgendaEntryRowProps {
  event: {
    id: number;
    title: string;
    start_time?: string;
    venue?: { name: string; slug: string };
    is_recurring?: boolean;
    series_frequency?: string;
    source?: string;
  };
  friendAvatars?: { initials: string; color: string }[];
  portalSlug: string;
}

export function AgendaEntryRow({ event, friendAvatars, portalSlug }: AgendaEntryRowProps) {
  const isSeriesEntry = event.is_recurring || event.source === "subscription";
  const frequencyLabel = event.series_frequency ?? "weekly";
  const url = buildEventUrl(event.id, portalSlug, "page");

  return (
    <a
      href={url}
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--night)] border border-[var(--twilight)] transition-all duration-200 hover:border-[var(--coral)]/20 hover:-translate-y-px"
      role="listitem"
      aria-label={`${event.title}, ${event.start_time ?? ""}, ${event.venue?.name ?? ""}`}
    >
      <div className="w-[3px] rounded-sm self-stretch min-h-[32px] bg-[var(--coral)]/70 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--cream)] truncate">
          {event.title}
        </div>
        <div className="text-xs text-[var(--muted)] mt-0.5">
          {event.start_time && formatTime(event.start_time)}
          {event.venue && ` · ${event.venue.name}`}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isSeriesEntry && (
          <span className="text-2xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--coral)]/10 text-[var(--coral)]/80">
            {frequencyLabel}
          </span>
        )}
        {friendAvatars && friendAvatars.length > 0 && (
          <div className="flex -space-x-1.5">
            {friendAvatars.slice(0, 3).map((a, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full border-2 border-[var(--night)] flex items-center justify-center text-2xs font-semibold text-[var(--cream)]/80"
                style={{ backgroundColor: a.color }}
              >
                {a.initials}
              </div>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}

