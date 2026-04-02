"use client";

import { memo } from "react";
import Link from "next/link";
import Dot from "@/components/ui/Dot";

// ---------------------------------------------------------------------------
// Types — re-export from the canonical hook definition
// ---------------------------------------------------------------------------

import type { ClassEvent } from "@/lib/hooks/useClassesData";
export type { ClassEvent };

export interface GroupedClass {
  key: string;
  title: string;
  skillLevel: string | null;
  instructor: string | null;
  capacity: number | null;
  priceMin: number | null;
  isFree: boolean | null;
  pattern: string;
  patternType: "recurring" | "multi-session" | "one-off" | "irregular";
  nextDate: string;
  nextTime: string | null;
  detailUrl: string;
  instances: ClassEvent[];
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "9:00 AM" or "9 AM" — drop :00 when on the hour */
function formatTime(time: string | null): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${mStr} ${ampm}`;
}

/** "Apr 5" */
function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(
    new Date()
  );
}

function derivePattern(instances: ClassEvent[]): {
  pattern: string;
  patternType: GroupedClass["patternType"];
} {
  if (instances.length === 1) {
    const inst = instances[0];
    const [year, month, day] = inst.start_date.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const weekdayName = WEEKDAY_NAMES[d.getDay()];
    const datePart = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const timePart = inst.start_time
      ? `${formatTime(inst.start_time)}${inst.end_time ? ` – ${formatTime(inst.end_time)}` : ""}`
      : null;
    const pattern = timePart
      ? `${weekdayName}, ${datePart} · ${timePart}`
      : `${weekdayName}, ${datePart}`;
    return { pattern, patternType: "one-off" };
  }

  // Check if all instances share the same weekday(s)
  const weekdaySet = new Set(
    instances.map((inst) => {
      const [y, mo, d] = inst.start_date.split("-").map(Number);
      return new Date(y, mo - 1, d).getDay();
    })
  );

  const timeSet = new Set(instances.map((inst) => inst.start_time ?? ""));
  const endTimeSet = new Set(instances.map((inst) => inst.end_time ?? ""));
  const consistentTime = timeSet.size === 1;
  const consistentEndTime = endTimeSet.size === 1;

  if (instances.length >= 3 && weekdaySet.size <= 2) {
    const sortedDays = [...weekdaySet].sort((a, b) => a - b);
    const dayLabels = sortedDays.map((d) => WEEKDAY_NAMES[d] + "s");
    const dayStr =
      dayLabels.length === 1
        ? dayLabels[0]
        : `${dayLabels[0]} & ${dayLabels[1]}`;

    const repTime =
      consistentTime && instances[0].start_time
        ? formatTime(instances[0].start_time)
        : null;
    const repEndTime =
      consistentEndTime && instances[0].end_time
        ? formatTime(instances[0].end_time)
        : null;

    const timeStr =
      repTime && repEndTime
        ? `${repTime} – ${repEndTime}`
        : repTime ?? null;

    const pattern = timeStr ? `${dayStr}, ${timeStr}` : dayStr;
    return { pattern, patternType: "recurring" };
  }

  // Finite series with varying dates
  const sorted = [...instances].sort((a, b) =>
    a.start_date.localeCompare(b.start_date)
  );
  const first = sorted[0].start_date;
  const last = sorted[sorted.length - 1].start_date;

  if (first !== last) {
    const pattern = `${instances.length} sessions · ${formatShortDate(first)} – ${formatShortDate(last)}`;
    return { pattern, patternType: "multi-session" };
  }

  return { pattern: "Multiple sessions", patternType: "irregular" };
}

function pickRepresentative(instances: ClassEvent[]): ClassEvent {
  const today = todayEastern();
  const future = instances.filter((inst) => inst.start_date >= today);
  const sorted = (future.length > 0 ? future : instances).sort((a, b) =>
    a.start_date.localeCompare(b.start_date)
  );
  return sorted[0];
}

/**
 * Group a flat list of class events into deduplicated GroupedClass entries.
 *
 * Priority order:
 *   1. Group by series_id when non-null
 *   2. Group by (venue_id + normalized_title + start_time) as fallback
 *   3. One-off workshops that don't match either
 */
export function groupClassesBySeries(
  events: ClassEvent[],
  portalSlug: string
): GroupedClass[] {
  const seriesMap = new Map<string, ClassEvent[]>();
  const fallbackMap = new Map<string, ClassEvent[]>();

  for (const evt of events) {
    if (evt.series_id) {
      const bucket = seriesMap.get(evt.series_id) ?? [];
      bucket.push(evt);
      seriesMap.set(evt.series_id, bucket);
    } else {
      const venueKey = evt.venue?.id ?? evt.place_id ?? 0;
      const key = `${venueKey}||${normalizeTitle(evt.title)}||${evt.start_time ?? ""}`;
      const bucket = fallbackMap.get(key) ?? [];
      bucket.push(evt);
      fallbackMap.set(key, bucket);
    }
  }

  const result: GroupedClass[] = [];

  function buildGroup(key: string, instances: ClassEvent[]): GroupedClass {
    const rep = pickRepresentative(instances);
    const { pattern, patternType } = derivePattern(instances);
    return {
      key,
      title: rep.title,
      skillLevel: rep.skill_level,
      instructor: rep.instructor,
      capacity: rep.capacity,
      priceMin: rep.price_min,
      isFree: rep.is_free,
      pattern,
      patternType,
      nextDate: rep.start_date,
      nextTime: rep.start_time,
      detailUrl: rep.source_url ?? `/${portalSlug}/events/${rep.slug || rep.id}`,
      instances,
    };
  }

  for (const [seriesId, instances] of seriesMap) {
    result.push(buildGroup(`series:${seriesId}`, instances));
  }

  for (const [fbKey, instances] of fallbackMap) {
    result.push(buildGroup(`fb:${fbKey}`, instances));
  }

  // Sort: upcoming first, then by next date
  const today = todayEastern();
  result.sort((a, b) => {
    const aFuture = a.nextDate >= today;
    const bFuture = b.nextDate >= today;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    return a.nextDate.localeCompare(b.nextDate);
  });

  return result;
}

// ---------------------------------------------------------------------------
// Skill level badge config
// ---------------------------------------------------------------------------

const SKILL_BADGE: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  beginner: {
    bg: "color-mix(in srgb, var(--neon-green) 12%, transparent)",
    border: "color-mix(in srgb, var(--neon-green) 30%, transparent)",
    text: "var(--neon-green)",
    label: "Beginner",
  },
  intermediate: {
    bg: "color-mix(in srgb, var(--gold) 12%, transparent)",
    border: "color-mix(in srgb, var(--gold) 30%, transparent)",
    text: "var(--gold)",
    label: "Intermediate",
  },
  advanced: {
    bg: "color-mix(in srgb, var(--coral) 12%, transparent)",
    border: "color-mix(in srgb, var(--coral) 30%, transparent)",
    text: "var(--coral)",
    label: "Advanced",
  },
  "all-levels": {
    bg: "color-mix(in srgb, var(--twilight) 80%, transparent)",
    border: "color-mix(in srgb, var(--twilight) 100%, transparent)",
    text: "var(--soft)",
    label: "All levels",
  },
};

function SkillBadge({ level }: { level: string }) {
  const config = SKILL_BADGE[level.toLowerCase()] ?? SKILL_BADGE["all-levels"];
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full font-mono text-xs font-semibold"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.text,
      }}
    >
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ClassCard Component
// ---------------------------------------------------------------------------

export interface ClassCardProps {
  group: GroupedClass;
}

export const ClassCard = memo(function ClassCard({ group }: ClassCardProps) {
  return (
    <div className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 px-3.5 py-3 sm:px-4 sm:py-3.5 hover:border-[var(--twilight)]/70 transition-colors">
      {/* Header row: title + details link */}
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-base font-semibold text-[var(--cream)] leading-snug flex-1 min-w-0">
          {group.title}
        </h4>
        <Link
          href={group.detailUrl}
          className="flex-shrink-0 text-xs font-medium text-[var(--coral)] hover:text-[var(--coral)]/80 transition-colors whitespace-nowrap mt-0.5"
        >
          Details →
        </Link>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {group.skillLevel && <SkillBadge level={group.skillLevel} />}

        {group.isFree ? (
          <span
            className="inline-flex px-2 py-0.5 rounded-full font-mono text-xs font-semibold"
            style={{
              background: "color-mix(in srgb, var(--neon-green) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--neon-green) 30%, transparent)",
              color: "var(--neon-green)",
            }}
          >
            Free
          </span>
        ) : group.priceMin != null ? (
          <span className="text-xs font-medium text-[var(--soft)]">
            ${group.priceMin}
            {group.priceMin === 0 ? "" : "+"}
          </span>
        ) : null}

        {group.capacity != null && (
          <span className="text-xs text-[var(--muted)]">
            {group.capacity} spots
          </span>
        )}
      </div>

      {/* Schedule pattern */}
      <p className="mt-2 text-sm text-[var(--soft)]">{group.pattern}</p>

      {/* Instructor + next date */}
      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[var(--muted)]">
        {group.instructor && (
          <>
            <span>{group.instructor}</span>
            <Dot className="text-[var(--muted)]/40 flex-shrink-0" />
          </>
        )}
        <span>
          Next:{" "}
          <span className="text-[var(--soft)]">{formatShortDate(group.nextDate)}</span>
          {group.nextTime && (
            <>
              {" "}
              <span className="text-[var(--soft)]">
                · {formatTime(group.nextTime)}
              </span>
            </>
          )}
        </span>
      </div>
    </div>
  );
});

export type { ClassEvent as ClassEventRow };
