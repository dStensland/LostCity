"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock, ArrowRight } from "@phosphor-icons/react";
import { useWeekendForecast } from "@/lib/hooks/useWeekendForecast";
import type { EventWithLocation } from "@/lib/event-search";
import { LibraryPassSection } from "../LibraryPassSection";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";
import { SectionLabel, SeeAllLink, SkeletonBlock } from "./_shared";
import { buildExploreUrl } from "@/lib/find-url";

const AMBER = FAMILY_TOKENS.amber;
const SAGE = FAMILY_TOKENS.sage;
const TEXT = FAMILY_TOKENS.text;
const MUTED = FAMILY_TOKENS.textSecondary;
const CARD = FAMILY_TOKENS.card;
const BORDER = FAMILY_TOKENS.border;

// ---- Weekend helpers -------------------------------------------------------

/** Returns YYYY-MM-DD for the coming Saturday (or today if Saturday, or yesterday if Sunday). */
function getWeekendDates(): { saturday: Date; sunday: Date } {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 6=Sat
  let daysUntilSat: number;
  if (day === 6) {
    daysUntilSat = 0;
  } else if (day === 0) {
    daysUntilSat = -1;
  } else {
    daysUntilSat = 6 - day;
  }
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSat);
  saturday.setHours(0, 0, 0, 0);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return { saturday, sunday };
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---- Weekend API event type ------------------------------------------------

type WeekendApiEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_free: boolean;
  is_all_day: boolean;
  image_url: string | null;
  category_id: string | null;
  tags: string[] | null;
  is_tentpole?: boolean;
  venue: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
  } | null;
};

async function fetchWeekendEvents(portalSlug: string): Promise<EventWithLocation[]> {
  const params = new URLSearchParams({ portal: portalSlug, limit: "60" });
  const res = await fetch(`/api/weekend?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  const sections = json.sections as Record<string, WeekendApiEvent[]> | undefined;
  if (!sections) return [];

  const seen = new Set<number>();
  const flat: WeekendApiEvent[] = [];
  for (const key of ["best_bets", "free", "easy_wins", "big_outings"] as const) {
    for (const e of sections[key] ?? []) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        flat.push(e);
      }
    }
  }
  flat.sort((a, b) => {
    const dateCmp = a.start_date.localeCompare(b.start_date);
    if (dateCmp !== 0) return dateCmp;
    if (!a.start_time) return 1;
    if (!b.start_time) return -1;
    return a.start_time.localeCompare(b.start_time);
  });

  // Filter adult content
  return flat
    .filter((e) => !/\badult\b/i.test(e.title) && !/\bUSTA\b/.test(e.title))
    .map((e) => ({
      ...e,
      category: e.category_id,
      description: null,
      end_date: null,
      end_time: null,
      source_url: "",
      genres: null,
      price_min: null,
      price_max: null,
      price_note: null,
    } as unknown as EventWithLocation));
}

// ---- WeekendEventRow -------------------------------------------------------

/** A simple weekend event row for the inline weekend section. */
function WeekendEventRow({
  event,
  portalSlug,
}: {
  event: EventWithLocation;
  portalSlug: string;
}) {
  const timeStr = event.start_time
    ? (() => {
        const [hStr, mStr] = event.start_time.split(":");
        const h = parseInt(hStr, 10);
        const m = mStr ?? "00";
        return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
      })()
    : null;

  const dateObj = new Date(`${event.start_date}T00:00:00`);
  const dayLabel = dateObj.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      className="block hover:opacity-80 transition-opacity"
    >
      <div
        className="flex items-start gap-3 rounded-xl"
        style={{
          backgroundColor: CARD,
          border: `1px solid ${BORDER}`,
          padding: "10px 14px",
        }}
      >
        {/* Day badge */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center rounded-lg"
          style={{
            width: 38,
            height: 38,
            backgroundColor: `${SAGE}12`,
            border: `1px solid ${SAGE}25`,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: 9,
              fontWeight: 700,
              color: SAGE,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              lineHeight: 1,
            }}
          >
            {dayLabel}
          </span>
          <span
            style={{
              fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
              fontSize: 15,
              fontWeight: 800,
              color: SAGE,
              lineHeight: 1.1,
            }}
          >
            {dateObj.getDate()}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className="leading-snug"
            style={{
              fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
              fontSize: 14,
              fontWeight: 600,
              color: TEXT,
              marginBottom: 2,
            }}
          >
            {event.title}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {event.venue?.name && (
              <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 11, color: MUTED }}>
                {event.venue.name}
              </span>
            )}
            {timeStr && (
              <span
                className="flex items-center gap-1"
                style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 11, color: MUTED }}
              >
                <Clock size={10} />
                {timeStr}
              </span>
            )}
            {event.is_free && (
              <span style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 11, fontWeight: 600, color: SAGE }}>
                Free
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---- WeekendForecastPillsCompact -------------------------------------------

/** Weekend forecast pill — compact version for the inline weekend section. */
function WeekendForecastPillsCompact() {
  const { saturday, sunday, loading } = useWeekendForecast();

  if (loading || (!saturday && !sunday)) return null;

  const { saturday: satDate, sunday: sunDate } = getWeekendDates();

  return (
    <div className="flex gap-2">
      {saturday && (
        <div
          className="flex items-center gap-2 flex-1 rounded-xl"
          style={{
            backgroundColor: `${AMBER}10`,
            border: `1px solid ${AMBER}28`,
            padding: "7px 10px",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>{saturday.emoji}</span>
          <div className="min-w-0">
            <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: "0.5px", textTransform: "uppercase", lineHeight: 1 }}>
              {formatShortDate(satDate)}
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 12, fontWeight: 600, color: TEXT, lineHeight: 1.2, marginTop: 1 }}>
              {saturday.tempHigh}° / {saturday.tempLow}°
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 10, color: MUTED, lineHeight: 1.3, marginTop: 1 }}>
              {saturday.condition}
            </p>
          </div>
        </div>
      )}
      {sunday && (
        <div
          className="flex items-center gap-2 flex-1 rounded-xl"
          style={{
            backgroundColor: `${AMBER}10`,
            border: `1px solid ${AMBER}28`,
            padding: "7px 10px",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>{sunday.emoji}</span>
          <div className="min-w-0">
            <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: "0.5px", textTransform: "uppercase", lineHeight: 1 }}>
              {formatShortDate(sunDate)}
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 12, fontWeight: 600, color: TEXT, lineHeight: 1.2, marginTop: 1 }}>
              {sunday.tempHigh}° / {sunday.tempLow}°
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 10, color: MUTED, lineHeight: 1.3, marginTop: 1 }}>
              {sunday.condition}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- WeekendSection --------------------------------------------------------

/** Inline weekend section — rendered at the bottom of TodayView. */
export function WeekendSection({
  portalSlug,
  prominent,
}: {
  portalSlug: string;
  prominent: boolean;
}) {
  const { data: weekendEventsRaw, isLoading } = useQuery({
    queryKey: ["family-weekend-events-inline", portalSlug],
    queryFn: () => fetchWeekendEvents(portalSlug),
    staleTime: 5 * 60 * 1000,
  });

  const { saturday: satDate, sunday: sunDate } = getWeekendDates();
  const satStr = formatShortDate(satDate);
  const sunStr = formatShortDate(sunDate);

  // Filter out events whose start_date is before today (stale weekend events).
  // The /api/weekend endpoint may cache results that include past dates.
  const todayStr = new Date().toISOString().split("T")[0];
  const weekendEvents = useMemo(
    () => (weekendEventsRaw ?? []).filter((e) => e.start_date >= todayStr),
    [weekendEventsRaw, todayStr]
  );

  const previewEvents = weekendEvents.slice(0, prominent ? 6 : 4);

  return (
    <section>
      {/* Section divider */}
      <div
        className="flex items-center gap-3 mb-4"
        style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}
      >
        <div>
          <SectionLabel
            text="This Weekend"
            color={SAGE}
            rightSlot={
              <SeeAllLink
                href={buildExploreUrl({ portalSlug, lane: "events", date: "weekend" })}
                label={`${satStr}–${sunStr} →`}
              />
            }
          />
        </div>
      </div>

      {/* Weekend forecast */}
      <div className="mb-4">
        <WeekendForecastPillsCompact />
      </div>

      {/* Weekend events */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <SkeletonBlock key={i} height={72} />
          ))}
        </div>
      ) : previewEvents.length > 0 ? (
        <div className="flex flex-col gap-2">
          {previewEvents.map((event) => (
            <WeekendEventRow key={event.id} event={event} portalSlug={portalSlug} />
          ))}
          {weekendEvents.length > previewEvents.length && (
            <Link
              href={buildExploreUrl({ portalSlug, lane: "events", date: "weekend" })}
              className="flex items-center justify-center py-3 rounded-xl border hover:opacity-80 transition-opacity"
              style={{
                borderColor: `${SAGE}30`,
                backgroundColor: `${SAGE}06`,
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 13,
                fontWeight: 600,
                color: SAGE,
              }}
            >
              See all weekend events <ArrowRight size={13} weight="bold" className="ml-1.5" />
            </Link>
          )}
        </div>
      ) : (
        <Link
          href={buildExploreUrl({ portalSlug, lane: "events", date: "weekend" })}
          className="hover:opacity-70 transition-opacity"
          style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", fontSize: 13, color: SAGE }}
        >
          Browse weekend activities →
        </Link>
      )}

      {/* Library pass callout — folded in from WeekendPlanner */}
      <div className="mt-6">
        <LibraryPassSection portalSlug={portalSlug} />
      </div>
    </section>
  );
}
