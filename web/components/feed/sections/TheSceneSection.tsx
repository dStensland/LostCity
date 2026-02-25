"use client";

/**
 * The Scene — recurring activities feed section.
 *
 * Compact layout: horizontal scrollable chip strip for activity types
 * (trivia, karaoke, open mic, DJ, etc.) with tight text-only list rows.
 * Replaces TonightsRegularsSection with a more prominent,
 * week-spanning, customizable view of recurring events.
 *
 * Follows the same chip-strip + "+" picker pattern as LineupSection.
 * Event rows are intentionally compressed — no images, just
 * accent dot + title + venue·time + recurrence badge.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import type { CityPulseSection, CityPulseEventItem } from "@/lib/city-pulse/types";
import { SCENE_ACTIVITY_TYPES, type SceneActivityType } from "@/lib/city-pulse/section-builders";
import { formatTime } from "@/lib/formats";
import { triggerHaptic } from "@/lib/haptics";
import {
  ArrowRight, Sparkle, ListBullets, Plus, X, Check, Repeat,
  // Activity type icons
  Question, MicrophoneStage, Microphone, Headphones,
  Waveform, Crown, Lightbulb, Smiley, GameController, MusicNotes,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

const ICON_LOOKUP: Record<string, ComponentType<IconProps>> = {
  Question, MicrophoneStage, Microphone, Headphones,
  Waveform, Crown, Lightbulb, Smiley, GameController, MusicNotes,
};

function getActivityIcon(act: SceneActivityType): ComponentType<IconProps> {
  return ICON_LOOKUP[act.iconName] || ListBullets;
}

/** Map from activity ID → config for O(1) lookup */
const ACTIVITY_MAP = new Map(SCENE_ACTIVITY_TYPES.map((a) => [a.id, a]));

/** Default activity types shown before user customization */
const DEFAULT_SCENE_IDS = SCENE_ACTIVITY_TYPES.map((a) => a.id);

const INITIAL_ROWS = 8;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  section: CityPulseSection;
  portalSlug: string;
  excludeEventIds?: Set<number>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TheSceneSection({ section, portalSlug, excludeEventIds }: Props) {
  const [activeChipId, setActiveChipId] = useState("all");
  const [showAllRows, setShowAllRows] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Local chip selection — which activity types are visible in the strip
  const [localActivities, setLocalActivities] = useState<string[]>(() => [...DEFAULT_SCENE_IDS]);

  // Extract metadata from section
  const activityCounts = useMemo(
    () => (section.meta?.activity_counts ?? {}) as Record<string, number>,
    [section.meta?.activity_counts],
  );
  const eventActivityMap = useMemo(
    () => (section.meta?.event_activity_map ?? {}) as Record<number, string>,
    [section.meta?.event_activity_map],
  );

  // Filter events, excluding already-shown IDs
  const allEvents = useMemo(() =>
    section.items.filter(
      (i): i is CityPulseEventItem =>
        i.item_type === "event" && !(excludeEventIds?.has(i.event.id)),
    ),
  [section.items, excludeEventIds]);

  // Visible chips: only activity types that the user has selected AND have > 0 events
  const visibleChips = useMemo(() =>
    localActivities
      .map((id) => ACTIVITY_MAP.get(id))
      .filter((a): a is SceneActivityType => !!a && (activityCounts[a.id] || 0) > 0),
  [localActivities, activityCounts]);

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

  // Filtered events based on active chip
  const filteredEvents = useMemo(() => {
    if (activeChipId === "all") return allEvents;
    return allEvents.filter((item) => eventActivityMap[item.event.id] === activeChipId);
  }, [allEvents, activeChipId, eventActivityMap]);

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

  if (allEvents.length === 0 || visibleChips.length === 0) return null;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkle weight="duotone" className="w-3.5 h-3.5 text-[var(--neon-magenta)]" />
          <h2 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--neon-magenta)]">
            {section.title || "Regular Hangs"}
          </h2>
        </div>
        <Link
          href={`/${portalSlug}?view=find&type=events&date=this_week`}
          className="text-xs flex items-center gap-1 text-[var(--neon-magenta)] transition-colors hover:opacity-80"
        >
          See all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Activity chip strip */}
      <div className="relative mb-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1 pr-8">
          <SceneChip
            label="All"
            Icon={ListBullets}
            color="var(--neon-magenta)"
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

      {/* Inline activity picker */}
      {pickerOpen && (
        <ActivityPicker
          activeIds={localActivities}
          counts={activityCounts}
          onToggle={handleToggleActivity}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Compact event list — unified container */}
      {visibleItems.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)]">
          {visibleItems.map((item, idx) => {
            const actId = eventActivityMap[item.event.id];
            const act = actId ? ACTIVITY_MAP.get(actId) : undefined;
            return (
              <SceneEventRow
                key={item.event.id}
                item={item}
                activity={act}
                ActivityIcon={act ? getActivityIcon(act) : undefined}
                portalSlug={portalSlug}
                isLast={idx === visibleItems.length - 1}
              />
            );
          })}
        </div>
      )}

      {/* Expand / collapse */}
      {!showAllRows && hasMoreRows && (
        <button
          onClick={() => setShowAllRows(true)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-mono font-medium py-2 rounded-lg transition-all hover:bg-white/[0.02] text-[var(--neon-magenta)]"
        >
          +{hiddenCount} more
          <ArrowRight className="w-3 h-3" />
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
// SceneEventRow — compact text-only row for recurring events
// ---------------------------------------------------------------------------

function SceneEventRow({
  item,
  activity,
  ActivityIcon,
  portalSlug,
  isLast,
}: {
  item: CityPulseEventItem;
  activity: SceneActivityType | undefined;
  ActivityIcon: ComponentType<IconProps> | undefined;
  portalSlug: string;
  isLast: boolean;
}) {
  const event = item.event;
  const accentColor = activity?.color ?? "var(--soft)";
  const timeStr = formatTime(event.start_time, event.is_all_day);
  const recurrenceLabel = event.recurrence_label;

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      scroll={false}
      className={[
        "flex items-center gap-3 px-3 py-2.5 transition-colors group hover:bg-white/[0.02]",
        !isLast && "border-b border-[var(--twilight)]/30",
      ].filter(Boolean).join(" ")}
    >
      {/* Activity icon accent */}
      <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}
      >
        {ActivityIcon ? (
          <ActivityIcon weight="duotone" className="w-3.5 h-3.5" style={{ color: accentColor }} />
        ) : (
          <Sparkle weight="duotone" className="w-3.5 h-3.5" style={{ color: accentColor }} />
        )}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Title */}
        <p className="text-sm font-medium text-[var(--cream)] truncate group-hover:text-white transition-colors leading-snug">
          {event.title}
        </p>
        {/* Venue · Time */}
        <p className="text-xs text-[var(--muted)] truncate mt-0.5">
          {event.venue?.name}
          {event.venue?.neighborhood && (
            <span className="opacity-50"> &middot; {event.venue.neighborhood}</span>
          )}
          <span className="opacity-50"> &middot; </span>
          {timeStr}
        </p>
      </div>

      {/* Recurrence badge */}
      {recurrenceLabel && (
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md font-mono text-2xs text-[var(--soft)] bg-white/[0.04]">
          <Repeat weight="bold" className="w-2.5 h-2.5 opacity-60" />
          {recurrenceLabel}
        </span>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// SceneChip — follows LineupSection ChipButton pattern
// ---------------------------------------------------------------------------

function SceneChip({
  label,
  Icon,
  color,
  count,
  isActive,
  onClick,
}: {
  label: string;
  Icon: ComponentType<IconProps>;
  color: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs tracking-wide transition-all active:scale-95 border",
        isActive
          ? "font-medium"
          : "border-transparent text-[var(--muted)] hover:bg-white/[0.03]",
      ].join(" ")}
      style={
        isActive
          ? {
              color,
              backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
            }
          : undefined
      }
    >
      <Icon weight={isActive ? "fill" : "bold"} className="w-4 h-4" />
      {label}
      {count > 0 && (
        <span
          className="font-mono text-2xs tabular-nums min-w-5 text-center"
          style={{ opacity: isActive ? 0.8 : 0.5 }}
        >
          {count}
        </span>
      )}
    </button>
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
