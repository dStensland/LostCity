"use client";

import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, CalendarBlank, ArrowLeft } from "@phosphor-icons/react";
import { useBreakForecast } from "@/lib/hooks/useBreakForecast";
import { DayPlanCard } from "./DayPlanCard";
import type { SchoolCalendarEvent, ProgramWithVenue } from "@/lib/types/programs";
import type { EventWithLocation } from "@/lib/event-search";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";

// ---- Palette (Afternoon Field) -------------------------------------------
const CANVAS = FAMILY_TOKENS.canvas;
const CARD = FAMILY_TOKENS.card;
const SAGE = FAMILY_TOKENS.sage;
const TEXT = FAMILY_TOKENS.text;
const MUTED = FAMILY_TOKENS.textSecondary;
const BORDER = FAMILY_TOKENS.border;

// ---- Fonts ---------------------------------------------------------------
const JAKARTA = FAMILY_TOKENS.fontHeading;
const DM = FAMILY_TOKENS.fontBody;

// ---- Types ---------------------------------------------------------------

export interface BreakPlannerProps {
  portalId: string;
  portalSlug: string;
  /** The school break to plan for. */
  breakEvent: SchoolCalendarEvent;
  /** Called when the user wants to close/dismiss the planner. */
  onClose: () => void;
}

// ---- Date helpers --------------------------------------------------------

/** Generate YYYY-MM-DD strings for each weekday in [startDate, endDate]. */
function getWeekdays(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function formatBreakRange(startDate: string, endDate: string): string {
  const s = new Date(`${startDate}T00:00:00`);
  const e = new Date(`${endDate}T00:00:00`);
  const sLabel = s.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const eLabel = e.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `${sLabel} – ${eLabel}`;
}

// ---- Data fetchers -------------------------------------------------------

async function fetchProgramsForBreak(
  portalSlug: string,
  startDate: string,
  endDate: string
): Promise<ProgramWithVenue[]> {
  // Fetch programs whose session spans include any part of the break window.
  // We fetch broadly and filter client-side by each day.
  const params = new URLSearchParams({
    portal: portalSlug,
    limit: "80",
    sort: "session_start",
    active: "true",
  });
  const res = await fetch(`/api/programs?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json() as { programs?: ProgramWithVenue[] };
  // Keep only programs whose session overlaps the break
  return (json.programs ?? []).filter((p) => {
    const sessionStart = p.session_start;
    const sessionEnd = p.session_end;
    if (!sessionStart) return false;
    // Program overlaps break if: session_start <= endDate AND (session_end >= startDate OR no end)
    const sStart = sessionStart <= endDate;
    const sEnd = sessionEnd ? sessionEnd >= startDate : true;
    return sStart && sEnd;
  });
}

async function fetchEventsForBreak(
  portalSlugOrId: string,
  startDate: string,
  endDate: string
): Promise<EventWithLocation[]> {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    tags: "family-friendly",
    portal: portalSlugOrId,
    limit: "60",
    useCursor: "true",
  });
  const res = await fetch(`/api/events?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json() as { events?: EventWithLocation[] };
  const ADULT_RE = /\badult\b/i;
  const USTA_RE = /\bUSTA\b/;
  return (json.events ?? []).filter(
    (e) => !ADULT_RE.test(e.title) && !USTA_RE.test(e.title)
  );
}

/**
 * Group events by start_date into a Map<dateString, events[]>.
 * Each event appears once, on its start_date.
 */
function groupEventsByDate(events: EventWithLocation[]): Map<string, EventWithLocation[]> {
  const map = new Map<string, EventWithLocation[]>();
  for (const e of events) {
    const date = e.start_date;
    if (!date) continue;
    const existing = map.get(date) ?? [];
    existing.push(e);
    map.set(date, existing);
  }
  return map;
}

// ---- Programs for a specific day ----------------------------------------

function getProgramsForDay(programs: ProgramWithVenue[], date: string): ProgramWithVenue[] {
  return programs.filter((p) => {
    if (!p.session_start) return false;
    const sessionStart = p.session_start;
    const sessionEnd = p.session_end ?? sessionStart; // if no end, assume single-day
    return date >= sessionStart && date <= sessionEnd;
  });
}

// ---- Break header --------------------------------------------------------

function BreakHeader({
  name,
  startDate,
  endDate,
  onClose,
}: {
  name: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 border-b"
      style={{ backgroundColor: CARD, borderColor: BORDER }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:opacity-70 flex-shrink-0"
          style={{ color: MUTED, backgroundColor: BORDER }}
          aria-label="Back"
        >
          <ArrowLeft size={15} weight="bold" />
        </button>
        <div className="min-w-0">
          <p
            className="font-bold leading-tight truncate"
            style={{ fontFamily: JAKARTA, fontSize: 17, color: TEXT }}
          >
            {name} Planner
          </p>
          <p
            style={{ fontFamily: DM, fontSize: 11, color: MUTED }}
          >
            {formatBreakRange(startDate, endDate)}
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:opacity-70 flex-shrink-0"
        style={{ color: MUTED }}
        aria-label="Close planner"
      >
        <X size={16} weight="bold" />
      </button>
    </div>
  );
}

// ---- Empty break (no weekdays — e.g. a holiday on a Mon) -----------------

function NoWeekdaysState({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <CalendarBlank size={36} style={{ color: MUTED }} />
      <div className="text-center">
        <p style={{ fontFamily: JAKARTA, fontSize: 15, fontWeight: 700, color: TEXT }}>
          {name}
        </p>
        <p style={{ fontFamily: DM, fontSize: 13, color: MUTED, marginTop: 4 }}>
          No weekdays in this break window.
        </p>
      </div>
      <button
        onClick={onClose}
        className="rounded-xl px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-85"
        style={{ backgroundColor: SAGE, color: "#fff", fontFamily: DM }}
      >
        Go back
      </button>
    </div>
  );
}

// ---- Main component -------------------------------------------------------

export const BreakPlanner = memo(function BreakPlanner({
  portalId,
  portalSlug,
  breakEvent,
  onClose,
}: BreakPlannerProps) {
  const { start_date: startDate, end_date: endDate, name } = breakEvent;

  // Generate weekdays for this break
  const weekdays = useMemo(
    () => getWeekdays(startDate, endDate),
    [startDate, endDate]
  );

  // Fetch forecast for the break window
  const { days: forecastDays, loading: forecastLoading } = useBreakForecast(
    startDate,
    endDate
  );

  // Fetch all programs that overlap this break
  const { data: breakPrograms = [] } = useQuery({
    queryKey: ["break-planner-programs", portalSlug, startDate, endDate],
    queryFn: () => fetchProgramsForBreak(portalSlug, startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  // Single fetch for all events in the break window — replaces N per-day calls.
  const { data: allBreakEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["break-planner-events", portalId, startDate, endDate],
    queryFn: () => fetchEventsForBreak(portalSlug, startDate, endDate),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: weekdays.length > 0,
  });

  // Group events by start_date for O(1) per-day lookup.
  const eventsByDate = useMemo(
    () => groupEventsByDate(allBreakEvents),
    [allBreakEvents]
  );

  // Programs covering all weekdays of the break (e.g. all-week camp).
  // Show them on day 0 only to avoid repeating them as "Best Bet" every day.
  const fullBreakProgramIds = useMemo(() => {
    if (weekdays.length === 0) return new Set<string>();
    const ids = new Set<string>();
    for (const p of breakPrograms) {
      const start = p.session_start;
      const end = p.session_end;
      if (!start || !end) continue;
      const coversAll = weekdays.every((d) => d >= start && d <= end);
      if (coversAll) ids.add(p.id);
    }
    return ids;
  }, [breakPrograms, weekdays]);

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ backgroundColor: CANVAS }}
    >
      {/* Header */}
      <BreakHeader
        name={name}
        startDate={startDate}
        endDate={endDate}
        onClose={onClose}
      />

      {weekdays.length === 0 ? (
        <div className="flex-1 px-4 py-6">
          <NoWeekdaysState name={name} onClose={onClose} />
        </div>
      ) : (
        <div className="flex-1 px-4 py-5 sm:px-6">
          {/* Intro blurb */}
          <p
            className="mb-4"
            style={{ fontFamily: DM, fontSize: 13, color: MUTED, lineHeight: 1.6 }}
          >
            What&apos;s happening each day, curated for families.
          </p>

          {/* Day columns — vertical stack on mobile, 2-col grid on desktop for 5-day breaks */}
          <div
            className={
              weekdays.length >= 4
                ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col gap-3"
            }
          >
            {weekdays.map((date, idx) => {
              const forecast = forecastDays.find((f) => f.date === date) ?? null;
              // Exclude full-break programs from days 1+ to avoid repetition.
              const dayPrograms = getProgramsForDay(breakPrograms, date).filter(
                (p) => idx === 0 || !fullBreakProgramIds.has(p.id)
              );
              const dayEvents = eventsByDate.get(date) ?? [];

              return (
                <DayPlanCard
                  key={date}
                  date={date}
                  dayLabel={formatDayLabel(date)}
                  dateLabel={formatDateLabel(date)}
                  dayIndex={idx}
                  forecast={forecast}
                  forecastLoading={forecastLoading}
                  programs={dayPrograms}
                  events={dayEvents}
                  eventsLoading={eventsLoading}
                  portalSlug={portalSlug}
                />
              );
            })}
          </div>

          {/* Footer: link to browse all activities across the break */}
          <div className="mt-5 flex justify-center">
            <a
              href={`/${portalSlug}?tab=programs`}
              className="inline-flex items-center gap-1.5 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-85"
              style={{
                fontFamily: DM,
                borderColor: `${SAGE}40`,
                backgroundColor: `${SAGE}10`,
                color: SAGE,
              }}
            >
              <CalendarBlank size={14} weight="bold" />
              Browse all {name} activities
            </a>
          </div>
        </div>
      )}
    </div>
  );
});

