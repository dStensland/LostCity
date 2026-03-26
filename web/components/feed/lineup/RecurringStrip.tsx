"use client";

import { useState } from "react";
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

interface RecurringStripProps {
  events: CityPulseEventItem[];
  portalSlug: string;
}

export function RecurringStrip({ events, portalSlug }: RecurringStripProps) {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) return null;

  const visible = expanded ? events : events.slice(0, INITIAL_SHOW);
  const remaining = events.length - INITIAL_SHOW;

  return (
    <div className="mt-4 pt-3 border-t border-[var(--twilight)]/30">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--vibe)]">
          Recurring tonight
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
          // Use pre-computed activity_type if available, otherwise compute from event data
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
