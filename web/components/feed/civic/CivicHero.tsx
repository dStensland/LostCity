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
  Lifebuoy,
} from "@phosphor-icons/react";
import type { CityPulseSection, CityPulseEventItem } from "@/lib/city-pulse/types";
import { isHelpAtlSupportDirectoryEnabled } from "@/lib/helpatl-support";
import { pickHeroItem } from "@/lib/civic-hero-priority";
import type { HeroItem } from "@/lib/civic-hero-priority";

interface CivicHeroProps {
  portalSlug: string;
  /** Event counts from timeline tabs — NOT used for the hero pill (all-portal, not civic-scoped) */
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
  /** Weather from feed context */
  weather?: { temperature_f: number; condition: string; icon: string } | null;
  /** City name (e.g. "Atlanta") */
  cityName?: string;
  /** Number of interest channels/groups available */
  groupCount?: number;
  /** Lineup sections for deriving next-event urgency pill and civic event count */
  lineupSections?: CityPulseSection[];
  /** Event IDs from channels the user subscribes to — boosts those events to hero */
  subscribedChannelEventIds?: Set<number>;
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).toUpperCase();
}

/**
 * Count unique events in the portal-scoped lineup sections.
 * These sections come directly from the CityPulse feed scoped to this portal,
 * so the count reflects civic events only — not all Atlanta events.
 */
function countPortalScopedEvents(sections: CityPulseSection[]): number {
  const seenIds = new Set<number>();
  for (const section of sections) {
    for (const item of section.items) {
      if (item.item_type !== "event") continue;
      const ev = (item as CityPulseEventItem).event;
      seenIds.add(ev.id);
    }
  }
  return seenIds.size;
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

/** Format a date string (YYYY-MM-DD) into a short readable label like "Tue, Apr 8" */
function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

/** Format a time string (HH:MM) into "6pm", "10am", "7:30pm" */
function formatEventTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(":").map(Number);
    const period = h >= 12 ? "pm" : "am";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m > 0 ? `${hour12}:${String(m).padStart(2, "0")}${period}` : `${hour12}${period}`;
  } catch {
    return timeStr;
  }
}

/**
 * Build the contextual hero headline lines based on the priority selection.
 * Returns [line1, line2] where line2 renders in gradient teal.
 */
function buildHeadlineLines(
  heroSelection: ReturnType<typeof pickHeroItem>,
  weekCount: number,
  cityName: string,
): [string, string] {
  if (!heroSelection) {
    return [
      weekCount > 0 ? `${weekCount} ways to get involved` : "Get involved",
      `this week in ${cityName}.`,
    ];
  }

  const { item, reason } = heroSelection;

  if (reason === "election") {
    const isVoterReg = item.tags.some((t) =>
      t === "voter-registration" || t === "civic-deadline",
    );
    if (isVoterReg) {
      const deadline = formatEventDate(item.start_date);
      return ["Register by", `${deadline}.`];
    }
    const dateLabel = formatEventDate(item.start_date);
    return [item.title, `${dateLabel}.`];
  }

  if (reason === "channel_match") {
    const timeLabel = item.start_time ? formatEventTime(item.start_time) : null;
    const dateLabel = formatEventDate(item.start_date);
    const suffix = timeLabel ? `${dateLabel} at ${timeLabel}.` : `${dateLabel}.`;
    return [item.title, suffix];
  }

  // reason === "soonest"
  const dateLabel = formatEventDate(item.start_date);
  return [item.title, `${dateLabel}.`];
}

export default function CivicHero({
  portalSlug,
  tabCounts,
  weather,
  cityName,
  groupCount,
  lineupSections,
  subscribedChannelEventIds,
}: CivicHeroProps) {
  const dateStr = getFormattedDate();
  // Use the portal-scoped lineup section count, not tabCounts.this_week which
  // reflects all Atlanta events (music, nightlife, etc.), not just civic events.
  const weekCount = useMemo(
    () => (lineupSections?.length ? countPortalScopedEvents(lineupSections) : 0),
    [lineupSections],
  );
  const showSupport = isHelpAtlSupportDirectoryEnabled(portalSlug);

  // Derive urgency pill: next upcoming event
  const nextEventLabel = useMemo(
    () => (lineupSections?.length ? getNextEventLabel(lineupSections) : null),
    [lineupSections],
  );

  // Extract hero items from lineup sections and pick the priority event
  const heroSelection = useMemo(() => {
    if (!lineupSections?.length) return null;
    const heroItems: HeroItem[] = [];
    const seen = new Set<number>();
    for (const section of lineupSections) {
      for (const item of section.items) {
        if (item.item_type !== "event") continue;
        const ev = (item as CityPulseEventItem).event;
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        heroItems.push({
          id: ev.id,
          title: ev.title,
          tags: ev.tags ?? [],
          start_date: ev.start_date,
          start_time: ev.start_time,
          venue_name: ev.venue?.name ?? "",
        });
      }
    }
    return pickHeroItem(heroItems, subscribedChannelEventIds ?? new Set<number>());
  }, [lineupSections, subscribedChannelEventIds]);

  // Build headline: contextual when we have a priority event, fallback when not
  const [headlineLine1, headlineLine2] = useMemo(
    () => buildHeadlineLines(heroSelection, weekCount, cityName ?? "Atlanta"),
    [heroSelection, weekCount, cityName],
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

        {/* Headline — contextual: election urgency, channel match, or count fallback */}
        <h1 className="mt-3">
          <span className="block text-3xl sm:text-[2.75rem] font-extrabold text-[var(--cream)] leading-[1.1] tracking-tight">
            {headlineLine1}
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
            {headlineLine2}
          </span>
        </h1>

        {/* Subtitle — concise mission statement */}
        <p className="mt-2 text-sm sm:text-base font-medium text-[var(--soft)] max-w-md leading-relaxed">
          Meetings, volunteer opportunities, and civic action in one place.
        </p>

        {/* Pathway pills — color-coded by intent */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          {/* Meetings pill — amber, always visible when we have data */}
          {weekCount > 0 && (
            <Link
              href={`/${portalSlug}?view=find&lane=events`}
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

          {showSupport && (
            <Link
              href={`/${portalSlug}/support`}
              className="civic-pill inline-flex items-center gap-2 rounded-xl border-[1.5px] border-sky-300 bg-sky-50 px-4 min-h-11 text-sm transition-colors hover:bg-sky-100"
            >
              <Lifebuoy weight="duotone" className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="font-bold text-sky-900">Need support?</span>
              <span className="text-sky-700">Find help</span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
