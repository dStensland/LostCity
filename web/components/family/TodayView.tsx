"use client";

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import {
  BellSimple,
  Lightning,
  Tag,
  CalendarCheck,
  Clock,
} from "@phosphor-icons/react";
import {
  SCHOOL_SYSTEM_LABELS,
  SCHOOL_EVENT_TYPE_LABELS,
  type SchoolCalendarEvent,
  type ProgramWithVenue,
  formatAgeRange,
  formatCost,
} from "@/lib/types/programs";
import type { EventWithLocation } from "@/lib/search";
import { RegistrationBadge } from "./RegistrationBadge";

interface TodayViewProps {
  portalId: string;
  portalSlug: string;
}

// ---- Data fetchers -------------------------------------------------------

async function fetchSchoolCalendar(): Promise<SchoolCalendarEvent[]> {
  const res = await fetch("/api/school-calendar?upcoming=true&limit=5");
  if (!res.ok) return [];
  const json = await res.json();
  return (json.events ?? []) as SchoolCalendarEvent[];
}

async function fetchRegistrationRadar(
  portalSlug: string
): Promise<{
  opening_soon: ProgramWithVenue[];
  closing_soon: ProgramWithVenue[];
  filling_fast: ProgramWithVenue[];
}> {
  const res = await fetch(
    `/api/programs/registration-radar?portal=${encodeURIComponent(portalSlug)}`
  );
  if (!res.ok)
    return { opening_soon: [], closing_soon: [], filling_fast: [] };
  return res.json();
}

async function fetchTodayEvents(portalId: string): Promise<EventWithLocation[]> {
  const params = new URLSearchParams({
    date: "today",
    tags: "family-friendly",
    portal_id: portalId,
    limit: "8",
    useCursor: "true",
  });
  const res = await fetch(`/api/events?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.events ?? []) as EventWithLocation[];
}

// ---- Sub-components ------------------------------------------------------

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span style={{ color: "var(--coral)" }}>{icon}</span>
      <h2
        className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]"
        style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
      >
        {title}
      </h2>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-[var(--muted)] py-3">{message}</p>
  );
}

// School calendar alert row
function CalendarAlert({ event }: { event: SchoolCalendarEvent }) {
  const startDate = new Date(event.start_date + "T00:00:00");
  const endDate = new Date(event.end_date + "T00:00:00");
  const isSingleDay = event.start_date === event.end_date;

  const dateLabel = isSingleDay
    ? startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const typeLabel = SCHOOL_EVENT_TYPE_LABELS[event.event_type];
  const systemLabel = SCHOOL_SYSTEM_LABELS[event.school_system];

  return (
    <div
      className="flex items-start gap-3 py-2.5 border-b last:border-b-0"
      style={{ borderColor: "var(--twilight, #E8E4DF)" }}
    >
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
        style={{ backgroundColor: "color-mix(in srgb, var(--coral) 10%, white)" }}
      >
        <CalendarCheck size={16} weight="duotone" style={{ color: "var(--coral)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] leading-snug">{event.name}</p>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          {typeLabel} · {systemLabel} · {dateLabel}
        </p>
      </div>
    </div>
  );
}

// Registration radar row
function RadarRow({
  program,
  urgencyLabel,
  urgencyColor,
}: {
  program: ProgramWithVenue;
  urgencyLabel: string;
  urgencyColor: string;
}) {
  return (
    <div
      className="flex items-start gap-3 py-2.5 border-b last:border-b-0"
      style={{ borderColor: "var(--twilight, #E8E4DF)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--cream)] truncate">{program.name}</span>
          <RegistrationBadge status={program.registration_status} />
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {program.provider_name && (
            <span className="text-xs text-[var(--muted)]">{program.provider_name}</span>
          )}
          <span className="text-xs text-[var(--muted)]">
            {formatAgeRange(program.age_min, program.age_max)}
          </span>
          <span className="text-xs text-[var(--muted)]">
            {formatCost(program.cost_amount, program.cost_period)}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: urgencyColor }}>
          {urgencyLabel}
        </p>
      </div>
      {program.registration_url && (
        <a
          href={program.registration_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-xs font-medium text-[var(--coral)] hover:opacity-80 transition-opacity mt-0.5"
        >
          Register →
        </a>
      )}
    </div>
  );
}

// Today event card — compact horizontal layout
function TodayEventCard({
  event,
  portalSlug,
}: {
  event: EventWithLocation;
  portalSlug: string;
}) {
  const hasImage = !!event.image_url;

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      className="flex items-start gap-3 py-2.5 border-b last:border-b-0 hover:bg-[var(--night)] rounded-lg px-1 -mx-1 transition-colors"
      style={{ borderColor: "var(--twilight, #E8E4DF)" }}
    >
      {hasImage && (
        <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden">
          <Image
            src={event.image_url!}
            alt={event.title}
            width={56}
            height={56}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] leading-snug line-clamp-2">
          {event.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {event.start_time && (
            <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
              <Clock size={11} />
              {event.start_time}
            </span>
          )}
          {event.venue?.name && (
            <span className="text-xs text-[var(--muted)] truncate">{event.venue.name}</span>
          )}
          {event.is_free && (
            <span className="text-xs font-medium text-emerald-700">Free</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---- Main component ------------------------------------------------------

export const TodayView = memo(function TodayView({ portalId, portalSlug }: TodayViewProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const { data: calendarData, isLoading: loadingCalendar } = useQuery({
    queryKey: ["family-school-calendar"],
    queryFn: fetchSchoolCalendar,
    staleTime: 5 * 60 * 1000,
  });

  const { data: radarData, isLoading: loadingRadar } = useQuery({
    queryKey: ["family-registration-radar", portalSlug],
    queryFn: () => fetchRegistrationRadar(portalSlug),
    staleTime: 2 * 60 * 1000,
  });

  const { data: todayEvents, isLoading: loadingToday } = useQuery({
    queryKey: ["family-today-events", portalId],
    queryFn: () => fetchTodayEvents(portalId),
    staleTime: 60 * 1000,
  });

  // Flatten radar results — closing soon is most urgent, then filling fast, then opening soon
  const urgentPrograms: Array<{
    program: ProgramWithVenue;
    urgencyLabel: string;
    urgencyColor: string;
  }> = [];

  if (radarData) {
    radarData.closing_soon.forEach((p) =>
      urgentPrograms.push({
        program: p,
        urgencyLabel: "Registration closes soon",
        urgencyColor: "var(--coral)",
      })
    );
    radarData.filling_fast.forEach((p) =>
      urgentPrograms.push({
        program: p,
        urgencyLabel: "Waitlist — act fast",
        urgencyColor: "#D97706",
      })
    );
    radarData.opening_soon.forEach((p) =>
      urgentPrograms.push({
        program: p,
        urgencyLabel: "Registration opens soon",
        urgencyColor: "#059669",
      })
    );
  }

  const hasCalendarAlerts = (calendarData?.length ?? 0) > 0;
  const hasRadarItems = urgentPrograms.length > 0;
  const hasTodayEvents = (todayEvents?.length ?? 0) > 0;

  return (
    <div className="px-4 py-5 space-y-6 max-w-2xl mx-auto">
      {/* Snapshot card */}
      <div
        className="rounded-xl p-4 border"
        style={{
          backgroundColor: "color-mix(in srgb, var(--coral) 6%, white)",
          borderColor: "color-mix(in srgb, var(--coral) 20%, white)",
        }}
      >
        <div className="flex items-start gap-3">
          <Lightning size={20} weight="fill" style={{ color: "var(--coral)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <p
              className="text-sm font-semibold text-[var(--cream)]"
              style={{ fontFamily: "var(--font-outfit, system-ui, sans-serif)" }}
            >
              {today}
            </p>
            {loadingToday ? (
              <p className="text-xs text-[var(--muted)] mt-0.5">Loading...</p>
            ) : (
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {hasTodayEvents
                  ? `${todayEvents!.length} family-friendly ${todayEvents!.length === 1 ? "activity" : "activities"} happening today`
                  : "No events found for today — check the Weekend tab"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Heads Up — school calendar alerts */}
      <section>
        <SectionHeader
          icon={<BellSimple size={14} weight="bold" />}
          title="Heads Up"
        />
        {loadingCalendar ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded-lg skeleton-shimmer-light" />
            ))}
          </div>
        ) : hasCalendarAlerts ? (
          <div
            className="bg-white rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--twilight, #E8E4DF)" }}
          >
            {calendarData!.map((event) => (
              <CalendarAlert key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState message="No school calendar alerts coming up." />
        )}
      </section>

      {/* Registration Radar */}
      <section>
        <SectionHeader
          icon={<Tag size={14} weight="bold" />}
          title="Registration Radar"
        />
        {loadingRadar ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 rounded-lg skeleton-shimmer-light" />
            ))}
          </div>
        ) : hasRadarItems ? (
          <div
            className="bg-white rounded-xl border overflow-hidden divide-y"
            style={{ borderColor: "var(--twilight, #E8E4DF)" }}
          >
            {urgentPrograms.slice(0, 5).map(({ program, urgencyLabel, urgencyColor }) => (
              <RadarRow
                key={program.id}
                program={program}
                urgencyLabel={urgencyLabel}
                urgencyColor={urgencyColor}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="Nothing urgent right now — check the Programs tab for what's coming." />
        )}
      </section>

      {/* After School / Today */}
      {(hasTodayEvents || loadingToday) && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader
              icon={<Lightning size={14} weight="bold" />}
              title="Happening Today"
            />
            <Link
              href={`/${portalSlug}?view=find&type=events&date=today`}
              className="text-xs font-medium text-[var(--coral)] hover:opacity-80 transition-opacity"
              style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
            >
              See all →
            </Link>
          </div>
          {loadingToday ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg skeleton-shimmer-light" />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden px-3" style={{ borderColor: "var(--twilight, #E8E4DF)" }}>
              {todayEvents!.slice(0, 6).map((event) => (
                <TodayEventCard key={event.id} event={event} portalSlug={portalSlug} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
});

export type { TodayViewProps };
