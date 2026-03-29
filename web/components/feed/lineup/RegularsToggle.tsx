"use client";

/**
 * RegularsToggle — filter chip + scene mode UI for the Lineup's Regulars feature.
 *
 * Toggle OFF: single muted chip in the filter row.
 * Toggle ON (scene mode):
 *   - Activity chips: horizontal scroll row (Trivia, Karaoke, etc.)
 *   - Day pills: 7 circular Mon–Sun buttons, only shown on "this_week" / "coming_up" tabs
 *
 * State rules:
 *   - Day pill selection resets when activeTab changes
 *   - Activity chip selection persists across tab switches
 */

import { memo, useEffect, useMemo, useState } from "react";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";
import { SCENE_ACTIVITY_TYPES, matchActivityType } from "@/lib/scene-event-routing";

// ---------------------------------------------------------------------------
// Day constants (ISO 1=Mon, 7=Sun)
// ---------------------------------------------------------------------------

const DAY_ABBRS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// Map ISO day number to lowercase day name matching DB series.day_of_week
const ISO_TO_DAY_NAME: Record<number, string> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
  7: "sunday",
};

function getTodayIsoDay(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RegularsToggleProps {
  active: boolean;
  onToggle: (active: boolean) => void;
  activeTab: "today" | "this_week" | "coming_up";
  regularsEvents: CityPulseEventItem[];
  onFilteredEvents: (events: CityPulseEventItem[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RegularsToggle = memo(function RegularsToggle({
  active,
  onToggle,
  activeTab,
  regularsEvents,
  onFilteredEvents,
}: RegularsToggleProps) {
  const [activeActivity, setActiveActivity] = useState<string>("all");
  // null = no day filter active
  const [activeDay, setActiveDay] = useState<number | null>(null);

  const todayIsoDay = useMemo(() => getTodayIsoDay(), []);

  // Reset day pill on tab switch, per spec
  useEffect(() => {
    setActiveDay(null);
  }, [activeTab]);

  // Show day pills only for multi-day tabs
  const showDayPills = activeTab === "this_week" || activeTab === "coming_up";

  // Compute activity type for each event
  const enrichedEvents = useMemo(() => {
    return regularsEvents.map((item) => {
      const activityId =
        item.event.activity_type ??
        matchActivityType(item.event as Parameters<typeof matchActivityType>[0]);
      return { item, activityId };
    });
  }, [regularsEvents]);

  // Activity counts across all enriched events (unfiltered by day)
  const activityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const { activityId } of enrichedEvents) {
      if (activityId) {
        counts[activityId] = (counts[activityId] ?? 0) + 1;
      }
    }
    return counts;
  }, [enrichedEvents]);

  // Available activity types with at least 1 event, sorted by count, capped at 8
  const availableActivities = useMemo(() => {
    return SCENE_ACTIVITY_TYPES.filter((a) => (activityCounts[a.id] ?? 0) > 0)
      .sort((a, b) => (activityCounts[b.id] ?? 0) - (activityCounts[a.id] ?? 0))
      .slice(0, 8);
  }, [activityCounts]);

  // Day counts after activity filter
  const dayCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const { item, activityId } of enrichedEvents) {
      if (activeActivity !== "all" && activityId !== activeActivity) continue;
      // Use series.day_of_week name → ISO number
      const seriesDayName = item.event.series?.day_of_week;
      if (seriesDayName) {
        const isoDay = Object.entries(ISO_TO_DAY_NAME).find(
          ([, name]) => name === String(seriesDayName).toLowerCase()
        )?.[0];
        if (isoDay) {
          const num = Number(isoDay);
          counts[num] = (counts[num] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [enrichedEvents, activeActivity]);

  // Apply filters and emit to parent
  const filteredEvents = useMemo(() => {
    const result = enrichedEvents
      .filter(({ item, activityId }) => {
        if (activeActivity !== "all" && activityId !== activeActivity) return false;
        if (activeDay !== null) {
          // Compare via series.day_of_week string
          const seriesDayName = item.event.series?.day_of_week;
          const expectedDayName = ISO_TO_DAY_NAME[activeDay];
          if (String(seriesDayName).toLowerCase() !== expectedDayName) return false;
        }
        return true;
      })
      .map(({ item }) => item);
    return result;
  }, [enrichedEvents, activeActivity, activeDay]);

  // Notify parent whenever filtered set changes
  useEffect(() => {
    if (active) {
      onFilteredEvents(filteredEvents);
    }
  }, [active, filteredEvents, onFilteredEvents]);

  // Notify parent with full set when toggled off
  useEffect(() => {
    if (!active) {
      onFilteredEvents(regularsEvents);
    }
  }, [active, regularsEvents, onFilteredEvents]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      {/* Toggle chip */}
      <button
        onClick={() => onToggle(!active)}
        className={[
          "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full",
          "font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
          active
            ? "bg-[var(--vibe)]/15 text-[var(--vibe)] border border-[var(--vibe)]/30"
            : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
        ].join(" ")}
        aria-pressed={active}
        aria-label="Toggle Regulars filter"
      >
        <span
          className={[
            "w-1.5 h-1.5 rounded-full transition-colors",
            active ? "bg-[var(--vibe)]" : "bg-[var(--muted)]",
          ].join(" ")}
        />
        Regulars
      </button>

      {/* Scene mode — only shown when toggle is ON */}
      {active && (
        <div className="mt-2 space-y-2">
          {/* Activity chips */}
          {availableActivities.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {/* "All" chip */}
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

              {/* Per-activity chips */}
              {availableActivities.map((activity) => {
                const count = activityCounts[activity.id] ?? 0;
                const isActive = activeActivity === activity.id;
                return (
                  <button
                    key={activity.id}
                    onClick={() =>
                      setActiveActivity(isActive ? "all" : activity.id)
                    }
                    className={[
                      "shrink-0 px-2.5 py-1 rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap border",
                      isActive ? "" : "border-transparent text-[var(--muted)] hover:text-[var(--soft)] hover:border-[var(--twilight)]/40",
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

          {/* Day pills — only on this_week / coming_up tabs */}
          {showDayPills && (
            <div className="flex items-center gap-1">
              {DAY_ABBRS.map((abbr, i) => {
                const isoDay = i + 1;
                const isActive = activeDay === isoDay;
                const isToday = isoDay === todayIsoDay;
                const count = dayCounts[isoDay] ?? 0;
                return (
                  <button
                    key={isoDay}
                    onClick={() => setActiveDay(isActive ? null : isoDay)}
                    title={abbr}
                    aria-label={`Filter by ${abbr}${count > 0 ? `, ${count} events` : ""}`}
                    className={[
                      "flex-1 flex flex-col items-center justify-center gap-0.5",
                      "w-9 h-9 rounded-full font-mono text-2xs font-medium transition-all",
                      isActive
                        ? "bg-[var(--vibe)]/15 text-[var(--vibe)]"
                        : isToday
                          ? "text-[var(--cream)] hover:bg-[var(--twilight)]/40"
                          : count > 0
                            ? "text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/40"
                            : "text-[var(--muted)] opacity-50",
                    ].join(" ")}
                    disabled={count === 0 && !isActive}
                  >
                    <span className="font-bold leading-none">{abbr}</span>
                    {count > 0 && (
                      <span className="opacity-60 leading-none text-[9px]">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export type { RegularsToggleProps };
