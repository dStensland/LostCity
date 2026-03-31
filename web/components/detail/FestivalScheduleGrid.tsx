"use client";

import { memo, useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { CaretRight, CalendarBlank } from "@phosphor-icons/react";
import { decodeHtmlEntities, formatTimeSplit } from "@/lib/formats";
import RSVPButton from "@/components/RSVPButton";
import AddToCalendar from "@/components/AddToCalendar";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionData {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    nearest_marta_station?: string | null;
    marta_walk_minutes?: number | null;
    marta_lines?: string[] | null;
    beltline_adjacent?: boolean | null;
    beltline_segment?: string | null;
    parking_type?: string[] | null;
    parking_free?: boolean | null;
    transit_score?: number | null;
  } | null;
}

interface FestivalProgram {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sessions: SessionData[];
}

interface FestivalScheduleGridProps {
  programs: FestivalProgram[];
  portalSlug: string;
  onEventClick: (sessionId: number) => void;
  onProgramClick: (programSlug: string) => void;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STAGE_COLORS = ["#FF6B7A", "#FFD93D", "#00D9A0", "#A78BFA"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSessionTime(time: string | null): string {
  if (!time) return "TBA";
  if (time === "00:00:00" || time === "00:00") return "TBA";
  const { time: t, period } = formatTimeSplit(time, false);
  return period ? `${t} ${period}` : t;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StageColumnProps {
  program: FestivalProgram;
  stageColor: string;
  onEventClick: (sessionId: number) => void;
  onProgramClick: (programSlug: string) => void;
}

const StageColumn = memo(function StageColumn({
  program,
  stageColor,
  onEventClick,
  onProgramClick,
}: StageColumnProps) {
  const sorted = useMemo(() => {
    return [...program.sessions].sort((a, b) =>
      (a.start_time ?? "").localeCompare(b.start_time ?? "")
    );
  }, [program.sessions]);

  const timedSessions = sorted.filter(
    (s) => s.start_time && s.start_time !== "00:00:00" && s.start_time !== "00:00"
  );
  const headlinerId = timedSessions.length > 1
    ? timedSessions[timedSessions.length - 1].id
    : null;

  return (
    <div
      className="flex-1 min-w-0 rounded-xl border border-[var(--twilight)] overflow-hidden"
      style={{ background: "var(--night)" }}
    >
      {/* Stage header */}
      <div
        className="flex items-center px-4 py-3 border-b border-[var(--twilight)]/50"
        style={{ background: `${stageColor}14` }}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 mr-3"
          style={{ background: stageColor }}
        />
        <h3 className="text-sm font-bold text-[var(--cream)] flex-1 min-w-0 truncate">
          {program.title}
        </h3>
        {sorted.length > 0 && (
          <span className="font-mono text-xs ml-3 flex-shrink-0 text-[var(--muted)]">
            {sorted.length} set{sorted.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Session rows */}
      <div>
        {sorted.map((session, rowIndex) => {
          const sessionTitle = decodeHtmlEntities(session.title);
          const isHeadliner = session.id === headlinerId && sorted.length > 1;

          return (
            <div
              key={session.id}
              className="flex items-center gap-3 px-4 group"
              style={
                isHeadliner
                  ? {
                      background: `${stageColor}14`,
                      borderBottom: rowIndex < sorted.length - 1
                        ? "1px solid rgba(37,37,48,0.3)"
                        : undefined,
                    }
                  : {
                      borderBottom: rowIndex < sorted.length - 1
                        ? "1px solid rgba(37,37,48,0.3)"
                        : undefined,
                    }
              }
            >
              <button
                onClick={() => onEventClick(session.id)}
                className="flex-1 min-w-0 flex items-center gap-3 py-2.5 text-left focus-ring"
                style={{ minHeight: "44px" }}
              >
                {/* Time column — fixed 36px, mono, tabular */}
                <span
                  className="font-mono text-xs shrink-0 w-9 tabular-nums"
                  style={{ color: isHeadliner ? stageColor : "var(--muted)" }}
                >
                  {formatSessionTime(session.start_time)}
                </span>

                {/* Content column */}
                <span className="min-w-0 flex-1 flex items-center gap-2">
                  <span
                    className={`truncate block ${isHeadliner ? "text-sm font-semibold" : "text-sm font-medium"}`}
                    style={{ color: "var(--cream)" }}
                  >
                    {sessionTitle}
                  </span>
                  {isHeadliner && (
                    <span
                      className="flex-shrink-0 font-mono text-2xs font-bold px-1.5 py-0.5 rounded"
                      style={{
                        color: stageColor,
                        background: `${stageColor}33`,
                      }}
                    >
                      HEADLINER
                    </span>
                  )}
                </span>
              </button>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                {!isHeadliner && (
                  <AddToCalendar
                    eventId={session.id}
                    title={sessionTitle}
                    date={session.start_date}
                    time={session.start_time}
                    venue={session.venue?.name}
                    variant="icon"
                  />
                )}
                <RSVPButton
                  eventId={session.id}
                  eventTitle={sessionTitle}
                  venueId={session.venue?.id}
                  venueName={session.venue?.name}
                  variant="compact"
                />
              </div>

              <CaretRight
                size={14}
                weight="bold"
                className="flex-shrink-0"
                style={{
                  color: isHeadliner
                    ? `${stageColor}99`
                    : "rgba(139,139,148,0.4)",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* View program link */}
      <div className="px-4 border-t border-[var(--twilight)]/20">
        <button
          onClick={() => onProgramClick(program.slug)}
          className="min-h-[44px] text-xs font-mono text-[var(--soft)] hover:text-[var(--cream)] transition-colors flex items-center gap-1 focus-ring"
        >
          View full program
          <CaretRight size={11} weight="bold" />
        </button>
      </div>
    </div>
  );
});

// ── Main Component ────────────────────────────────────────────────────────────

export const FestivalScheduleGrid = memo(function FestivalScheduleGrid({
  programs,
  onEventClick,
  onProgramClick,
}: FestivalScheduleGridProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const allSessions = useMemo(
    () => programs.flatMap((p) => p.sessions || []),
    [programs]
  );

  const uniqueDates = useMemo(() => {
    const dates = [...new Set(allSessions.map((s) => s.start_date))].sort();
    return dates;
  }, [allSessions]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const defaultDay = uniqueDates.includes(todayStr)
    ? todayStr
    : uniqueDates[0] ?? null;
  const activeDay =
    selectedDay && uniqueDates.includes(selectedDay) ? selectedDay : defaultDay;

  // Programs filtered to active day, with sessions filtered to that day
  const dayPrograms = useMemo(() => {
    if (!activeDay) return programs;
    return programs
      .map((p) => ({
        ...p,
        sessions: p.sessions.filter((s) => s.start_date === activeDay),
      }))
      .filter((p) => p.sessions.length > 0);
  }, [programs, activeDay]);

  return (
    <div>
      {/* Day tabs — segmented control style */}
      {uniqueDates.length > 1 && (
        <div
          className="inline-flex items-center gap-0.5 p-[3px] rounded-lg mb-4"
          style={{ background: "var(--dusk)" }}
          role="tablist"
          aria-label="Festival days"
        >
          {uniqueDates.map((date) => {
            const isActive = date === activeDay;
            return (
              <button
                key={date}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedDay(date)}
                className="flex flex-col items-center px-4 py-2 rounded-md transition-colors focus-ring"
                style={
                  isActive
                    ? { background: "var(--coral)", color: "var(--void)" }
                    : { color: "var(--soft)" }
                }
              >
                <span
                  className="font-mono text-2xs font-bold tracking-[0.06em] uppercase"
                  style={{ color: isActive ? "var(--void)" : "var(--muted)" }}
                >
                  {format(parseISO(date), "EEE")}
                </span>
                <span
                  className={`text-sm ${isActive ? "font-semibold" : ""}`}
                  style={{ color: isActive ? "var(--void)" : "var(--soft)" }}
                >
                  {format(parseISO(date), "MMM d")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Stage grid — stacked mobile, parallel columns desktop */}
      {dayPrograms.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-5">
          {dayPrograms.map((program, programIndex) => {
            const stageColor = STAGE_COLORS[programIndex % STAGE_COLORS.length];
            return (
              <StageColumn
                key={program.id}
                program={program}
                stageColor={stageColor}
                onEventClick={onEventClick}
                onProgramClick={onProgramClick}
              />
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center border border-[var(--twilight)] rounded-xl bg-[var(--night)]">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
            <CalendarBlank
              size={24}
              weight="light"
              className="text-[var(--muted)]"
              aria-hidden="true"
            />
          </div>
          <p className="text-[var(--muted)] text-sm">
            {programs.length > 0
              ? "No sessions on this day"
              : "Program details coming soon"}
          </p>
        </div>
      )}
    </div>
  );
});

export type { FestivalScheduleGridProps, FestivalProgram, SessionData };
