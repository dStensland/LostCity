"use client";

/**
 * RegularsView — Find tab for browsing recurring weekly events.
 *
 * Fetches /api/regulars, classifies events by activity type (trivia,
 * karaoke, etc.) client-side using matchActivityType(), then presents
 * them with activity chip filters + weekday toggles + date-grouped list.
 *
 * Reuses SceneEventRow and SceneChip from the shared feed module so
 * the visual language matches the dashboard Regular Hangs section.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  SCENE_ACTIVITY_TYPES,
  matchActivityType,
  buildRecurrenceLabel,
} from "@/lib/city-pulse/section-builders";
import { SceneEventRow, SceneChip, getActivityIcon, WeekdayRow, getDayKeyFromDate, buildNext7Days } from "@/components/feed/SceneEventRow";
import { triggerHaptic } from "@/lib/haptics";
import { ListBullets, Repeat } from "@phosphor-icons/react";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";
import type { FeedEventData } from "@/components/EventCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RegularsViewProps {
  portalId: string;
  portalSlug: string;
}

type RegularEvent = FeedEventData & {
  is_recurring?: boolean;
  recurrence_label?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVITY_MAP = new Map(SCENE_ACTIVITY_TYPES.map((a) => [a.id, a]));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegularsView({ portalId, portalSlug }: RegularsViewProps) {
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<RegularEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rolling 7-day window in portal-local time (America/New_York)
  const next7Days = useMemo(() => buildNext7Days(), []);

  // Local filter state — initialized from URL, synced back via replaceState
  // (avoids router.push() which triggers full Next.js navigation on every tap)
  const [activeActivities, setActiveActivities] = useState<string[]>(() => {
    const param = searchParams?.get("activity");
    return param ? param.split(",").filter(Boolean) : [];
  });

  const [activeWeekdays, setActiveWeekdays] = useState<string[]>(() => {
    const param = searchParams?.get("weekday");
    return param ? param.split(",").filter(Boolean) : [];
  });

  // Sync filter state to URL without triggering navigation
  const syncUrl = useCallback(
    (activities: string[], weekdays: string[]) => {
      const params = new URLSearchParams();
      params.set("view", "find");
      params.set("type", "regulars");
      if (activities.length > 0) params.set("activity", activities.join(","));
      if (weekdays.length > 0) params.set("weekday", weekdays.join(","));
      const url = `/${portalSlug}?${params.toString()}`;
      window.history.replaceState(window.history.state, "", url);
    },
    [portalSlug],
  );

  // Fetch all events for the week (filtering happens client-side)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    fetch(`/api/regulars?portal=${encodeURIComponent(portalSlug)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setEvents(data.events ?? []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("Failed to load regulars");
          console.error("[RegularsView] fetch error:", err);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [portalSlug]);

  // Classify events by activity type (stable — covers all events)
  const classifiedEvents = useMemo(() => {
    const map = new Map<number, string>();
    for (const event of events) {
      const actId = matchActivityType(event);
      if (actId) map.set(event.id, actId);
    }
    return map;
  }, [events]);

  // Per-day event counts for WeekdayRow — reflects active activity filter
  // so day badges show "what you'll see" not "total unfiltered"
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const event of events) {
      if (!event.start_date) continue;
      const actId = classifiedEvents.get(event.id);
      if (!actId) continue;
      if (activeActivities.length > 0 && !activeActivities.includes(actId)) continue;
      const dayKey = getDayKeyFromDate(event.start_date);
      counts[dayKey] = (counts[dayKey] || 0) + 1;
    }
    return counts;
  }, [events, classifiedEvents, activeActivities]);

  // Client-side weekday filter
  const dayFilteredEvents = useMemo(() => {
    if (activeWeekdays.length === 0) return events;
    return events.filter((event) => {
      if (!event.start_date) return false;
      return activeWeekdays.includes(getDayKeyFromDate(event.start_date));
    });
  }, [events, activeWeekdays]);

  // Activity counts from day-filtered events (chips reflect the selected day)
  const activityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const event of dayFilteredEvents) {
      const actId = classifiedEvents.get(event.id);
      if (actId) counts[actId] = (counts[actId] || 0) + 1;
    }
    return counts;
  }, [dayFilteredEvents, classifiedEvents]);

  // Visible activity chips — show if has events OR is actively selected
  // (so the user can always see and clear their active filter)
  const visibleActivities = useMemo(
    () => SCENE_ACTIVITY_TYPES.filter(
      (a) => (activityCounts[a.id] || 0) > 0 || activeActivities.includes(a.id),
    ),
    [activityCounts, activeActivities],
  );

  const allCount = useMemo(
    () => visibleActivities.reduce((sum, a) => sum + (activityCounts[a.id] || 0), 0),
    [visibleActivities, activityCounts],
  );

  // Filter events by activity chip (applied on top of day filter)
  const filteredEvents = useMemo(() => {
    return dayFilteredEvents.filter((event) => {
      const actId = classifiedEvents.get(event.id);
      if (!actId) return false; // unclassified events hidden
      if (activeActivities.length > 0 && !activeActivities.includes(actId)) return false;
      return true;
    });
  }, [dayFilteredEvents, classifiedEvents, activeActivities]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, RegularEvent[]>();
    for (const event of filteredEvents) {
      const date = event.start_date;
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(event);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEvents]);

  // Activity chip handlers
  const handleActivityTap = useCallback(
    (actId: string) => {
      triggerHaptic("selection");
      setActiveActivities((prev) => {
        let next: string[];
        if (actId === "all") {
          next = [];
        } else {
          const current = new Set(prev);
          if (current.has(actId)) {
            current.delete(actId);
          } else {
            current.add(actId);
          }
          next = Array.from(current);
        }
        syncUrl(next, activeWeekdays);
        return next;
      });
    },
    [activeWeekdays, syncUrl],
  );

  // Weekday toggle handlers
  const handleWeekdayToggle = useCallback(
    (day: string) => {
      triggerHaptic("selection");
      setActiveWeekdays((prev) => {
        // Single-select: tap to select, tap again to deselect (show all)
        const next = prev.length === 1 && prev[0] === day ? [] : [day];
        syncUrl(activeActivities, next);
        return next;
      });
    },
    [activeActivities, syncUrl],
  );

  // Convert API event to CityPulseEventItem for SceneEventRow
  const toEventItem = useCallback(
    (event: RegularEvent): CityPulseEventItem => ({
      item_type: "event",
      event: {
        ...event,
        is_recurring: true,
        recurrence_label: buildRecurrenceLabel(event),
      },
    }),
    [],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Activity chip strip */}
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1">
          <SceneChip
            label="All"
            Icon={ListBullets}
            color="var(--neon-magenta)"
            count={allCount}
            isActive={activeActivities.length === 0}
            onClick={() => handleActivityTap("all")}
          />
          {visibleActivities.map((act) => (
            <SceneChip
              key={act.id}
              label={act.label}
              Icon={getActivityIcon(act)}
              color={act.color}
              count={activityCounts[act.id] || 0}
              isActive={activeActivities.includes(act.id)}
              onClick={() => handleActivityTap(act.id)}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--void)] to-transparent" />
      </div>

      {/* Day toggle row — rolling 7-day window */}
      <WeekdayRow
        days={next7Days}
        activeDays={activeWeekdays}
        dayCounts={dayCounts}
        onToggle={handleWeekdayToggle}
      />

      {/* Loading skeleton */}
      {loading && <RegularsSkeleton />}

      {/* Error */}
      {error && !loading && (
        <div className="py-8 text-center">
          <p className="font-mono text-xs text-[var(--coral)]">{error}</p>
        </div>
      )}

      {/* Results grouped by date */}
      {!loading && !error && groupedByDate.length > 0 && (
        <div className="space-y-4">
          {groupedByDate.map(([date, dateEvents]) => (
            <div key={date}>
              {/* Day header */}
              <h3 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--soft)] mb-2">
                {formatDayHeader(date)}
                <span className="ml-2 font-normal text-[var(--muted)]">
                  {dateEvents.length}
                </span>
              </h3>
              {/* Event list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dateEvents.map((event) => {
                  const actId = classifiedEvents.get(event.id);
                  const act = actId ? ACTIVITY_MAP.get(actId) : undefined;
                  return (
                    <SceneEventRow
                      key={event.id}
                      item={toEventItem(event)}
                      activity={act}
                      ActivityIcon={act ? getActivityIcon(act) : undefined}
                      portalSlug={portalSlug}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && groupedByDate.length === 0 && (
        <div className="py-12 text-center">
          <Repeat weight="duotone" className="w-8 h-8 text-[var(--muted)] mx-auto mb-3" />
          <p className="font-mono text-sm text-[var(--muted)]">
            No recurring events found
          </p>
          <p className="font-mono text-xs text-[var(--muted)] mt-1 opacity-60">
            {activeWeekdays.length > 0 || activeActivities.length > 0
              ? "Try adjusting your filters"
              : "Check back soon"}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — mirrors chip strip + weekday row + date-grouped rows
// ---------------------------------------------------------------------------

function RegularsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Date groups skeleton (2 days × 3-4 rows each) */}
      {[4, 3].map((rowCount, gi) => (
        <div key={gi}>
          {/* Day header */}
          <div
            className="h-3.5 w-40 rounded skeleton-shimmer mb-2"
            style={{ animationDelay: `${gi * 0.15}s` }}
          />
          {/* Event rows */}
          <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)]">
            {Array.from({ length: rowCount }, (_, ri) => (
              <div
                key={ri}
                className={[
                  "flex items-center gap-3 px-3 py-2.5",
                  ri < rowCount - 1 && "border-b border-[var(--twilight)]/30",
                ].filter(Boolean).join(" ")}
              >
                {/* Icon circle */}
                <div
                  className="shrink-0 w-7 h-7 rounded-lg skeleton-shimmer"
                  style={{ animationDelay: `${gi * 0.15 + ri * 0.06}s` }}
                />
                {/* Text lines */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div
                    className="h-3.5 rounded skeleton-shimmer"
                    style={{
                      width: `${55 + (ri * 13) % 30}%`,
                      animationDelay: `${gi * 0.15 + ri * 0.06 + 0.03}s`,
                    }}
                  />
                  <div
                    className="h-2.5 rounded skeleton-shimmer"
                    style={{
                      width: `${35 + (ri * 17) % 25}%`,
                      animationDelay: `${gi * 0.15 + ri * 0.06 + 0.06}s`,
                    }}
                  />
                </div>
                {/* Recurrence badge */}
                <div
                  className="shrink-0 h-6 w-20 rounded-md skeleton-shimmer"
                  style={{ animationDelay: `${gi * 0.15 + ri * 0.06 + 0.09}s` }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDayHeader(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) {
    return `Today — ${date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`;
  }
  if (date.getTime() === tomorrow.getTime()) {
    return `Tomorrow — ${date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`;
  }
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}
