"use client";

import { memo } from "react";
import Link from "next/link";
import { MapPin, Clock, ArrowRight, Sun, CloudRain } from "@phosphor-icons/react";
import type { BreakDayForecast } from "@/lib/hooks/useBreakForecast";
import type { ProgramWithVenue } from "@/lib/types/programs";
import { formatAgeRange, formatCost } from "@/lib/types/programs";
import type { EventWithLocation } from "@/lib/event-search";
import { RegistrationBadge } from "./RegistrationBadge";

// ---- Palette (Afternoon Field) -------------------------------------------
const CARD = "#FAFAF6";
const SAGE = "#5E7A5E";
const AMBER = "#C48B1D";
const SKY = "#78B7D0";
const TEXT = "#1E2820";
const MUTED = "#756E63";
const BORDER = "#E0DDD4";
const SAGE_WASH = "#EEF2EE";

// ---- Fonts ---------------------------------------------------------------
const JAKARTA = "var(--font-plus-jakarta-sans, system-ui, sans-serif)";
const DM = "var(--font-dm-sans, system-ui, sans-serif)";

// ---- Day accent colors ---------------------------------------------------
// Each day of the week gets a subtle accent to make the planner feel like
// a menu rather than a list. Alternates across the break week.
const DAY_ACCENTS = [
  SAGE,   // Monday
  SKY,    // Tuesday
  AMBER,  // Wednesday
  SAGE,   // Thursday
  SKY,    // Friday
];

// ---- Types ---------------------------------------------------------------

export interface DayPlanCardProps {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Monday", "Tuesday", etc.
  dateLabel: string; // "April 7"
  dayIndex: number; // 0-4 for accent color selection
  forecast: BreakDayForecast | null;
  forecastLoading: boolean;
  programs: ProgramWithVenue[];
  events: EventWithLocation[];
  eventsLoading: boolean;
  portalSlug: string;
}

// ---- Helpers -------------------------------------------------------------

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 || 12;
  return `${displayHour}:${m} ${period}`;
}

function stripProgramCode(name: string): string {
  return name.replace(/\s*\([A-Z]{2,4}\d{4,6}\)\s*$/, "").trim();
}

// ---- Weather pill --------------------------------------------------------

function WeatherPill({ forecast, loading }: { forecast: BreakDayForecast | null; loading: boolean }) {
  if (loading) {
    return (
      <div
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
        style={{ backgroundColor: `${BORDER}80`, height: 26 }}
        aria-label="Loading weather"
      >
        <div className="h-2 w-12 rounded-full animate-pulse" style={{ backgroundColor: BORDER }} />
      </div>
    );
  }

  if (!forecast) return null;

  const bgColor = forecast.isRainy ? `${SKY}18` : `${AMBER}14`;
  const borderColor = forecast.isRainy ? `${SKY}35` : `${AMBER}30`;
  const textColor = forecast.isRainy ? "#4A8BA5" : "#8B6515";

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{
        backgroundColor: bgColor,
        borderColor,
        color: textColor,
        fontFamily: DM,
        fontSize: 11,
      }}
    >
      {forecast.isRainy ? (
        <CloudRain size={11} weight="bold" />
      ) : (
        <Sun size={11} weight="bold" />
      )}
      <span>{forecast.emoji} {forecast.tempHigh}° · {forecast.condition}</span>
    </div>
  );
}

// ---- Best Bet card (hero pick) -------------------------------------------

function BestBetProgram({ program }: { program: ProgramWithVenue; portalSlug: string }) {
  const indoorOutdoor = program.venue?.indoor_outdoor;
  const envLabel = indoorOutdoor === "indoor" ? "Indoor" : indoorOutdoor === "outdoor" ? "Outdoor" : null;

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        backgroundColor: `${SAGE}08`,
        borderColor: `${SAGE}30`,
        borderLeft: `3px solid ${SAGE}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="font-semibold leading-snug"
            style={{ fontFamily: DM, fontSize: 14, fontWeight: 700, color: TEXT }}
          >
            {stripProgramCode(program.name)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {program.venue?.name && (
              <span
                className="inline-flex items-center gap-0.5"
                style={{ fontFamily: DM, fontSize: 11, color: MUTED }}
              >
                <MapPin size={10} />
                {program.venue.name}
              </span>
            )}
            {program.schedule_start_time && (
              <span
                className="inline-flex items-center gap-0.5"
                style={{ fontFamily: DM, fontSize: 11, color: MUTED }}
              >
                <Clock size={10} />
                {formatTime(program.schedule_start_time)}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <RegistrationBadge status={program.registration_status} />
            <span
              className="rounded-full border px-1.5 py-0.5"
              style={{
                fontFamily: DM,
                fontSize: 10,
                fontWeight: 600,
                color: MUTED,
                borderColor: BORDER,
                backgroundColor: CARD,
              }}
            >
              {formatAgeRange(program.age_min, program.age_max)}
            </span>
            {envLabel && (
              <span
                className="rounded-full border px-1.5 py-0.5"
                style={{
                  fontFamily: DM,
                  fontSize: 10,
                  fontWeight: 600,
                  color: envLabel === "Indoor" ? "#4A8BA5" : "#3D6B3D",
                  borderColor: envLabel === "Indoor" ? `${SKY}35` : `${SAGE}30`,
                  backgroundColor: envLabel === "Indoor" ? `${SKY}10` : `${SAGE}08`,
                }}
              >
                {envLabel}
              </span>
            )}
            <span
              className="font-semibold"
              style={{ fontFamily: DM, fontSize: 11, color: AMBER }}
            >
              {formatCost(program.cost_amount, program.cost_period)}
            </span>
          </div>
        </div>
        {program.registration_url && (
          <a
            href={program.registration_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85"
            style={{
              backgroundColor: SAGE,
              color: "#fff",
              fontFamily: DM,
              fontSize: 11,
            }}
          >
            Register
          </a>
        )}
      </div>
    </div>
  );
}

function BestBetEvent({ event, portalSlug }: { event: EventWithLocation; portalSlug: string }) {
  const href = `/${portalSlug}/events/${event.id}`;

  return (
    <Link
      href={href}
      className="block rounded-xl border p-3 transition-opacity hover:opacity-85"
      style={{
        backgroundColor: `${AMBER}06`,
        borderColor: `${AMBER}28`,
        borderLeft: `3px solid ${AMBER}`,
      }}
    >
      <p
        className="font-semibold leading-snug"
        style={{ fontFamily: DM, fontSize: 14, fontWeight: 700, color: TEXT }}
      >
        {event.title}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {event.venue?.name && (
          <span
            className="inline-flex items-center gap-0.5"
            style={{ fontFamily: DM, fontSize: 11, color: MUTED }}
          >
            <MapPin size={10} />
            {event.venue.name}
          </span>
        )}
        {event.start_time && (
          <span
            className="inline-flex items-center gap-0.5"
            style={{ fontFamily: DM, fontSize: 11, color: MUTED }}
          >
            <Clock size={10} />
            {formatTime(event.start_time)}
          </span>
        )}
        {event.is_free && (
          <span
            className="rounded-full px-1.5 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: `${SAGE}14`,
              color: SAGE,
              fontFamily: DM,
              fontSize: 10,
            }}
          >
            Free
          </span>
        )}
      </div>
    </Link>
  );
}

// ---- Also Great row (compact alternatives) --------------------------------

function AlsoGreatEvent({ event, portalSlug }: { event: EventWithLocation; portalSlug: string }) {
  return (
    <Link
      href={`/${portalSlug}/events/${event.id}`}
      className="flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-opacity hover:opacity-85"
      style={{ backgroundColor: CARD, borderColor: BORDER }}
    >
      <ArrowRight size={10} weight="bold" style={{ color: MUTED, flexShrink: 0 }} />
      <div className="min-w-0 flex-1">
        <p
          className="truncate font-medium"
          style={{ fontFamily: DM, fontSize: 12, color: TEXT }}
        >
          {event.title}
        </p>
        {event.venue?.name && (
          <p
            className="truncate"
            style={{ fontFamily: DM, fontSize: 10, color: MUTED }}
          >
            {event.venue.name}
          </p>
        )}
      </div>
      {event.start_time && (
        <span
          className="flex-shrink-0"
          style={{ fontFamily: DM, fontSize: 10, color: MUTED }}
        >
          {formatTime(event.start_time)}
        </span>
      )}
    </Link>
  );
}

function AlsoGreatProgram({ program }: { program: ProgramWithVenue }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-2.5 py-2"
      style={{ backgroundColor: CARD, borderColor: BORDER }}
    >
      <ArrowRight size={10} weight="bold" style={{ color: MUTED, flexShrink: 0 }} />
      <div className="min-w-0 flex-1">
        <p
          className="truncate font-medium"
          style={{ fontFamily: DM, fontSize: 12, color: TEXT }}
        >
          {stripProgramCode(program.name)}
        </p>
        {(program.venue?.name ?? program.provider_name) && (
          <p
            className="truncate"
            style={{ fontFamily: DM, fontSize: 10, color: MUTED }}
          >
            {program.venue?.name ?? program.provider_name}
          </p>
        )}
      </div>
      <span
        className="flex-shrink-0"
        style={{ fontFamily: DM, fontSize: 10, color: AMBER }}
      >
        {formatCost(program.cost_amount, program.cost_period)}
      </span>
    </div>
  );
}

// ---- Empty state ---------------------------------------------------------

function EmptyState({ date, portalSlug }: { date: string; portalSlug: string }) {
  const href = `/${portalSlug}?tab=programs`;
  return (
    <div
      className="rounded-xl border px-3 py-4"
      style={{ backgroundColor: SAGE_WASH, borderColor: `${SAGE}20`, borderStyle: "dashed" }}
    >
      <p style={{ fontFamily: DM, fontSize: 13, color: MUTED }}>
        No activities on our radar yet —{" "}
        <Link
          href={href}
          className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-75"
          style={{ color: SAGE }}
        >
          browse all options
        </Link>
      </p>
    </div>
  );
}

// ---- Main component -------------------------------------------------------

export const DayPlanCard = memo(function DayPlanCard({
  date,
  dayLabel,
  dateLabel,
  dayIndex,
  forecast,
  forecastLoading,
  programs,
  events,
  eventsLoading,
  portalSlug,
}: DayPlanCardProps) {
  const accentColor = DAY_ACCENTS[dayIndex % DAY_ACCENTS.length] ?? SAGE;

  // Prioritize: programs first (structured, registrable), then events
  const heroProgram = programs[0] ?? null;
  const heroEvent = !heroProgram ? (events[0] ?? null) : null;
  const hasHero = heroProgram !== null || heroEvent !== null;

  // Also-great: remaining programs (up to 2) + remaining events (up to 2)
  const alsoGreatPrograms = heroProgram ? programs.slice(1, 3) : programs.slice(0, 2);
  const alsoGreatEvents = heroProgram
    ? events.slice(0, 2)
    : events.slice(1, 3);

  const isEmpty = !hasHero && !eventsLoading && alsoGreatPrograms.length === 0 && alsoGreatEvents.length === 0;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: CARD, borderColor: BORDER }}
    >
      {/* Day header */}
      <div
        className="flex items-center justify-between gap-2 px-4 py-3 border-b"
        style={{
          backgroundColor: `${accentColor}10`,
          borderBottomColor: `${accentColor}25`,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-bold"
            style={{ fontFamily: JAKARTA, fontSize: 15, color: accentColor }}
          >
            {dayLabel}
          </span>
          <span
            style={{ fontFamily: DM, fontSize: 12, color: MUTED }}
          >
            {dateLabel}
          </span>
        </div>
        <WeatherPill forecast={forecast} loading={forecastLoading} />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2.5 p-3">
        {/* Best Bet section */}
        {hasHero && (
          <div>
            <p
              className="mb-1.5 text-xs font-bold uppercase tracking-wider"
              style={{ fontFamily: DM, fontSize: 10, color: accentColor, letterSpacing: "0.1em" }}
            >
              Best Bet
            </p>
            {heroProgram && <BestBetProgram program={heroProgram} portalSlug={portalSlug} />}
            {heroEvent && <BestBetEvent event={heroEvent} portalSlug={portalSlug} />}
          </div>
        )}

        {/* Loading state */}
        {eventsLoading && !hasHero && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-14 rounded-xl animate-pulse"
                style={{ backgroundColor: BORDER }}
              />
            ))}
          </div>
        )}

        {/* Also Great section */}
        {(alsoGreatPrograms.length > 0 || alsoGreatEvents.length > 0) && (
          <div>
            <p
              className="mb-1.5 text-xs font-bold uppercase tracking-wider"
              style={{ fontFamily: DM, fontSize: 10, color: MUTED, letterSpacing: "0.1em" }}
            >
              Also Great
            </p>
            <div className="flex flex-col gap-1.5">
              {alsoGreatPrograms.map((p) => (
                <AlsoGreatProgram key={p.id} program={p} />
              ))}
              {alsoGreatEvents.map((e) => (
                <AlsoGreatEvent key={e.id} event={e} portalSlug={portalSlug} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && <EmptyState date={date} portalSlug={portalSlug} />}

        {/* Browse all link */}
        {!isEmpty && (
          <Link
            href={`/${portalSlug}?tab=programs`}
            className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-75"
            style={{ fontFamily: DM, fontSize: 11, color: accentColor }}
          >
            More for this day
            <ArrowRight size={10} weight="bold" />
          </Link>
        )}
      </div>
    </div>
  );
});

