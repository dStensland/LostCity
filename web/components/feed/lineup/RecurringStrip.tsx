"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";
import { SCENE_ACTIVITY_TYPES, matchActivityType } from "@/lib/scene-event-routing";

const INITIAL_SHOW = 5;

const ACTIVITY_COLORS: Record<string, string> = {};
for (const a of SCENE_ACTIVITY_TYPES) {
  ACTIVITY_COLORS[a.id] = a.color;
}

/** Nightlife-oriented activity types float to top of the strip. */
const NIGHTLIFE_PRIORITY = new Set([
  "trivia", "karaoke", "comedy", "dj", "drag", "poker",
  "open_mic", "happy_hour", "live_music", "jazz_blues",
  "bingo", "spoken_word", "vinyl_night",
]);

interface RecurringStripProps {
  events: CityPulseEventItem[];
  portalSlug: string;
  /** Active tab — controls the label ("tonight" vs "this week"). */
  activeTab?: string;
}

export function RecurringStrip({ events, portalSlug, activeTab }: RecurringStripProps) {
  const [expanded, setExpanded] = useState(false);

  // Sort: nightlife scene events first, then daytime/recreation, then by start_time
  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const aType = a.event.activity_type
        ?? matchActivityType(a.event as Parameters<typeof matchActivityType>[0]);
      const bType = b.event.activity_type
        ?? matchActivityType(b.event as Parameters<typeof matchActivityType>[0]);
      const aNight = NIGHTLIFE_PRIORITY.has(aType ?? "") ? 0 : 1;
      const bNight = NIGHTLIFE_PRIORITY.has(bType ?? "") ? 0 : 1;
      if (aNight !== bNight) return aNight - bNight;
      // Within same priority, sort by start_time (evening first)
      const aTime = a.event.start_time ?? "00:00";
      const bTime = b.event.start_time ?? "00:00";
      return bTime.localeCompare(aTime);
    });
  }, [events]);

  if (sorted.length === 0) return null;

  const visible = expanded ? sorted : sorted.slice(0, INITIAL_SHOW);
  const remaining = sorted.length - INITIAL_SHOW;

  const label = activeTab === "this_week" ? "Recurring this week" : "Recurring tonight";

  return (
    <div className="mt-4 pt-3 border-t border-[var(--twilight)]/30">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--vibe)]">
          {label}
        </span>
        <Link
          href={`/${portalSlug}/regulars`}
          className="flex items-center gap-0.5 text-2xs font-mono text-[var(--vibe)] opacity-70 hover:opacity-100 transition-opacity"
        >
          All regulars
          <ArrowRight weight="bold" className="w-2.5 h-2.5" />
        </Link>
      </div>

      <div className="space-y-0.5">
        {visible.map((item) => {
          const activityId = item.event.activity_type
            ?? matchActivityType(item.event as Parameters<typeof matchActivityType>[0]);
          const color = ACTIVITY_COLORS[activityId ?? ""] ?? "var(--vibe)";
          const venue = item.event.venue;
          const recurrenceLabel = item.event.recurrence_label;

          return (
            <Link
              key={item.event.id}
              href={`/${portalSlug}?event=${item.event.id}`}
              className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-[var(--dusk)]/40 transition-colors group"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="flex-1 min-w-0 text-sm text-[var(--cream)] truncate group-hover:text-[var(--soft)] transition-colors">
                {item.event.title}
              </span>
              <span className="flex items-center gap-1 text-xs text-[var(--muted)] flex-shrink-0">
                {venue?.name && (
                  <span className="truncate max-w-[120px]">{venue.name}</span>
                )}
                {venue?.name && recurrenceLabel && <Dot />}
                {recurrenceLabel && (
                  <span className="font-mono text-2xs">{recurrenceLabel}</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      {remaining > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs font-mono text-[var(--vibe)] hover:opacity-80 transition-opacity"
        >
          {expanded ? "Show less" : `+${remaining} more regulars`}
        </button>
      )}
    </div>
  );
}
