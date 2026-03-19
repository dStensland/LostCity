"use client";

import { memo, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { CaretLeft, CaretRight, Sun } from "@phosphor-icons/react";
import {
  type ProgramWithVenue,
  type SchoolCalendarEvent,
} from "@/lib/types/programs";
import { isAgeMatch, type KidProfile } from "@/lib/types/kid-profiles";
import type { EventWithLocation } from "@/lib/search";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";

// ---- Palette (Afternoon Field) -------------------------------------------
const CANVAS = FAMILY_TOKENS.canvas;
const CARD = FAMILY_TOKENS.card;
const SAGE = FAMILY_TOKENS.sage;
const SKY = FAMILY_TOKENS.sky;
const TEXT = FAMILY_TOKENS.text;
const MUTED = FAMILY_TOKENS.textSecondary;
const BORDER = FAMILY_TOKENS.border;
// School-off wash: a lighter sage tint not in the shared token set
const SAGE_WASH = "#EEF2EE";

// ---- Fonts ----------------------------------------------------------------
const JAKARTA = "var(--font-plus-jakarta-sans, system-ui, sans-serif)";
const DM = "var(--font-dm-sans, system-ui, sans-serif)";
const OUTFIT = "var(--font-plus-jakarta-sans, system-ui, sans-serif)";

// ---- Types ----------------------------------------------------------------

interface CalendarViewProps {
  portalSlug: string;
  /** portalId is accepted for backwards-compat but not used directly — events are fetched via slug. */
  portalId?: string;
  activeKidIds?: string[];
  kids?: KidProfile[];
}

type ViewMode = "month" | "week" | "agenda";

// ---- Data fetchers --------------------------------------------------------

async function fetchSchoolCalendar(systems: string[]): Promise<SchoolCalendarEvent[]> {
  const params = new URLSearchParams({ upcoming: "false", limit: "200" });
  if (systems.length > 0) params.set("system", systems.join(","));
  const res = await fetch(`/api/school-calendar?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.events ?? []) as SchoolCalendarEvent[];
}

async function fetchCalendarPrograms(portalSlug: string): Promise<ProgramWithVenue[]> {
  const params = new URLSearchParams({ portal: portalSlug, limit: "60", sort: "session_start" });
  const res = await fetch(`/api/programs?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.programs ?? []) as ProgramWithVenue[];
}

async function fetchDayEvents(portalSlug: string, date: string): Promise<EventWithLocation[]> {
  const params = new URLSearchParams({
    date,
    tags: "family-friendly",
    portal: portalSlug,
    limit: "12",
  });
  const res = await fetch(`/api/events?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.events ?? []) as EventWithLocation[];
}

// ---- Calendar helpers -----------------------------------------------------

function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function today(): { year: number; month: number; day: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Returns the ISO day of week for the 1st of month (0=Sun, 6=Sat). */
function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_ABBR = ["S", "M", "T", "W", "T", "F", "S"];

/** Build a 6×7 grid (or 5×7 when it fits) of {year, month, day} objects. */
function buildMonthGrid(year: number, month: number): Array<{ year: number; month: number; day: number; isCurrentMonth: boolean }> {
  const cells: Array<{ year: number; month: number; day: number; isCurrentMonth: boolean }> = [];
  const firstDow = firstDayOfWeek(year, month);
  const totalDays = daysInMonth(year, month);

  // Pad with prev month days
  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevTotal = daysInMonth(prevMonthYear, prevMonth);
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({ year: prevMonthYear, month: prevMonth, day: prevTotal - i, isCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ year, month, day: d, isCurrentMonth: true });
  }

  // Pad with next month days
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ year: nextMonthYear, month: nextMonth, day: nextDay++, isCurrentMonth: false });
  }

  return cells;
}

/** Returns all date strings (YYYY-MM-DD) covered by start_date..end_date inclusive. */
function expandDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const cur = new Date(s);
  while (cur <= e) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function formatDayTitle(year: number, month: number, day: number): string {
  const d = new Date(year, month, day);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// ---- Helpers --------------------------------------------------------------

function stripProgramCode(name: string): string {
  return name.replace(/\s*\([A-Z]{2,4}\d{4,6}\)\s*$/, "").trim();
}

// ---- Sub-components -------------------------------------------------------

function ViewToggle({
  active,
  onChange,
}: {
  active: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const VIEWS: { id: ViewMode; label: string }[] = [
    { id: "month", label: "Month" },
    { id: "week", label: "Week" },
    { id: "agenda", label: "Agenda" },
  ];
  return (
    <div
      className="inline-flex rounded-full border p-0.5"
      style={{ backgroundColor: CARD, borderColor: BORDER }}
    >
      {VIEWS.map((v) => (
        <button
          key={v.id}
          onClick={() => onChange(v.id)}
          className="rounded-full px-3 py-1 transition-colors"
          style={{
            fontFamily: DM,
            fontSize: 12,
            fontWeight: 600,
            color: active === v.id ? "#fff" : MUTED,
            backgroundColor: active === v.id ? SAGE : "transparent",
          }}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function MonthNav({
  year,
  month,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const t = today();
  const isThisMonth = year === t.year && month === t.month;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:opacity-70"
          style={{ color: MUTED }}
          aria-label="Previous month"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <span
          className="min-w-[120px] text-center"
          style={{ fontFamily: JAKARTA, fontSize: 18, fontWeight: 700, color: TEXT }}
        >
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={onNext}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:opacity-70"
          style={{ color: MUTED }}
          aria-label="Next month"
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
      {!isThisMonth && (
        <button
          onClick={onToday}
          className="rounded-full border px-3 py-1 transition-colors hover:opacity-80"
          style={{
            fontFamily: DM,
            fontSize: 11,
            fontWeight: 600,
            color: SKY,
            backgroundColor: `${SKY}15`,
            borderColor: `${SKY}40`,
          }}
        >
          Today
        </button>
      )}
    </div>
  );
}

function DayNamesRow() {
  return (
    <div className="grid grid-cols-7">
      {DAY_ABBR.map((d, i) => (
        <div
          key={i}
          className="flex items-center justify-center py-1"
          style={{ fontFamily: JAKARTA, fontSize: 11, fontWeight: 600, color: MUTED }}
        >
          {d}
        </div>
      ))}
    </div>
  );
}

function DotRow({ matchingKidColors, isSchoolOff }: { matchingKidColors: string[]; isSchoolOff?: boolean }) {
  const hasDots = matchingKidColors.length > 0 || isSchoolOff;
  if (!hasDots) return null;
  return (
    <div className="mt-0.5 flex items-center justify-center gap-[2px]">
      {matchingKidColors.slice(0, 3).map((color, i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{ width: 4, height: 4, backgroundColor: color }}
        />
      ))}
      {matchingKidColors.length === 0 && isSchoolOff && (
        <span
          className="inline-block rounded-full"
          style={{ width: 4, height: 4, backgroundColor: SAGE }}
        />
      )}
    </div>
  );
}

function DayCell({
  cell,
  isToday,
  isSelected,
  isSchoolOff,
  kidColors,
  onClick,
}: {
  cell: { year: number; month: number; day: number; isCurrentMonth: boolean };
  isToday: boolean;
  isSelected: boolean;
  isSchoolOff: boolean;
  kidColors: string[];
  onClick: () => void;
}) {
  let bg = "transparent";
  let textColor = cell.isCurrentMonth ? TEXT : `${TEXT}4D`; // 0.3 opacity for other-month
  let border = "none";

  if (isToday && !isSelected) {
    bg = SAGE;
    textColor = "#fff";
    border = `2px solid ${SKY}`;
  } else if (isSelected) {
    bg = SAGE;
    textColor = "#fff";
  } else if (isSchoolOff) {
    bg = SAGE_WASH;
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-lg transition-opacity hover:opacity-80"
      style={{
        height: 48,
        backgroundColor: bg,
        border,
        opacity: cell.isCurrentMonth ? 1 : 0.3,
      }}
    >
      <span
        style={{
          fontFamily: DM,
          fontSize: 13,
          fontWeight: isToday || isSelected ? 700 : 400,
          color: textColor,
          lineHeight: 1,
        }}
      >
        {cell.day}
      </span>
      <DotRow matchingKidColors={kidColors} isSchoolOff={isSchoolOff} />
    </button>
  );
}

function CalendarLegend({ kids }: { kids: KidProfile[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      {kids.slice(0, 4).map((kid) => (
        <div key={kid.id} className="flex items-center gap-1">
          <span
            className="inline-block rounded-full"
            style={{ width: 8, height: 8, backgroundColor: kid.color, flexShrink: 0 }}
          />
          <span style={{ fontFamily: DM, fontSize: 10, fontWeight: 500, color: MUTED }}>
            {kid.nickname}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <span
          className="inline-block rounded"
          style={{ width: 10, height: 8, backgroundColor: SAGE_WASH, border: `1px solid ${BORDER}`, flexShrink: 0 }}
        />
        <span style={{ fontFamily: DM, fontSize: 10, fontWeight: 500, color: MUTED }}>School off</span>
      </div>
      <div className="flex items-center gap-1">
        <span
          className="inline-block rounded-full"
          style={{ width: 10, height: 10, backgroundColor: "transparent", border: `2px solid ${SKY}`, flexShrink: 0 }}
        />
        <span style={{ fontFamily: DM, fontSize: 10, fontWeight: 500, color: MUTED }}>Today</span>
      </div>
    </div>
  );
}

function OpenTimeBlock() {
  return (
    <div
      className="flex items-center justify-between rounded-xl border px-3 py-3"
      style={{ backgroundColor: `${SKY}08`, borderColor: `${SKY}20`, borderStyle: "dashed" }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ width: 28, height: 28, backgroundColor: `${SKY}15` }}
        >
          <Sun size={14} style={{ color: SKY }} />
        </div>
        <span style={{ fontFamily: DM, fontSize: 13, fontWeight: 500, color: "#5B98B8" }}>
          Open time — nothing scheduled
        </span>
      </div>
      <span
        className="rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity hover:opacity-70"
        style={{ backgroundColor: `${SKY}15`, color: "#5B98B8", fontFamily: DM, fontSize: 11, cursor: "pointer" }}
      >
        Find →
      </span>
    </div>
  );
}

function EventTimeRail({ startTime }: { startTime: string | null }) {
  if (!startTime) {
    return (
      <div className="flex w-11 flex-shrink-0 flex-col items-center justify-center">
        <span style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 600, color: MUTED, lineHeight: 1, letterSpacing: "0.03em", textTransform: "uppercase" }}>
          All day
        </span>
      </div>
    );
  }
  const [hStr] = startTime.split(":");
  const h = parseInt(hStr, 10);
  const hour = h % 12 || 12;
  const period = h >= 12 ? "PM" : "AM";
  return (
    <div className="flex w-11 flex-shrink-0 flex-col items-center justify-start pt-0.5">
      <span style={{ fontFamily: OUTFIT, fontSize: 16, fontWeight: 700, color: TEXT, lineHeight: 1 }}>
        {hour}
      </span>
      <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: "0.05em", textTransform: "uppercase", lineHeight: 1.2 }}>
        {period}
      </span>
    </div>
  );
}

function DayEventRow({ event }: { event: EventWithLocation }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl border px-3 py-2"
      style={{ backgroundColor: CARD, borderColor: BORDER, borderLeft: `3px solid ${SAGE}` }}
    >
      <EventTimeRail startTime={event.start_time ?? null} />
      <div className="min-w-0 flex-1">
        <p
          className="font-semibold leading-snug"
          style={{ fontFamily: DM, fontSize: 14, fontWeight: 600, color: TEXT }}
        >
          {stripProgramCode(event.title)}
        </p>
        {event.venue?.name && (
          <p style={{ fontFamily: DM, fontSize: 12, color: MUTED, marginTop: 2 }}>
            {event.venue.name}
          </p>
        )}
      </div>
    </div>
  );
}

function ProgramDayRow({ program }: { program: ProgramWithVenue }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl border px-3 py-2"
      style={{ backgroundColor: CARD, borderColor: BORDER, borderLeft: `3px solid ${SKY}` }}
    >
      <div className="flex w-11 flex-shrink-0 flex-col items-center justify-start pt-0.5">
        <span style={{ fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: SAGE, lineHeight: 1 }}>
          {program.schedule_start_time ? formatTime(program.schedule_start_time).split(" ")[0] : "—"}
        </span>
        {program.schedule_start_time && (
          <span style={{ fontFamily: OUTFIT, fontSize: 9, fontWeight: 700, color: MUTED, letterSpacing: "0.05em", textTransform: "uppercase", lineHeight: 1.2 }}>
            {formatTime(program.schedule_start_time).split(" ")[1] ?? ""}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="font-semibold leading-snug"
          style={{ fontFamily: DM, fontSize: 14, fontWeight: 600, color: TEXT }}
        >
          {stripProgramCode(program.name)}
        </p>
        {(program.provider_name ?? program.venue?.name) && (
          <p style={{ fontFamily: DM, fontSize: 12, color: MUTED, marginTop: 2 }}>
            {program.provider_name ?? program.venue?.name}
          </p>
        )}
      </div>
    </div>
  );
}

function DayDetailPanel({
  year,
  month,
  day,
  portalSlug,
  programs,
  schoolEvents,
}: {
  year: number;
  month: number;
  day: number;
  portalSlug: string;
  programs: ProgramWithVenue[];
  schoolEvents: SchoolCalendarEvent[];
}) {
  const dateKey = toDateKey(year, month, day);
  const t = today();
  const isToday = year === t.year && month === t.month && day === t.day;

  // Programs starting on this exact day
  const dayPrograms = programs.filter((p) => p.session_start === dateKey);

  // Events from API — fetches family-friendly events for the selected day
  const { data: rawDayEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["family-calendar-day-events", portalSlug, dateKey],
    queryFn: () => fetchDayEvents(portalSlug, dateKey),
    staleTime: 2 * 60 * 1000,
  });

  // Exclude adult content — tennis leagues (USTA/ALTA), adult class series, etc.
  // that bleed into the calendar via the family-friendly venue tag.
  const isAdultContent = (title: string) =>
    /\badult/i.test(title) || /\bUSTA\b/.test(title) || /\blines\b/i.test(title);
  const dayEvents = rawDayEvents.filter((e) => !isAdultContent(e.title));

  // School events active on this day
  const activeSE = schoolEvents.filter((se) => {
    const d = new Date(`${dateKey}T00:00:00`);
    const s = new Date(`${se.start_date}T00:00:00`);
    const e = new Date(`${se.end_date}T00:00:00`);
    return d >= s && d <= e;
  });

  const totalCount = dayPrograms.length + dayEvents.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: JAKARTA, fontSize: 16, fontWeight: 700, color: TEXT }}>
          {formatDayTitle(year, month, day)}
          {isToday && (
            <span
              className="ml-2 rounded-full px-1.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: `${SKY}15`, color: SKY, fontFamily: DM, fontSize: 11, verticalAlign: "middle" }}
            >
              Today
            </span>
          )}
        </span>
        {totalCount > 0 && (
          <span
            className="rounded-full px-2 py-0.5"
            style={{ backgroundColor: `${SKY}15`, color: SKY, fontFamily: DM, fontSize: 11, fontWeight: 600 }}
          >
            {totalCount}
          </span>
        )}
      </div>

      {/* School off notice */}
      {activeSE.length > 0 && (
        <div
          className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
          style={{ backgroundColor: SAGE_WASH, borderColor: `${SAGE}30` }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>🌿</span>
          <div>
            <p style={{ fontFamily: DM, fontSize: 13, fontWeight: 600, color: SAGE }}>
              {activeSE.map((se) => se.name).join(" · ")}
            </p>
            <p style={{ fontFamily: DM, fontSize: 11, color: MUTED, marginTop: 1 }}>
              No school today
            </p>
          </div>
        </div>
      )}

      {/* Open time block */}
      <OpenTimeBlock />

      {/* Programs starting today */}
      {dayPrograms.map((p) => (
        <ProgramDayRow key={p.id} program={p} />
      ))}

      {/* Events */}
      {loadingEvents && (
        <div
          className="rounded-xl border px-3 py-3"
          style={{ backgroundColor: CARD, borderColor: BORDER }}
        >
          <p style={{ fontFamily: DM, fontSize: 12, color: MUTED }}>Loading events…</p>
        </div>
      )}
      {dayEvents.map((e) => (
        <DayEventRow key={e.id} event={e} />
      ))}

      {/* Empty state */}
      {!loadingEvents && totalCount === 0 && activeSE.length === 0 && (
        <div
          className="rounded-xl border px-3 py-4"
          style={{ backgroundColor: CARD, borderColor: BORDER }}
        >
          <p style={{ fontFamily: DM, fontSize: 13, color: MUTED }}>
            Nothing scheduled for this day.
          </p>
        </div>
      )}
    </div>
  );
}

function MonthGridPanel({
  year,
  month,
  selectedDay,
  onSelectDay,
  schoolOffDates,
  kidDotsByDate,
  kids,
}: {
  year: number;
  month: number;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  schoolOffDates: Set<string>;
  kidDotsByDate: Map<string, string[]>;
  kids: KidProfile[];
}) {
  const t = today();
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  return (
    <div>
      <DayNamesRow />
      <div className="grid grid-cols-7 gap-0.5 mt-0.5">
        {cells.map((cell, i) => {
          const dateKey = toDateKey(cell.year, cell.month, cell.day);
          const isToday = cell.year === t.year && cell.month === t.month && cell.day === t.day;
          const isSelected = cell.isCurrentMonth && cell.day === selectedDay && cell.month === month && cell.year === year;
          const isSchoolOff = schoolOffDates.has(dateKey);
          const kidColors = kidDotsByDate.get(dateKey) ?? [];
          return (
            <DayCell
              key={i}
              cell={cell}
              isToday={isToday}
              isSelected={isSelected}
              isSchoolOff={isSchoolOff}
              kidColors={kidColors}
              onClick={() => {
                if (cell.isCurrentMonth) onSelectDay(cell.day);
              }}
            />
          );
        })}
      </div>
      <div className="mt-3">
        <CalendarLegend kids={kids} />
      </div>
    </div>
  );
}

// ---- Main component -------------------------------------------------------

export const CalendarView = memo(function CalendarView({
  portalSlug,
  activeKidIds = [],
  kids = [],
}: CalendarViewProps) {
  const t = today();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentYear, setCurrentYear] = useState(t.year);
  const [currentMonth, setCurrentMonth] = useState(t.month);
  const [selectedDay, setSelectedDay] = useState(t.day);

  const calendarKids = useMemo(
    () => (activeKidIds.length > 0 ? kids.filter((kid) => activeKidIds.includes(kid.id)) : kids),
    [activeKidIds, kids]
  );

  const schoolSystems = useMemo(
    () =>
      Array.from(
        new Set(
          calendarKids
            .map((kid) => kid.school_system)
            .filter((value): value is NonNullable<KidProfile["school_system"]> => Boolean(value))
        )
      ),
    [calendarKids]
  );

  const { data: schoolEvents = [] } = useQuery({
    queryKey: ["family-calendar-school", schoolSystems.join(",")],
    queryFn: () => fetchSchoolCalendar(schoolSystems),
    staleTime: 30 * 60 * 1000,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["family-calendar-programs", portalSlug],
    queryFn: () => fetchCalendarPrograms(portalSlug),
    staleTime: 2 * 60 * 1000,
  });

  // Build set of school-off dates for background coloring
  const schoolOffDates = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const ev of schoolEvents) {
      for (const d of expandDateRange(ev.start_date, ev.end_date)) {
        s.add(d);
      }
    }
    return s;
  }, [schoolEvents]);

  // Build map of date -> kid colors (from programs matching kid ages)
  const kidDotsByDate = useMemo<Map<string, string[]>>(() => {
    const m = new Map<string, string[]>();
    for (const prog of programs) {
      if (!prog.session_start) continue;
      const matchingKids = calendarKids.length > 0
        ? calendarKids.filter((k) => isAgeMatch(k.age, prog.age_min, prog.age_max))
        : [];
      if (matchingKids.length === 0) continue;
      const colors = matchingKids.map((k) => k.color);
      const existing = m.get(prog.session_start) ?? [];
      m.set(prog.session_start, [...existing, ...colors]);
    }
    return m;
  }, [calendarKids, programs]);

  const handlePrevMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDay(1);
  }, [currentMonth]);

  const handleNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDay(1);
  }, [currentMonth]);

  const handleToday = useCallback(() => {
    setCurrentYear(t.year);
    setCurrentMonth(t.month);
    setSelectedDay(t.day);
  }, [t.year, t.month, t.day]);

  // ---- Placeholder views for Week/Agenda -----------------------------------
  if (viewMode === "week" || viewMode === "agenda") {
    return (
      <div className="px-4 pb-10 pt-4 sm:px-0" style={{ backgroundColor: CANVAS }}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 style={{ fontFamily: JAKARTA, fontSize: 28, fontWeight: 800, color: TEXT }}>
            Calendar
          </h1>
          <ViewToggle active={viewMode} onChange={setViewMode} />
        </div>
        <div
          className="flex items-center justify-center rounded-[14px] border py-16"
          style={{ backgroundColor: CARD, borderColor: BORDER }}
        >
          <p style={{ fontFamily: DM, fontSize: 14, color: MUTED }}>
            {viewMode === "week" ? "Week view" : "Agenda view"} coming soon
          </p>
        </div>
      </div>
    );
  }

  // ---- Month view -----------------------------------------------------------

  const sharedMonthGrid = (
    <div
      className="rounded-[14px] border p-4"
      style={{ backgroundColor: CARD, borderColor: BORDER }}
    >
      <MonthNav
        year={currentYear}
        month={currentMonth}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
        onToday={handleToday}
      />
      <div className="mt-3">
        <MonthGridPanel
          year={currentYear}
          month={currentMonth}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          schoolOffDates={schoolOffDates}
          kidDotsByDate={kidDotsByDate}
          kids={calendarKids}
        />
      </div>
    </div>
  );

  const sharedDayDetail = (
    <div
      className="rounded-[14px] border p-4"
      style={{ backgroundColor: CARD, borderColor: BORDER }}
    >
      <DayDetailPanel
        year={currentYear}
        month={currentMonth}
        day={selectedDay}
        portalSlug={portalSlug}
        programs={programs}
        schoolEvents={schoolEvents}
      />
    </div>
  );

  return (
    <div className="px-4 pb-10 pt-4 sm:px-0" style={{ backgroundColor: CANVAS }}>
      {/* ------------------------------------------------------------------ */}
      {/* Header row                                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-4 flex items-center justify-between">
        <h1 style={{ fontFamily: JAKARTA, fontSize: 24, fontWeight: 800, color: TEXT }}>
          Calendar
        </h1>
        <div className="flex items-center gap-2">
          {/* Kid chips — show on all viewports */}
          <div className="flex items-center gap-1.5">
            {calendarKids.map((kid) => (
              <span
                key={kid.id}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
                style={{
                  borderColor: `${kid.color}50`,
                  backgroundColor: `${kid.color}15`,
                  fontFamily: DM,
                  fontSize: 11,
                  fontWeight: 600,
                  color: kid.color,
                }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{ width: 6, height: 6, backgroundColor: kid.color }}
                />
                {kid.nickname}
              </span>
            ))}
          </div>
          <ViewToggle active={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MOBILE: stack grid + detail                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4 sm:hidden">
        {sharedMonthGrid}
        {sharedDayDetail}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* DESKTOP: two-panel layout                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="hidden sm:flex gap-4 items-start">
        <div className="flex-1 min-w-0">{sharedMonthGrid}</div>
        <div className="w-80 flex-shrink-0">{sharedDayDetail}</div>
      </div>
    </div>
  );
});

export type { CalendarViewProps };
