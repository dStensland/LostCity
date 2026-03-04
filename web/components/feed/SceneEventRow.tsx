"use client";

/**
 * Shared components for Regular Hangs / The Scene.
 *
 * Extracted from TheSceneSection so both the feed section and
 * the RegularsView (Find tab) can reuse them without duplication.
 */

import Link from "next/link";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  Repeat, Sparkle, ListBullets,
  // Activity type icons
  Question, MicrophoneStage, Microphone, Headphones,
  Waveform, Crown, Lightbulb, Smiley, GameController, MusicNotes,
  ForkKnife, PersonSimpleRun, NumberCircleNine, Coffee,
  Club, CowboyHat, Globe, Television, Wine, Disc,
  Sword, BowlingBall, BeerStein, Barbell, Bicycle, BookOpen, Leaf, VinylRecord,
} from "@phosphor-icons/react";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";
import type { SceneActivityType } from "@/lib/city-pulse/section-builders";
import { formatTime } from "@/lib/formats";
import RSVPButton from "@/components/RSVPButton";

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

export const ICON_LOOKUP: Record<string, ComponentType<IconProps>> = {
  Question, MicrophoneStage, Microphone, Headphones,
  Waveform, Crown, Lightbulb, Smiley, GameController, MusicNotes,
  ForkKnife, PersonSimpleRun, NumberCircleNine, Coffee,
  Club, CowboyHat, Globe, Television, Wine, Disc,
  Sword, BowlingBall, BeerStein, Barbell, Bicycle, BookOpen, Leaf, VinylRecord,
};

export function getActivityIcon(act: SceneActivityType): ComponentType<IconProps> {
  return ICON_LOOKUP[act.iconName] || ListBullets;
}

// ---------------------------------------------------------------------------
// SceneEventRow — compact text-only row for recurring events
// ---------------------------------------------------------------------------

export function SceneEventRow({
  item,
  activity,
  ActivityIcon,
  portalSlug,
}: {
  item: CityPulseEventItem;
  activity: SceneActivityType | undefined;
  ActivityIcon: ComponentType<IconProps> | undefined;
  portalSlug: string;
  isLast?: boolean;
}) {
  const event = item.event;
  const accentColor = activity?.color ?? "var(--soft)";
  const timeStr = formatTime(event.start_time, event.is_all_day);
  const dayStr = event.start_date
    ? new Date(event.start_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })
    : null;

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      scroll={false}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[var(--twilight)]/50 bg-[var(--night)] transition-all group hover:border-[var(--twilight)]/70 hover:bg-white/[0.02]"
    >
      {/* Activity icon box */}
      {ActivityIcon ? (
        <span
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)` }}
        >
          <ActivityIcon weight="duotone" className="w-3.5 h-3.5" style={{ color: accentColor }} />
        </span>
      ) : (
        <span
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--twilight)]/40"
        >
          <Repeat weight="duotone" className="w-3.5 h-3.5 text-[var(--muted)]" />
        </span>
      )}

      {/* Title + venue — single tight block */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--cream)] truncate group-hover:text-white transition-colors leading-tight">
          {event.title}
        </p>
        <p className="text-xs text-[var(--muted)] truncate leading-tight">
          {event.venue?.name}
          <span className="opacity-50"> &middot; </span>
          {dayStr && <>{dayStr} </>}
          {timeStr}
        </p>
      </div>

      {/* RSVP — compact small */}
      <span className="shrink-0 [&_button]:w-7 [&_button]:h-7 [&_svg]:w-3.5 [&_svg]:h-3.5">
        <RSVPButton eventId={event.id} variant="compact" size="sm" />
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// SceneChip — follows LineupSection ChipButton pattern
// ---------------------------------------------------------------------------

export function SceneChip({
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
          style={{ opacity: isActive ? 0.85 : 0.65 }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Shared weekday helpers — rolling 7-day window in portal-local time
// ---------------------------------------------------------------------------

/** Portal timezone — all "today" logic uses this, not the browser's TZ */
const PORTAL_TZ = "America/New_York";

const SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type DayEntry = { key: string; dayName: string; dateLabel: string; isToday: boolean };

/** Get date parts in the portal timezone */
function portalDateParts(d: Date): { year: number; month: number; day: number; dow: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_TZ,
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  };
}

/** Format a Date as YYYY-MM-DD in the portal timezone */
function toPortalDateKey(d: Date): string {
  const { year, month, day } = portalDateParts(d);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Build a rolling 7-day array starting from today in the portal timezone. */
export function buildNext7Days(): DayEntry[] {
  const days: DayEntry[] = [];
  const now = new Date();
  const todayKey = toPortalDateKey(now);

  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const key = toPortalDateKey(d);
    const { month, day, dow } = portalDateParts(d);
    const isToday = key === todayKey;
    days.push({
      key,
      dayName: isToday ? "Today" : SHORT_DAY_NAMES[dow],
      dateLabel: `${month}/${day}`,
      isToday,
    });
  }
  return days;
}

/** Map a YYYY-MM-DD date string to a date key — returns the date string as-is */
export function getDayKeyFromDate(dateStr: string): string {
  return dateStr.slice(0, 10);
}

/** Get today's date key in the portal timezone */
export function getTodayKey(): string {
  return toPortalDateKey(new Date());
}

// ---------------------------------------------------------------------------
// WeekdayRow — toggle row with per-day event counts
// ---------------------------------------------------------------------------

export function WeekdayRow({
  days,
  activeDays,
  dayCounts,
  onToggle,
}: {
  days: DayEntry[];
  activeDays: string[];
  dayCounts: Record<string, number>;
  onToggle: (day: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {days.map((day) => {
        const isActive = activeDays.includes(day.key);
        const count = dayCounts[day.key] || 0;
        const hasEvents = count > 0;
        const dateNum = day.dateLabel.split("/")[1];
        const dayAbbrev = day.isToday ? "Today" : day.dayName;

        return (
          <button
            key={day.key}
            onClick={() => onToggle(day.key)}
            className={[
              "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg font-mono transition-all active:scale-95",
              isActive
                ? "bg-[var(--neon-magenta)]/12 text-[var(--neon-magenta)]"
                : day.isToday
                  ? "text-[var(--cream)] hover:bg-white/[0.04]"
                  : hasEvents
                    ? "text-[var(--soft)] hover:bg-white/[0.03]"
                    : "text-[var(--muted)] opacity-35",
            ].join(" ")}
          >
            <span className={`text-2xs tracking-wide ${isActive ? "font-semibold" : "font-medium"}`}>
              {dayAbbrev}
            </span>
            <span className={`text-sm tabular-nums leading-none ${isActive ? "font-bold" : "font-semibold"}`}>
              {dateNum}
            </span>
            {hasEvents && (
              <span className={[
                "text-2xs tabular-nums leading-none",
                isActive ? "opacity-80" : "opacity-50",
              ].join(" ")}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
