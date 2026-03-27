"use client";

/**
 * RecurringStrip — compact recurring events inside the Lineup.
 *
 * Includes activity type chips (Trivia, Karaoke, Comedy...),
 * day-of-week filter, and time-aware filtering (hides events already over).
 * "All regulars →" links to the full Regulars page for deeper discovery.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";
import { SCENE_ACTIVITY_TYPES, matchActivityType } from "@/lib/scene-event-routing";

const INITIAL_SHOW = 6;

const ACTIVITY_COLORS: Record<string, string> = {};
const ACTIVITY_LABELS: Record<string, string> = {};
for (const a of SCENE_ACTIVITY_TYPES) {
  ACTIVITY_COLORS[a.id] = a.color;
  ACTIVITY_LABELS[a.id] = a.label;
}

// ISO day names for display
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getCurrentHourMinute(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function getIsoDay(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const jsDay = d.getDay();
  return jsDay === 0 ? 7 : jsDay; // ISO: 1=Mon, 7=Sun
}

function getTodayIsoDay(): number {
  const d = new Date();
  const jsDay = d.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

interface RecurringStripProps {
  events: CityPulseEventItem[];
  portalSlug: string;
  activeTab?: string;
}

export function RecurringStrip({ events, portalSlug, activeTab }: RecurringStripProps) {
  const [activeActivity, setActiveActivity] = useState<string>("all");
  const [activeDay, setActiveDay] = useState<number | null>(null); // null = today (default)
  const [expanded, setExpanded] = useState(false);

  const todayIsoDay = useMemo(() => getTodayIsoDay(), []);
  const currentTime = useMemo(() => getCurrentHourMinute(), []);

  // Compute activity type for each event + filter out past events for today
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const enrichedEvents = useMemo(() => {
    return events.map((item) => {
      const activityId = item.event.activity_type
        ?? matchActivityType(item.event as Parameters<typeof matchActivityType>[0]);
      return { item, activityId };
    }).filter(({ item }) => {
      // Only hide events that are TODAY and already over
      if (activeDay === null && activeTab !== "this_week") {
        const isToday = item.event.start_date === todayStr;
        const startTime = item.event.start_time;
        if (isToday && startTime && startTime < currentTime) return false;
      }
      return true;
    });
  }, [events, activeDay, activeTab, currentTime, todayStr]);

  // Activity type counts (from all events, not filtered by day)
  const activityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const { activityId } of enrichedEvents) {
      if (activityId) {
        counts[activityId] = (counts[activityId] || 0) + 1;
      }
    }
    return counts;
  }, [enrichedEvents]);

  // Which activity types are available?
  const availableActivities = useMemo(() => {
    return SCENE_ACTIVITY_TYPES
      .filter((a) => (activityCounts[a.id] ?? 0) > 0)
      .sort((a, b) => (activityCounts[b.id] ?? 0) - (activityCounts[a.id] ?? 0))
      .slice(0, 8); // Cap at 8 chips to avoid overflow
  }, [activityCounts]);

  // Day counts (from all events after activity filter)
  const dayCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const { item, activityId } of enrichedEvents) {
      if (activeActivity !== "all" && activityId !== activeActivity) continue;
      const day = getIsoDay(item.event.start_date);
      counts[day] = (counts[day] || 0) + 1;
    }
    return counts;
  }, [enrichedEvents, activeActivity]);

  // Apply filters
  const filtered = useMemo(() => {
    return enrichedEvents.filter(({ item, activityId }) => {
      if (activeActivity !== "all" && activityId !== activeActivity) return false;
      if (activeDay !== null) {
        const day = getIsoDay(item.event.start_date);
        if (day !== activeDay) return false;
      }
      return true;
    });
  }, [enrichedEvents, activeActivity, activeDay]);

  const visible = expanded ? filtered : filtered.slice(0, INITIAL_SHOW);
  const remaining = filtered.length - INITIAL_SHOW;

  if (events.length === 0) return null;

  // Dynamic label
  const dayName = activeDay !== null
    ? DAY_LABELS[activeDay - 1]
    : (activeTab === "this_week" ? "this week" : "tonight");
  const label = `Regulars ${activeDay !== null ? dayName : (activeTab === "this_week" ? "this week" : "tonight")}`;

  return (
    <div className="mt-4 pt-3 border-t border-[var(--twilight)]/30">
      {/* Header */}
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

      {/* Activity type chips */}
      {availableActivities.length > 1 && (
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-none -mx-1 px-1">
          <button
            onClick={() => setActiveActivity("all")}
            className={[
              "shrink-0 px-2.5 py-1 rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
              activeActivity === "all"
                ? "bg-[var(--vibe)]/15 text-[var(--vibe)] border border-[var(--vibe)]/30"
                : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
            ].join(" ")}
          >
            All {enrichedEvents.length}
          </button>
          {availableActivities.map((activity) => {
            const count = activityCounts[activity.id] ?? 0;
            const isActive = activeActivity === activity.id;
            return (
              <button
                key={activity.id}
                onClick={() => setActiveActivity(isActive ? "all" : activity.id)}
                className={[
                  "shrink-0 px-2.5 py-1 rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
                  isActive
                    ? "border"
                    : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
                ].join(" ")}
                style={
                  isActive
                    ? {
                        color: activity.color,
                        backgroundColor: `color-mix(in srgb, ${activity.color} 12%, transparent)`,
                        borderColor: `color-mix(in srgb, ${activity.color} 30%, transparent)`,
                      }
                    : undefined
                }
              >
                {activity.label} {count}
              </button>
            );
          })}
        </div>
      )}

      {/* Day-of-week filter */}
      <div className="flex items-center gap-1 mb-2">
        {DAY_LABELS.map((dayLabel, i) => {
          const isoDay = i + 1;
          const isActive = activeDay === isoDay;
          const isToday = isoDay === todayIsoDay;
          const count = dayCounts[isoDay] ?? 0;
          return (
            <button
              key={isoDay}
              onClick={() => setActiveDay(isActive ? null : isoDay)}
              className={[
                "flex-1 py-1.5 flex flex-col items-center gap-0.5 font-mono text-2xs font-medium transition-all",
                isActive
                  ? "bg-[var(--vibe)]/15 text-[var(--vibe)]"
                  : isToday
                    ? "text-[var(--cream)]"
                    : "text-[var(--muted)] hover:text-[var(--soft)]",
              ].join(" ")}
            >
              <span className="font-bold">{dayLabel}</span>
              {count > 0 && <span className="opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Event rows */}
      {filtered.length === 0 ? (
        <p className="py-3 text-center text-xs text-[var(--muted)]">
          No regulars {activeDay !== null ? `on ${DAY_LABELS[activeDay - 1]}` : "matching"}
        </p>
      ) : (
        <div className="space-y-0.5">
          {visible.map(({ item, activityId }) => {
            const color = ACTIVITY_COLORS[activityId ?? ""] ?? "var(--vibe)";
            const venue = item.event.venue;
            const recurrenceLabel = item.event.recurrence_label;
            const startTime = item.event.start_time;
            const timeStr = startTime
              ? new Date(`2000-01-01T${startTime}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
              : null;

            return (
              <Link
                key={item.event.id}
                href={`/${portalSlug}?event=${item.event.id}`}
                className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 hover:bg-[var(--dusk)]/40 transition-colors group"
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
                    <span className="truncate max-w-[100px]">{venue.name}</span>
                  )}
                  {venue?.name && timeStr && <Dot />}
                  {timeStr && (
                    <span className="font-mono text-2xs">{timeStr}</span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Show more */}
      {remaining > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs font-mono text-[var(--vibe)] hover:opacity-80 transition-opacity"
        >
          {expanded ? "Show less" : `+${remaining} more`}
        </button>
      )}
    </div>
  );
}
