"use client";

/**
 * CivicHero — editorial masthead for civic/community portals.
 *
 * Typography-first design: mission headline with gradient city name,
 * color-coded pathway pills for meetings/events/groups, dynamic dateline.
 * No watermark, no photo — clean card-style hero for civic clarity.
 */

import Link from "next/link";
import { useMemo } from "react";
import {
  CalendarDots,
  UsersThree,
  CloudSun,
  ArrowRight,
} from "@phosphor-icons/react";
import type { CityPulseSection } from "@/lib/city-pulse/types";

interface CivicHeroProps {
  portalSlug: string;
  /** Event counts from timeline tabs */
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
  /** Weather from feed context */
  weather?: { temperature_f: number; condition: string; icon: string } | null;
  /** City name (e.g. "Atlanta") */
  cityName?: string;
  /** Number of interest channels/groups available */
  groupCount?: number;
  /** Lineup sections for deriving next-event urgency pill */
  lineupSections?: CityPulseSection[];
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).toUpperCase();
}

/** Derive the next upcoming event label from lineup sections (e.g. "Next: Thu 6pm") */
function getNextEventLabel(sections: CityPulseSection[]): string | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.item_type !== "event") continue;
      const ev = item.event;
      if (!ev.start_date || !ev.start_time) continue;

      try {
        const eventDate = new Date(ev.start_date + "T00:00:00");
        const now = new Date();
        // Only future events
        if (eventDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) continue;

        const dayName = eventDate.toLocaleDateString("en-US", { weekday: "short" });
        const isToday = eventDate.toDateString() === now.toDateString();

        // Format time: "6pm", "10am", "7:30pm"
        const [h, m] = ev.start_time.split(":").map(Number);
        const period = h >= 12 ? "pm" : "am";
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const timeStr = m > 0 ? `${hour12}:${String(m).padStart(2, "0")}${period}` : `${hour12}${period}`;

        return isToday ? `Next: Today ${timeStr}` : `Next: ${dayName} ${timeStr}`;
      } catch {
        continue;
      }
    }
  }
  return null;
}

export default function CivicHero({
  portalSlug,
  tabCounts,
  weather,
  cityName,
  groupCount,
  lineupSections,
}: CivicHeroProps) {
  const dateStr = getFormattedDate();
  const weekCount = tabCounts?.this_week ?? 0;

  // Derive urgency pill: next upcoming event
  const nextEventLabel = useMemo(
    () => (lineupSections?.length ? getNextEventLabel(lineupSections) : null),
    [lineupSections],
  );

  return (
    <section className="civic-hero relative overflow-hidden rounded-2xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))]">
      {/* Top accent bar — teal gradient stripe */}
      <div
        className="h-1 rounded-t-2xl"
        style={{
          background: "linear-gradient(90deg, var(--action-primary) 0%, color-mix(in srgb, var(--action-primary) 70%, #10b981) 100%)",
        }}
      />

      {/* Teal wash — subtle gradient from top-left */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--action-primary) 8%, transparent) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 px-5 sm:px-8 py-5 sm:py-7">
        {/* Dateline row: dot · date · weather */}
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: "var(--action-primary)" }}
          />
          <span
            className="font-mono text-2xs font-bold tracking-[0.18em] uppercase"
            style={{ color: "var(--action-primary)" }}
          >
            {dateStr}
          </span>
          {weather && (
            <>
              <span className="text-[var(--muted)] opacity-40">·</span>
              <span className="flex items-center gap-1 text-2xs font-medium text-[var(--soft)]">
                <CloudSun weight="duotone" className="w-3.5 h-3.5" />
                {Math.round(weather.temperature_f)}°F
                <span className="hidden sm:inline opacity-60">
                  {weather.condition}
                </span>
              </span>
            </>
          )}
        </div>

        {/* Headline — mission-forward with gradient city name */}
        <h1 className="mt-3">
          <span className="block text-3xl sm:text-[2.75rem] font-extrabold text-[var(--cream)] leading-[1.1] tracking-tight">
            Get involved
          </span>
          <span
            className="block text-3xl sm:text-[2.75rem] font-extrabold leading-[1.1] tracking-tight civic-gradient-text"
            style={{
              /* Gradient from action-primary to a slightly lighter shade — stays WCAG AA+ */
              background: "linear-gradient(135deg, var(--action-primary) 0%, color-mix(in srgb, var(--action-primary) 75%, #0d9488) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            in {cityName ?? "Atlanta"}.
          </span>
        </h1>

        {/* Subtitle — concise mission statement */}
        <p className="mt-2 text-sm sm:text-base font-medium text-[var(--soft)] max-w-md leading-relaxed">
          Meetings, volunteer opportunities, and civic action — all in one place.
        </p>

        {/* Pathway pills — color-coded by intent */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          {/* Meetings pill — amber, always visible when we have data */}
          {weekCount > 0 && (
            <Link
              href={`/${portalSlug}?view=find`}
              className="civic-pill inline-flex items-center gap-2 rounded-xl border-[1.5px] border-amber-300 bg-amber-50 px-4 min-h-11 text-sm transition-colors hover:bg-amber-100"
            >
              <CalendarDots weight="duotone" className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold text-amber-900">{weekCount} events</span>
              <span className="text-amber-700">this week</span>
            </Link>
          )}

          {/* Urgency pill — next upcoming event, replaces "groups to join" */}
          {nextEventLabel && (
            <span className="civic-pill inline-flex items-center gap-2 rounded-xl border-[1.5px] border-teal-300 bg-teal-50 px-4 min-h-11 text-sm">
              <ArrowRight weight="bold" className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="font-bold text-teal-900">{nextEventLabel}</span>
            </span>
          )}

          {/* Groups pill — teal, only when groups exist */}
          {(groupCount ?? 0) > 0 && (
            <Link
              href={`/${portalSlug}/groups`}
              className="civic-pill inline-flex items-center gap-2 rounded-xl border-[1.5px] border-emerald-300 bg-emerald-50 px-4 min-h-11 text-sm transition-colors hover:bg-emerald-100"
            >
              <UsersThree weight="duotone" className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold text-emerald-900">{groupCount} groups</span>
              <span className="text-emerald-700">to join</span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
