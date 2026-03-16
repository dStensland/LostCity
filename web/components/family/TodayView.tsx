"use client";

import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { useWeather } from "@/lib/hooks/useWeather";
import {
  Tag,
  ArrowRight,
  MapPin,
  Clock,
  SmileySticker,
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

// ---- Palette (Afternoon Field) --------------------------------------------
const CANVAS = "#F0EDE4";
const CARD = "#FAFAF6";
const SAGE = "#5E7A5E";
const AMBER = "#C48B1D";
const MOSS = "#7A9E7A";
const SKY = "#78B7D0";
const TEXT = "#1E2820";
const MUTED = "#756E63";
const BORDER = "#E0DDD4";
void CANVAS; // used as page-level bg in parent
void MOSS;
void SKY;

// ---- Types ---------------------------------------------------------------

interface TodayViewProps {
  portalId: string;
  portalSlug: string;
  activeKidIds?: string[];
  kids?: import("@/lib/types/kid-profiles").KidProfile[];
  desktopLayout?: boolean;
}

interface VenueCard {
  id: number;
  name: string;
  venue_type: string | null;
  neighborhood: string | null;
  image_url: string | null;
  address: string | null;
}

// ---- Helpers --------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 17) return "Good afternoon!";
  return "Good evening!";
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  // timeStr is "HH:MM:SS" or "HH:MM"
  const [hourStr, minStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  const min = minStr ?? "00";
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${min} ${period}`;
}

// ---- Data fetchers -------------------------------------------------------

async function fetchSchoolCalendar(): Promise<SchoolCalendarEvent[]> {
  const res = await fetch("/api/school-calendar?upcoming=true&limit=5");
  if (!res.ok) return [];
  const json = await res.json();
  return (json.events ?? []) as SchoolCalendarEvent[];
}

async function fetchRegistrationRadar(portalSlug: string): Promise<{
  opening_soon: ProgramWithVenue[];
  closing_soon: ProgramWithVenue[];
  filling_fast: ProgramWithVenue[];
}> {
  const res = await fetch(
    `/api/programs/registration-radar?portal=${encodeURIComponent(portalSlug)}`
  );
  if (!res.ok) return { opening_soon: [], closing_soon: [], filling_fast: [] };
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

async function fetchFeaturedEvent(portalId: string): Promise<EventWithLocation | null> {
  const params = new URLSearchParams({
    date: "today",
    tags: "family-friendly",
    portal_id: portalId,
    limit: "1",
    useCursor: "true",
  });
  const res = await fetch(`/api/events?${params.toString()}`);
  if (!res.ok) return null;
  const json = await res.json();
  const events = (json.events ?? []) as EventWithLocation[];
  return events[0] ?? null;
}

async function fetchExploreVenues(portalId: string): Promise<VenueCard[]> {
  const params = new URLSearchParams({
    portal_id: portalId,
    family_friendly: "true",
    limit: "6",
  });
  // Use the venue search endpoint — filter for family-friendly explore-able venues
  const res = await fetch(`/api/venues/search?q=family&limit=6&${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  // Only return venues that have a real image — placeholders degrade the carousel
  return ((json.venues ?? []) as VenueCard[]).filter((v) => v.image_url);
}

// ---- Shared sub-components -----------------------------------------------

function SectionLabel({
  text,
  color,
  rightSlot,
}: {
  text: string;
  color: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span
        style={{
          color,
          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
        }}
      >
        {text}
      </span>
      {rightSlot}
    </div>
  );
}

function SeeAllLink({
  href,
  label = "See all →",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="hover:opacity-70 transition-opacity"
      style={{ color: SAGE, fontSize: 12, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
    >
      {label}
    </Link>
  );
}

function SkeletonBlock({ height = 60 }: { height?: number }) {
  return (
    <div
      className="rounded-2xl animate-pulse"
      style={{ height, backgroundColor: BORDER }}
    />
  );
}

// ---- Section: Weather/Greeting Banner ------------------------------------

function WeatherPill({ temp, condition, emoji }: { temp: number; condition: string; emoji: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{
        backgroundColor: `${AMBER}18`,
        border: `1px solid ${AMBER}30`,
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
      <span
        style={{
          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
          fontSize: 12,
          fontWeight: 600,
          color: AMBER,
        }}
      >
        {temp}°F · {condition}
      </span>
    </div>
  );
}

function GreetingHeadline({ todayEventCount }: { todayEventCount: number | null }) {
  const greeting = getGreeting();
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const subtitle =
    todayEventCount === null
      ? "Loading…"
      : todayEventCount > 0
      ? `${todayEventCount} thing${todayEventCount !== 1 ? "s" : ""} happening after school`
      : "Explore what's on this week";

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
          fontSize: 32,
          fontWeight: 800,
          color: TEXT,
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        {greeting}
      </h1>
      <p
        style={{
          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
          fontSize: 13,
          color: MUTED,
          marginTop: 6,
        }}
      >
        {dateStr} · {subtitle}
      </p>
    </div>
  );
}

// ---- Section: Featured Event Hero ----------------------------------------

function FeaturedHero({
  event,
  isLoading,
  portalSlug,
  todayEventCount,
}: {
  event: EventWithLocation | null | undefined;
  isLoading: boolean;
  portalSlug: string;
  todayEventCount: number | null;
}) {
  if (isLoading) {
    return <SkeletonBlock height={160} />;
  }

  // When we have a featured event with an image — show it as hero
  if (event?.image_url) {
    return (
      <Link
        href={`/${portalSlug}?event=${event.id}`}
        className="block relative overflow-hidden"
        style={{ borderRadius: 16, height: 160 }}
      >
        <SmartImage
          src={event.image_url}
          alt={event.title}
          fill
          className="object-cover"
          sizes="(min-width: 640px) 640px, 100vw"
        />
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)",
            padding: "32px 14px 12px",
          }}
        >
          <p
            style={{
              color: "#fff",
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              opacity: 0.9,
              marginBottom: 2,
            }}
          >
            Happening Today
          </p>
          <p
            style={{
              color: "#fff",
              fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1.25,
            }}
          >
            {event.title}
          </p>
        </div>
      </Link>
    );
  }

  // Fallback: contextual card when no featured event has an image
  const hasEvents = (todayEventCount ?? 0) > 0;

  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: 16,
        background: "linear-gradient(135deg, #5E7A5E 0%, #6E8E6E 50%, #78B7D0 100%)",
        padding: "20px 18px 16px",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            style={{
              color: "rgba(255,255,255,0.7)",
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {hasEvents ? "Happening Today" : "This Week"}
          </p>
          <p
            style={{
              color: "#fff",
              fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
              fontSize: 20,
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            {hasEvents
              ? `${todayEventCount} thing${todayEventCount !== 1 ? "s" : ""} to do`
              : "Find your next adventure"}
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.75)",
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: 13,
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {hasEvents
              ? "After school, weekends, and everything in between."
              : "Browse family-friendly events, programs, and places."}
          </p>
        </div>
        <SmileySticker size={40} weight="fill" style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, marginTop: 2 }} />
      </div>
    </div>
  );
}

// ---- Section: Heads Up (school calendar) ---------------------------------

const SCHOOL_TYPE_EMOJI: Record<string, string> = {
  no_school: "🏠",
  half_day: "🕐",
  break: "🌸",
  holiday: "🎉",
  early_release: "⏰",
};

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

function HeadsUpSection({
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

// ---- Section: Registration Radar -----------------------------------------

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
      style={{ borderColor: BORDER }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            style={{
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: 14,
              fontWeight: 600,
              color: TEXT,
            }}
          >
            {program.name}
          </span>
          <RegistrationBadge status={program.registration_status} />
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {program.provider_name && (
            <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 11, color: MUTED }}>
              {program.provider_name}
            </span>
          )}
          <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 11, color: MUTED }}>
            {formatAgeRange(program.age_min, program.age_max)}
          </span>
          <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 11, color: MUTED }}>
            {formatCost(program.cost_amount, program.cost_period)}
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 11, color: urgencyColor, marginTop: 2 }}>
          {urgencyLabel}
        </p>
      </div>
      {program.registration_url && (
        <a
          href={program.registration_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 hover:opacity-80 transition-opacity mt-0.5"
          style={{
            color: AMBER,
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Register →
        </a>
      )}
    </div>
  );
}

function RegistrationRadarSection({
  radarData,
  isLoading,
}: {
  radarData:
    | { opening_soon: ProgramWithVenue[]; closing_soon: ProgramWithVenue[]; filling_fast: ProgramWithVenue[] }
    | undefined;
  isLoading: boolean;
}) {
  const urgentPrograms: Array<{
    program: ProgramWithVenue;
    urgencyLabel: string;
    urgencyColor: string;
  }> = [];

  if (radarData) {
    radarData.closing_soon.forEach((p) =>
      urgentPrograms.push({ program: p, urgencyLabel: "Registration closes soon", urgencyColor: "#C45A3B" })
    );
    radarData.filling_fast.forEach((p) =>
      urgentPrograms.push({ program: p, urgencyLabel: "Waitlist — act fast", urgencyColor: "#D97706" })
    );
    radarData.opening_soon.forEach((p) =>
      urgentPrograms.push({ program: p, urgencyLabel: "Registration opens soon", urgencyColor: SAGE })
    );
  }

  const has = urgentPrograms.length > 0;

  return (
    <section>
      <SectionLabel
        text="Registration Radar"
        color={AMBER}
        rightSlot={<Tag size={14} weight="bold" style={{ color: AMBER }} />}
      />
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <SkeletonBlock height={68} />
          <SkeletonBlock height={68} />
        </div>
      ) : has ? (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, padding: "0 14px" }}
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
        <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 13, color: MUTED }}>
          Nothing urgent right now — check the Programs tab for what's coming.
        </p>
      )}
    </section>
  );
}

// ---- Section: Go Explore (venue cards) -----------------------------------

function ExploreDestinationCard({ venue }: { venue: VenueCard }) {
  return (
    <div
      className="flex-shrink-0 overflow-hidden"
      style={{
        width: 164,
        borderRadius: 12,
        backgroundColor: CARD,
        border: `1px solid ${BORDER}`,
      }}
    >
      <div className="relative overflow-hidden" style={{ height: 80 }}>
        {venue.image_url ? (
          <SmartImage
            src={venue.image_url}
            alt={venue.name}
            fill
            className="object-cover"
            sizes="164px"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: "#D4E4D4" }}
          >
            <MapPin size={20} weight="duotone" style={{ color: SAGE }} />
          </div>
        )}
      </div>
      <div style={{ padding: "8px 10px" }}>
        <p
          className="line-clamp-1"
          style={{
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: 13,
            fontWeight: 700,
            color: TEXT,
            lineHeight: 1.3,
          }}
        >
          {venue.name}
        </p>
        {venue.neighborhood && (
          <p
            style={{
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: 11,
              color: MUTED,
              marginTop: 2,
            }}
          >
            {venue.neighborhood}
          </p>
        )}
      </div>
    </div>
  );
}

function GoExploreSection({
  venues,
  isLoading,
  portalSlug,
  desktopLabel = false,
}: {
  venues: VenueCard[] | undefined;
  isLoading: boolean;
  portalSlug: string;
  desktopLabel?: boolean;
}) {
  const labelText = desktopLabel ? "Family Favorites Nearby" : "Go Explore";
  const labelColor = desktopLabel ? AMBER : SAGE;
  const has = (venues?.length ?? 0) > 0;

  return (
    <section>
      <SectionLabel
        text={labelText}
        color={labelColor}
        rightSlot={<SeeAllLink href={`/${portalSlug}?view=find&type=venues`} />}
      />
      {isLoading ? (
        <div className="flex gap-2.5 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 rounded-xl animate-pulse" style={{ width: 140, height: 130, backgroundColor: BORDER }} />
          ))}
        </div>
      ) : has ? (
        <div className="flex gap-2.5 overflow-x-auto" style={{ scrollbarWidth: "none", paddingBottom: 2 }}>
          {venues!.map((v) => (
            <ExploreDestinationCard key={v.id} venue={v} />
          ))}
        </div>
      ) : (
        <Link
          href={`/${portalSlug}?view=find&type=venues`}
          className="hover:opacity-70 transition-opacity"
          style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 13, color: SAGE }}
        >
          Discover family-friendly spots nearby →
        </Link>
      )}
    </section>
  );
}

// ---- Section: After School Picks (today's events) ------------------------

// Tag pills with kid-colored backgrounds
function TagPill({ tag }: { tag: string }) {
  return (
    <span
      style={{
        backgroundColor: `${MOSS}26`, // 15% opacity
        color: MOSS,
        borderRadius: 8,
        padding: "2px 8px",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {tag}
    </span>
  );
}

// Geographic and redundant tags that add no discovery value on a family portal
const SUPPRESSED_TAGS = new Set([
  "family-friendly",
  "gwinnett",
  "dekalb",
  "fulton",
  "cobb",
  "atlanta",
  "georgia",
  "atl",
  "metro-atlanta",
]);

function AfterSchoolPickCard({
  event,
  portalSlug,
}: {
  event: EventWithLocation;
  portalSlug: string;
}) {
  const displayTags = (event.tags ?? [])
    .filter((t) => !SUPPRESSED_TAGS.has(t.toLowerCase()))
    .slice(0, 3);

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      className="block hover:opacity-80 transition-opacity"
    >
      <div
        className="rounded-xl"
        style={{
          backgroundColor: CARD,
          border: `1px solid ${BORDER}`,
          padding: "10px 14px",
        }}
      >
        <p
          className="leading-snug"
          style={{
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            marginBottom: 3,
          }}
        >
          {event.title}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {event.venue?.name && (
            <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 12, color: MUTED }}>
              {event.venue.name}
            </span>
          )}
          {event.start_time ? (
            <span
              className="flex items-center gap-1"
              style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 12, color: MUTED }}
            >
              <Clock size={11} />
              {formatTime(event.start_time)}
            </span>
          ) : event.is_all_day ? (
            <span
              className="flex items-center gap-1"
              style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 12, color: MUTED }}
            >
              <Clock size={11} />
              All day
            </span>
          ) : null}
          {event.is_free && (
            <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 12, fontWeight: 600, color: SAGE }}>
              Free
            </span>
          )}
        </div>
        {displayTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {displayTags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function AfterSchoolPicksSection({
  events,
  isLoading,
  portalSlug,
}: {
  events: EventWithLocation[] | undefined;
  isLoading: boolean;
  portalSlug: string;
}) {
  // Filter to after-school hours (start_time >= 14:00) to avoid adult
  // daytime events like tennis leagues that are tagged family-friendly.
  // Title exclusions:
  //   - /\badult/i  — explicit "Adult" programs (e.g. "Adult Beginner Swim")
  //   - /\bUSTA\b/  — USTA league matches (adult/competitive tennis, not family activities;
  //                   catches "ALTA / USTA Jr 3 Lines", "USTA Adult5 Lines", etc.)
  //   - /\blines\b/i — Tennis league terminology (e.g. "3 Lines", "5 Lines match")
  // All-day events are included regardless of time (but still title-filtered).
  const afterSchoolEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => {
      if (/\badult/i.test(e.title)) return false;
      if (/\bUSTA\b/.test(e.title)) return false;
      if (/\blines\b/i.test(e.title)) return false;
      if (e.is_all_day) return true;
      if (!e.start_time) return false;
      const hour = parseInt(e.start_time.split(":")[0] ?? "0", 10);
      return hour >= 14;
    });
  }, [events]);

  const has = afterSchoolEvents.length > 0;

  return (
    <section>
      <SectionLabel
        text="After School Picks"
        color={AMBER}
        rightSlot={
          has ? (
            <SeeAllLink href={`/${portalSlug}?view=find&type=events&date=today`} />
          ) : undefined
        }
      />
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <SkeletonBlock key={i} height={72} />
          ))}
        </div>
      ) : has ? (
        <div className="flex flex-col gap-2">
          {afterSchoolEvents.slice(0, 4).map((event) => (
            <AfterSchoolPickCard key={event.id} event={event} portalSlug={portalSlug} />
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl border px-4 py-4"
          style={{ backgroundColor: CARD, borderColor: BORDER }}
        >
          <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 13, fontWeight: 500, color: TEXT }}>
            Discover events near you
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 12, color: MUTED, marginTop: 2 }}>
            Family-friendly events, programs, and places to explore.
          </p>
          <Link
            href={`/${portalSlug}?view=find&type=events`}
            className="inline-flex items-center gap-1 mt-3 hover:opacity-70 transition-opacity"
            style={{
              color: SAGE,
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Browse all events <ArrowRight size={12} weight="bold" />
          </Link>
        </div>
      )}
    </section>
  );
}

// ---- Main component -------------------------------------------------------

export const TodayView = memo(function TodayView({
  portalId,
  portalSlug,
  activeKidIds = [],
  kids = [],
  desktopLayout = false,
}: TodayViewProps) {
  // Derive active kids for future age-based filtering
  const _selectedKids = activeKidIds.length > 0
    ? kids.filter((k) => activeKidIds.includes(k.id))
    : [];
  void _selectedKids;

  const weather = useWeather();

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

  const { data: featuredEvent, isLoading: loadingFeatured } = useQuery({
    queryKey: ["family-featured-event", portalId],
    queryFn: () => fetchFeaturedEvent(portalId),
    staleTime: 60 * 1000,
  });

  const { data: exploreVenues, isLoading: loadingVenues } = useQuery({
    queryKey: ["family-explore-venues", portalId],
    queryFn: () => fetchExploreVenues(portalId),
    staleTime: 10 * 60 * 1000,
  });

  // Suppress featured events with adult titles before passing to the hero.
  const safeFeaturedEvent = featuredEvent && /\badult/i.test(featuredEvent.title) ? null : featuredEvent;

  const todayEventCount = loadingToday ? null : (todayEvents?.length ?? 0);

  // ---- Desktop layout ------------------------------------------------------
  if (desktopLayout) {
    return (
      <div className="flex flex-col gap-6 px-5">
        {/* Top row: greeting + weather pill */}
        <div className="flex items-start justify-between pt-2">
          <GreetingHeadline todayEventCount={todayEventCount} />
          {!weather.loading && weather.condition && (
            <WeatherPill temp={weather.temp} condition={weather.condition} emoji={weather.emoji} />
          )}
        </div>

        {/* Featured hero */}
        <FeaturedHero
          event={safeFeaturedEvent}
          isLoading={loadingFeatured}
          portalSlug={portalSlug}
          todayEventCount={todayEventCount}
        />

        {/* Two-column grid */}
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 340px" }}>
          {/* Left column: Events */}
          <div className="flex flex-col gap-6">
            <AfterSchoolPicksSection
              events={todayEvents}
              isLoading={loadingToday}
              portalSlug={portalSlug}
            />
          </div>
          {/* Right column: Heads Up + Registration */}
          <div className="flex flex-col gap-6">
            <HeadsUpSection calendarData={calendarData} isLoading={loadingCalendar} />
            <RegistrationRadarSection radarData={radarData} isLoading={loadingRadar} />
          </div>
        </div>

        {/* Full-width bottom: Go Explore carousel */}
        <div className="pb-6">
          <GoExploreSection
            venues={exploreVenues}
            isLoading={loadingVenues}
            portalSlug={portalSlug}
            desktopLabel
          />
        </div>
      </div>
    );
  }

  // ---- Mobile layout -------------------------------------------------------
  return (
    <div className="flex flex-col gap-5 pb-8 max-w-2xl mx-auto" style={{ overflowX: "hidden" }}>
      {/* Greeting + Weather */}
      <div className="px-4 pt-2">
        {!weather.loading && weather.condition && (
          <div className="flex items-center justify-between mb-2">
            <WeatherPill temp={weather.temp} condition={weather.condition} emoji={weather.emoji} />
          </div>
        )}
        <GreetingHeadline todayEventCount={todayEventCount} />
      </div>

      <div className="flex flex-col gap-6 px-4">
        {/* Featured hero */}
        <FeaturedHero
          event={safeFeaturedEvent}
          isLoading={loadingFeatured}
          portalSlug={portalSlug}
          todayEventCount={todayEventCount}
        />

        {/* Heads Up */}
        <HeadsUpSection calendarData={calendarData} isLoading={loadingCalendar} />

        {/* Go Explore — carousel with bleed edge */}
        <section>
          <SectionLabel
            text="Go Explore"
            color={SAGE}
            rightSlot={<SeeAllLink href={`/${portalSlug}?view=find&type=venues`} />}
          />
          {loadingVenues ? (
            <div className="flex gap-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex-shrink-0 rounded-xl animate-pulse"
                  style={{ width: 140, height: 130, backgroundColor: BORDER }}
                />
              ))}
            </div>
          ) : (exploreVenues?.length ?? 0) > 0 ? (
            <div
              className="flex gap-2.5 overflow-x-auto"
              style={{ scrollbarWidth: "none", paddingBottom: 2, marginLeft: -16, paddingLeft: 16, marginRight: -16, paddingRight: 16 }}
            >
              {exploreVenues!.map((v) => (
                <ExploreDestinationCard key={v.id} venue={v} />
              ))}
            </div>
          ) : (
            <Link
              href={`/${portalSlug}?view=find&type=venues`}
              className="hover:opacity-70 transition-opacity"
              style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 13, color: SAGE }}
            >
              Discover family-friendly spots nearby →
            </Link>
          )}
        </section>

        {/* After School Picks */}
        <AfterSchoolPicksSection
          events={todayEvents}
          isLoading={loadingToday}
          portalSlug={portalSlug}
        />

        {/* Registration Radar */}
        <RegistrationRadarSection radarData={radarData} isLoading={loadingRadar} />
      </div>
    </div>
  );
});

export type { TodayViewProps };
