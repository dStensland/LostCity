"use client";

import { useMemo } from "react";
import {
  SCHOOL_SYSTEM_LABELS,
  SCHOOL_EVENT_TYPE_LABELS,
  type SchoolCalendarEvent,
} from "@/lib/types/programs";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";
import { SectionLabel, SkeletonBlock } from "./_shared";

const AMBER = FAMILY_TOKENS.amber;
const TEXT = FAMILY_TOKENS.text;
const MUTED = FAMILY_TOKENS.textSecondary;
const CARD = FAMILY_TOKENS.card;
const BORDER = FAMILY_TOKENS.border;

// ---- School type emoji map -------------------------------------------------

const SCHOOL_TYPE_EMOJI: Record<string, string> = {
  no_school: "🏠",
  half_day: "🕐",
  break: "🌸",
  holiday: "🎉",
  early_release: "⏰",
};

// ---- HeadsUpCard -----------------------------------------------------------

function HeadsUpCard({ event }: { event: SchoolCalendarEvent }) {
  const startDate = new Date(event.start_date + "T00:00:00");
  const endDate = new Date(event.end_date + "T00:00:00");
  const isSingleDay = event.start_date === event.end_date;

  const dateLabel = isSingleDay
    ? startDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const typeLabel = SCHOOL_EVENT_TYPE_LABELS[event.event_type];
  // school_system may be a pre-combined "APS, DeKalb, Cobb" string from deduplication
  const systemLabel = SCHOOL_SYSTEM_LABELS[event.school_system] ?? event.school_system;
  const emoji = SCHOOL_TYPE_EMOJI[event.event_type] ?? "📅";

  return (
    <div
      className="flex items-start gap-3 rounded-xl"
      style={{
        backgroundColor: CARD,
        border: `1px solid ${BORDER}`,
        padding: "10px 14px",
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{emoji}</span>
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            lineHeight: 1.3,
          }}
        >
          {event.name}
        </p>
        <p
          style={{
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: 11,
            color: MUTED,
            marginTop: 2,
          }}
        >
          {typeLabel} · {systemLabel} · {dateLabel}
        </p>
      </div>
    </div>
  );
}

// ---- HeadsUpSection --------------------------------------------------------

export function HeadsUpSection({
  calendarData,
  isLoading,
}: {
  calendarData: SchoolCalendarEvent[] | undefined;
  isLoading: boolean;
}) {
  // Deduplicate by (name, start_date, end_date) — same break shows once per
  // school system and we merge the system names into a single row.
  const dedupedCalendar = useMemo<SchoolCalendarEvent[]>(() => {
    if (!calendarData) return [];
    const groups = new Map<string, SchoolCalendarEvent & { _systems: string[] }>();
    for (const evt of calendarData) {
      const key = `${evt.name}|${evt.start_date}|${evt.end_date}`;
      const existing = groups.get(key);
      if (existing) {
        const systemLabel = SCHOOL_SYSTEM_LABELS[evt.school_system] ?? evt.school_system;
        if (!existing._systems.includes(systemLabel)) {
          existing._systems.push(systemLabel);
        }
      } else {
        const systemLabel = SCHOOL_SYSTEM_LABELS[evt.school_system] ?? evt.school_system;
        groups.set(key, { ...evt, _systems: [systemLabel] });
      }
    }
    // Re-map: if multiple systems, override school_system label in the card via the name field
    return Array.from(groups.values()).map((g) => {
      if (g._systems.length <= 1) return g;
      // Encode the combined system list into school_system so HeadsUpCard renders it.
      // HeadsUpCard calls SCHOOL_SYSTEM_LABELS[event.school_system]; if the key is not
      // in the map the lookup returns undefined, so we use the combined string directly.
      return { ...g, school_system: g._systems.join(", ") as SchoolCalendarEvent["school_system"] };
    });
  }, [calendarData]);

  const has = dedupedCalendar.length > 0;

  return (
    <section>
      <SectionLabel text="Heads Up" color={AMBER} />
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <SkeletonBlock height={58} />
          <SkeletonBlock height={58} />
        </div>
      ) : has ? (
        <div className="flex flex-col gap-2">
          {dedupedCalendar.map((evt) => (
            <HeadsUpCard key={`${evt.name}|${evt.start_date}`} event={evt} />
          ))}
        </div>
      ) : (
        <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 13, color: MUTED }}>
          No upcoming school calendar alerts.
        </p>
      )}
    </section>
  );
}
