"use client";

/**
 * The Scene — recurring activities feed section.
 *
 * Self-fetching: loads data from /api/regulars instead of receiving it
 * as a prop from the monolithic city-pulse API. This removes ~750KB
 * from the initial feed response.
 *
 * Compact layout: horizontal scrollable chip strip for activity types
 * (trivia, karaoke, open mic, DJ, etc.) with tight text-only list rows.
 * Event rows are intentionally compressed — no images, just
 * accent dot + title + venue·time + recurrence badge.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";
import {
  SCENE_ACTIVITY_TYPES,
  type SceneActivityType,
  matchActivityType,
  buildRecurrenceLabel,
} from "@/lib/city-pulse/section-builders";
import type { FeedEventData } from "@/components/EventCard";
import { triggerHaptic } from "@/lib/haptics";
import { SceneEventRow, SceneChip, getActivityIcon, WeekdayRow, getDayKeyFromDate, getTodayKey, buildNext7Days } from "@/components/feed/SceneEventRow";
import {
  ArrowRight, MicrophoneStage, ListBullets, Plus, X, Check, WarningCircle,
} from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";

/** Map from activity ID → config for O(1) lookup */
const ACTIVITY_MAP = new Map(SCENE_ACTIVITY_TYPES.map((a) => [a.id, a]));

/** Default activity types shown before user customization — crowd favorites */
const DEFAULT_SCENE_IDS = ["trivia", "karaoke", "comedy", "nerd_stuff", "happy_hour"];

const INITIAL_ROWS = 8;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  portalSlug: string;
}

// ---------------------------------------------------------------------------
// Data fetching & transformation
// ---------------------------------------------------------------------------

/** Transform raw regulars API events into the format TheSceneSection needs */
function processRegularsData(rawEvents: FeedEventData[]) {
  // Match each event to an activity type
  const eventActivityMap: Record<number, string> = {};
  for (const event of rawEvents) {
    const actId = matchActivityType(event);
    if (actId) {
      eventActivityMap[event.id] = actId;
    }
  }

  // Only keep events that matched an activity type
  const matched = rawEvents.filter((e) => eventActivityMap[e.id]);

  // Wrap as CityPulseEventItem with recurrence labels
  const items: CityPulseEventItem[] = matched.map((event) => ({
    item_type: "event" as const,
    event: {
      ...event,
      is_recurring: true,
      recurrence_label: buildRecurrenceLabel(event),
    },
  }));

  return { items, eventActivityMap };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TheSceneSection({ portalSlug }: Props) {
  const [activeChipId, setActiveChipId] = useState("all");
  const [showAllRows, setShowAllRows] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Rolling 7-day window in portal-local time (America/New_York)
  const next7Days = useMemo(() => buildNext7Days(), []);

  // Default to the first day in the window (today or earliest event date)
  const [activeDays, setActiveDays] = useState<string[]>(() => {
    const firstKey = next7Days[0]?.key ?? getTodayKey();
    return [firstKey];
  });

  // Local chip selection — which activity types are visible in the strip
  const [localActivities, setLocalActivities] = useState<string[]>(() => [...DEFAULT_SCENE_IDS]);

  // Self-fetch from /api/regulars
  const { data: regularsData, isLoading, isError } = useQuery<{ events: FeedEventData[] }>({
    queryKey: ["regulars", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(`/api/regulars?portal=${portalSlug}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Regulars fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 3 * 60 * 1000, // 3 min — matches regulars API cache TTL
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Process raw events into activity-mapped items
  const { items: allItems, eventActivityMap } = useMemo(() => {
    if (!regularsData?.events) return { items: [] as CityPulseEventItem[], eventActivityMap: {} as Record<number, string> };
    return processRegularsData(regularsData.events);
  }, [regularsData]);

  const allEvents = useMemo(() =>
    allItems.filter(
      (i): i is CityPulseEventItem => i.item_type === "event",
    ),
  [allItems]);

  // Activity counts from ALL events — chips always show full-week totals
  const activityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allEvents) {
      const actId = eventActivityMap[item.event.id];
      if (actId) {
        counts[actId] = (counts[actId] || 0) + 1;
      }
    }
    return counts;
  }, [allEvents, eventActivityMap]);

  // Visible chips: only activity types that the user has selected AND have > 0 events
  const visibleChips = useMemo(() =>
    localActivities
      .map((id) => ACTIVITY_MAP.get(id))
      .filter((a): a is SceneActivityType => !!a && (activityCounts[a.id] || 0) > 0),
  [localActivities, activityCounts]);

  // Set of visible activity IDs — "All" chip only shows events from these
  const visibleActivityIds = useMemo(() => new Set(visibleChips.map((a) => a.id)), [visibleChips]);

  // Chip counts: "all" = sum of all visible activity counts
  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let allTotal = 0;
    for (const act of visibleChips) {
      const c = activityCounts[act.id] || 0;
      counts[act.id] = c;
      allTotal += c;
    }
    counts["all"] = allTotal;
    return counts;
  }, [visibleChips, activityCounts]);

  // Per-day event counts for WeekdayRow — scoped to active chip + visible activities
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allEvents) {
      if (!item.event.start_date) continue;
      const actId = eventActivityMap[item.event.id];
      if (!actId) continue;
      if (activeChipId === "all") {
        if (!visibleActivityIds.has(actId)) continue;
      } else if (actId !== activeChipId) {
        continue;
      }
      const dayKey = getDayKeyFromDate(item.event.start_date);
      counts[dayKey] = (counts[dayKey] || 0) + 1;
    }
    return counts;
  }, [allEvents, eventActivityMap, activeChipId, visibleActivityIds]);

  // Events filtered by selected weekday(s)
  const dayFilteredEvents = useMemo(() => {
    if (activeDays.length === 0) return allEvents;
    return allEvents.filter((item) => {
      if (!item.event.start_date) return false;
      return activeDays.includes(getDayKeyFromDate(item.event.start_date));
    });
  }, [allEvents, activeDays]);

  // Filtered events: "All" scoped to visible activity types only
  const filteredEvents = useMemo(() => {
    if (activeChipId === "all") {
      return dayFilteredEvents.filter((item) => {
        const actId = eventActivityMap[item.event.id];
        return actId && visibleActivityIds.has(actId);
      });
    }
    return dayFilteredEvents.filter((item) => eventActivityMap[item.event.id] === activeChipId);
  }, [dayFilteredEvents, activeChipId, eventActivityMap, visibleActivityIds]);

  const visibleItems = showAllRows
    ? filteredEvents
    : filteredEvents.slice(0, INITIAL_ROWS);

  const hasMoreRows = filteredEvents.length > INITIAL_ROWS;
  const hiddenCount = filteredEvents.length - INITIAL_ROWS;

  const handleChipTap = useCallback((chipId: string) => {
    triggerHaptic("selection");
    setActiveChipId(chipId);
    setShowAllRows(false);
  }, []);

  const handleDayToggle = useCallback((day: string) => {
    triggerHaptic("selection");
    setActiveDays((prev) => {
      // Single-select: tap to select, tap again to deselect (show all)
      if (prev.length === 1 && prev[0] === day) return [];
      return [day];
    });
    setShowAllRows(false);
  }, []);

  const handleToggleActivity = useCallback((actId: string) => {
    setLocalActivities((prev) => {
      if (prev.includes(actId)) {
        const remaining = prev.filter((id) => id !== actId);
        if (remaining.length === 0) return prev;
        return remaining;
      }
      return [...prev, actId];
    });
  }, []);

  // Show skeleton while loading — prevents layout pop
  if (isLoading) {
    return (
      <section>
        <div className="h-5 w-36 rounded skeleton-shimmer mb-3" style={{ opacity: 0.2 }} />
        <div className="flex gap-2 mb-4 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 rounded-full skeleton-shimmer flex-shrink-0" style={{ width: 80, opacity: 0.15, animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="w-2 h-2 rounded-full skeleton-shimmer" style={{ opacity: 0.2 }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 rounded skeleton-shimmer" style={{ width: `${65 - i * 8}%`, opacity: 0.18, animationDelay: `${i * 0.06}s` }} />
                <div className="h-2.5 rounded skeleton-shimmer" style={{ width: `${45 - i * 5}%`, opacity: 0.12 }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Error state — subtle, doesn't break feed
  if (isError) {
    return (
      <section>
        <FeedSectionHeader
          title="Regular Hangs"
          priority="secondary"
          accentColor="var(--vibe)"
          icon={<MicrophoneStage weight="duotone" className="w-5 h-5" />}
        />
        <div className="flex items-center justify-center gap-2 py-8 text-[var(--muted)]">
          <WarningCircle weight="duotone" className="w-4 h-4" />
          <span className="font-mono text-xs">Couldn&apos;t load regular hangs</span>
        </div>
      </section>
    );
  }

  // Hide entire section only if there are zero events in the full week
  if (allEvents.length === 0) return null;

  return (
    <section className="feed-section-enter">
      {/* Section header */}
      <FeedSectionHeader
        title="Regular Hangs"
        priority="secondary"
        accentColor="var(--vibe)"
        icon={<MicrophoneStage weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=happening&content=regulars${activeChipId !== "all" ? `&activity=${activeChipId}` : ""}${activeDays.length > 0 ? `&weekday=${activeDays.join(",")}` : ""}`}
      />

      {/* Activity chip strip */}
      <div className="relative mb-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1 pr-8">
          <SceneChip
            label="All"
            Icon={ListBullets}
            color="var(--vibe)"
            count={chipCounts["all"] || 0}
            isActive={activeChipId === "all"}
            onClick={() => handleChipTap("all")}
          />
          {visibleChips.map((act) => (
            <SceneChip
              key={act.id}
              label={act.label}
              Icon={getActivityIcon(act)}
              color={act.color}
              count={chipCounts[act.id] || 0}
              isActive={activeChipId === act.id}
              onClick={() => handleChipTap(act.id)}
            />
          ))}
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className={[
              "shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full transition-all active:scale-95 border",
              pickerOpen
                ? "bg-white/10 border-white/15 text-[var(--cream)]"
                : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)] hover:border-[var(--soft)]/30",
            ].join(" ")}
            aria-label="Customize activity types"
          >
            {pickerOpen ? <X weight="bold" className="w-3.5 h-3.5" /> : <Plus weight="bold" className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[var(--void)] to-transparent" />
      </div>

      {/* Day toggle row — rolling 7-day window starting from today */}
      <div className="mb-4">
        <WeekdayRow
          days={next7Days}
          activeDays={activeDays}
          dayCounts={dayCounts}
          onToggle={handleDayToggle}
        />
      </div>

      {/* Inline activity picker */}
      {pickerOpen && (
        <ActivityPicker
          activeIds={localActivities}
          counts={activityCounts}
          onToggle={handleToggleActivity}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Compact event grid */}
      {visibleItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {visibleItems.map((item) => {
            const actId = eventActivityMap[item.event.id];
            const act = actId ? ACTIVITY_MAP.get(actId) : undefined;
            return (
              <SceneEventRow
                key={item.event.id}
                item={item}
                activity={act}
                ActivityIcon={act ? getActivityIcon(act) : undefined}
                portalSlug={portalSlug}
              />
            );
          })}
        </div>
      )}

      {/* Expand / collapse */}
      {!showAllRows && hasMoreRows && (
        <button
          onClick={() => setShowAllRows(true)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-sm font-mono font-medium py-2.5 rounded-lg transition-all hover:bg-[var(--vibe)]/5 text-[var(--vibe)]"
        >
          Show {hiddenCount} more
          <ArrowRight weight="bold" className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Empty state */}
      {filteredEvents.length === 0 && (
        <div className="py-6 text-center">
          <p className="font-mono text-xs text-[var(--muted)]">
            No events matching this filter
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline activity picker
// ---------------------------------------------------------------------------

function ActivityPicker({
  activeIds,
  counts,
  onToggle,
  onClose,
}: {
  activeIds: string[];
  counts: Record<string, number>;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const activeSet = new Set(activeIds);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="mb-4 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--twilight)]/50"
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="font-mono text-2xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          Customize Activities
        </span>
        <button
          onClick={onClose}
          className="p-0.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          <X weight="bold" className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SCENE_ACTIVITY_TYPES.map((act) => {
          const isOn = activeSet.has(act.id);
          const ActIcon = getActivityIcon(act);
          const count = counts[act.id] || 0;
          return (
            <button
              key={act.id}
              onClick={() => onToggle(act.id)}
              className={[
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-2xs tracking-wide transition-all active:scale-95 border",
                isOn
                  ? "bg-white/[0.08] border-white/15 text-[var(--cream)]"
                  : "border-transparent text-[var(--muted)] hover:bg-white/[0.03]",
              ].join(" ")}
            >
              {isOn ? (
                <Check weight="bold" className="w-3 h-3" style={{ color: act.color }} />
              ) : (
                <ActIcon weight="bold" className="w-3 h-3" />
              )}
              {act.label}
              {count > 0 && (
                <span className="text-2xs tabular-nums min-w-4 text-center opacity-50">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
