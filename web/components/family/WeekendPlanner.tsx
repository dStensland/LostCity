"use client";

import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { useWeekendForecast } from "@/lib/hooks/useWeekendForecast";
import { matchesEnvironmentFilter } from "@/lib/family-constants";
import type { GenericFilter } from "./KidFilterChips";
import type { EventWithLocation } from "@/lib/search";
import type { KidProfile } from "@/lib/types/kid-profiles";
import { LibraryPassSection } from "./LibraryPassSection";
import { FamilyDestinationCard, type FamilyDestination } from "./FamilyDestinationCard";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";
import { buildExploreUrl } from "@/lib/find-url";

// ---- Palette (Afternoon Field) -------------------------------------------

const CANVAS = FAMILY_TOKENS.canvas;
const CARD = FAMILY_TOKENS.card;
const SAGE = FAMILY_TOKENS.sage;
const AMBER = FAMILY_TOKENS.amber;
const MOSS = FAMILY_TOKENS.moss;
const TEXT = FAMILY_TOKENS.text;
const MUTED = FAMILY_TOKENS.textSecondary;
const BORDER = FAMILY_TOKENS.border;

// ---- Font helpers --------------------------------------------------------

const FONT_HEADING = FAMILY_TOKENS.fontHeading;
const FONT_BODY = FAMILY_TOKENS.fontBody;

// ---- Title helpers -------------------------------------------------------

/** Strip raw program codes like "(BFP26103)" from display titles. */
function stripProgramCode(title: string): string {
  return title.replace(/\s*\([A-Z]{2,4}\d{4,6}\)\s*$/, "").trim();
}

/** Filter out adult-oriented and USTA events not appropriate for the family portal. */
function isAdultFiltered(title: string): boolean {
  return /\badult\b/i.test(title) || /\bUSTA\b/.test(title);
}

// ---- Props ---------------------------------------------------------------

interface WeekendPlannerProps {
  portalId: string;
  portalSlug: string;
  activeKidIds?: string[];
  kids?: KidProfile[];
  activeGenericFilters?: GenericFilter[];
}

// ---- Date helpers --------------------------------------------------------

function getWeekendDates(): { saturday: Date; sunday: Date } {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 6=Sat
  // On Sunday we're in the current weekend (yesterday was Saturday)
  // On Saturday we're in the current weekend
  // Any other day: advance to next Saturday
  let daysUntilSat: number;
  if (day === 6) {
    daysUntilSat = 0;   // today IS Saturday
  } else if (day === 0) {
    daysUntilSat = -1;  // yesterday was Saturday (we're in the weekend)
  } else {
    daysUntilSat = 6 - day; // days until next Saturday
  }
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSat);
  saturday.setHours(0, 0, 0, 0);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return { saturday, sunday };
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
}

function formatEventTime(startTime: string | null): string {
  if (!startTime) return "";
  // startTime is HH:MM:SS
  const [h, m] = startTime.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ---- Data fetcher --------------------------------------------------------

// Shape returned by /api/weekend — only the fields we render
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
  const params = new URLSearchParams({
    portal: portalSlug,
    limit: "60",
  });

  const res = await fetch(`/api/weekend?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();

  // The weekend API returns sections; flatten and de-duplicate across sections
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

  // Sort by start_date then start_time
  flat.sort((a, b) => {
    const dateCmp = a.start_date.localeCompare(b.start_date);
    if (dateCmp !== 0) return dateCmp;
    if (!a.start_time) return 1;
    if (!b.start_time) return -1;
    return a.start_time.localeCompare(b.start_time);
  });

  // Apply adult content filter and map to EventWithLocation shape
  return flat
    .filter((e) => !isAdultFiltered(e.title))
    .map((e) => ({
      ...e,
      // Alias category_id → category so DayEventCard renders it
      category: e.category_id,
      // Required Event fields not present in weekend API response
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

async function fetchWeekendDestinations(
  portalSlug: string,
  environment?: "indoor" | "outdoor"
): Promise<FamilyDestination[]> {
  const params = new URLSearchParams({ portal: portalSlug, limit: "6", sort: "popular" });
  if (environment) params.set("environment", environment);
  const res = await fetch(`/api/family/destinations?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.destinations ?? []) as FamilyDestination[];
}

// ---- Kid color helpers ---------------------------------------------------

function kidBgColor(hex: string): string {
  return `${hex}18`;
}

function kidBorderColor(hex: string): string {
  return `${hex}40`;
}

// ---- Kid chip ------------------------------------------------------------

function KidChip({
  kid,
  isActive,
  onClick,
}: {
  kid: KidProfile;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: 20,
        backgroundColor: isActive ? kidBgColor(kid.color) : "transparent",
        border: `1.5px solid ${isActive ? kidBorderColor(kid.color) : `${BORDER}`}`,
        fontFamily: FONT_BODY,
        fontSize: 12,
        fontWeight: 500,
        color: isActive ? kid.color : MUTED,
        cursor: "pointer",
        flexShrink: 0,
        transition: "all 0.15s",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: kid.color,
          flexShrink: 0,
        }}
      />
      {kid.nickname}
    </button>
  );
}

function AllKidsChip({
  isActive,
  onClick,
}: {
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 14px",
        borderRadius: 20,
        backgroundColor: isActive ? SAGE : "transparent",
        border: `1.5px solid ${isActive ? SAGE : BORDER}`,
        fontFamily: FONT_BODY,
        fontSize: 12,
        fontWeight: 500,
        color: isActive ? "#fff" : MUTED,
        cursor: "pointer",
        flexShrink: 0,
        transition: "all 0.15s",
      }}
    >
      All
    </button>
  );
}

// ---- Event card (two-column grid) ----------------------------------------

function DayEventCard({
  event,
  portalSlug,
  assignedKids,
}: {
  event: EventWithLocation;
  portalSlug: string;
  assignedKids: KidProfile[];
}) {
  const timeLabel = event.start_time ? formatEventTime(event.start_time) : null;
  const isFeatured = event.is_tentpole || false;
  const timeColor = isFeatured ? AMBER : SAGE;
  const displayTitle = stripProgramCode(event.title);

  // Tint border to first assigned kid's color if assigned to exactly one kid
  const accentColor =
    assignedKids.length === 1 ? assignedKids[0].color : SAGE;
  const borderColor =
    assignedKids.length === 1 ? `${assignedKids[0].color}28` : `${SAGE}28`;

  // Category/tag pills: prefer subcategory, fall back to category, then first tag
  const pills: string[] = [];
  if ((event as EventWithLocation & { subcategory?: string }).subcategory) {
    pills.push(
      ((event as EventWithLocation & { subcategory?: string }).subcategory as string)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  } else if (event.category) {
    pills.push(
      event.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }
  if (event.tags && Array.isArray(event.tags) && event.tags.length > 0) {
    const firstTag = event.tags[0] as string;
    const tagLabel = firstTag.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    // Avoid duplicating the category pill
    if (pills[0] !== tagLabel) pills.push(tagLabel);
  }
  const visiblePills = pills.slice(0, 2);

  const hasFooter = assignedKids.length > 0 || event.is_free || visiblePills.length > 0;

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      style={{
        display: "block",
        backgroundColor: CARD,
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${accentColor}`,
        padding: "10px 12px",
        textDecoration: "none",
        boxShadow: "0 1px 4px rgba(30,40,32,0.06)",
        transition: "box-shadow 0.15s",
      }}
    >
      {/* Time */}
      {timeLabel && (
        <p
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.5px",
            color: timeColor,
            marginBottom: 3,
            textTransform: "uppercase",
          }}
        >
          {timeLabel}
        </p>
      )}

      {/* Title */}
      <p
        style={{
          fontFamily: FONT_HEADING,
          fontSize: 13,
          fontWeight: 700,
          color: TEXT,
          lineHeight: 1.35,
          marginBottom: 3,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {displayTitle}
      </p>

      {/* Venue */}
      {event.venue?.name && (
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 11,
            color: MUTED,
            marginBottom: hasFooter ? 6 : 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {event.venue.name}
        </p>
      )}

      {/* Footer: category pills + kid dots + free badge */}
      {hasFooter && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          {/* Category/tag pills */}
          {visiblePills.map((pill) => (
            <span
              key={pill}
              style={{
                backgroundColor: `${SAGE}12`,
                color: SAGE,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: FONT_BODY,
                padding: "2px 7px",
                borderRadius: 8,
                letterSpacing: "0.1px",
                flexShrink: 0,
              }}
            >
              {pill}
            </span>
          ))}

          {/* Free badge */}
          {event.is_free && (
            <span
              style={{
                backgroundColor: `${MOSS}1A`,
                color: MOSS,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: FONT_BODY,
                padding: "2px 7px",
                borderRadius: 8,
                flexShrink: 0,
              }}
            >
              Free
            </span>
          )}

          {/* Kid color dots */}
          {assignedKids.length > 0 && (
            <div style={{ display: "flex", gap: 3, alignItems: "center", marginLeft: "auto" }}>
              {assignedKids.map((kid) => (
                <span
                  key={kid.id}
                  title={kid.nickname}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    backgroundColor: kid.color,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

// ---- Add something card --------------------------------------------------

function AddSomethingCard({
  portalSlug,
  dayLabel,
  dateString,
}: {
  portalSlug: string;
  dayLabel: string;
  dateString: string;
}) {
  const copy = `Browse events for ${dayLabel}`;
  const href = buildExploreUrl({
    portalSlug,
    lane: "events",
    extraParams: { date: dateString },
  });

  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: "#5E7A5E14",
        borderRadius: 12,
        border: `1.5px dashed ${SAGE}40`,
        padding: "18px 12px",
        width: "100%",
        minHeight: 88,
        textDecoration: "none",
        transition: "background-color 0.15s, border-color 0.15s",
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          backgroundColor: `${SAGE}14`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 600,
          color: SAGE,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        +
      </span>
      <span
        style={{
          fontFamily: FONT_BODY,
          fontSize: 12,
          fontWeight: 500,
          color: SAGE,
          textAlign: "center",
          lineHeight: 1.35,
        }}
      >
        {copy}
      </span>
    </Link>
  );
}

// ---- Day column ----------------------------------------------------------

function DayColumn({
  label,
  date,
  events,
  portalSlug,
  activeKidIds,
  kids,
  isLoading,
}: {
  label: string;
  date: Date;
  events: EventWithLocation[];
  portalSlug: string;
  activeKidIds: string[];
  kids: KidProfile[];
  isLoading: boolean;
}) {
  const shortDate = formatShortDate(date);
  // Friendly day label for "Browse events for Saturday" copy
  const friendlyDay = date.toLocaleDateString("en-US", { weekday: "long" });
  const dateString = toDateString(date);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Column header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <p
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "1px",
            color: SAGE,
            textTransform: "uppercase",
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 11,
            color: MUTED,
          }}
        >
          {shortDate}
        </p>
      </div>

      {/* Cards */}
      {isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : events.length > 0 ? (
        <>
          {events.map((event) => {
            const relevantKids = activeKidIds.length > 0
              ? kids.filter((k) => activeKidIds.includes(k.id))
              : [];
            return (
              <DayEventCard
                key={event.id}
                event={event}
                portalSlug={portalSlug}
                assignedKids={relevantKids}
              />
            );
          })}
          {/* "Add more" dashed card only appears when there are already events to add to */}
          <AddSomethingCard
            portalSlug={portalSlug}
            dayLabel={friendlyDay}
            dateString={dateString}
          />
        </>
      ) : (
        <AddSomethingCard
          portalSlug={portalSlug}
          dayLabel={friendlyDay}
          dateString={dateString}
        />
      )}
    </div>
  );
}

// ---- Skeleton card -------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      style={{
        backgroundColor: CARD,
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        padding: 12,
        height: 80,
      }}
    >
      <div
        style={{
          width: "60%",
          height: 10,
          borderRadius: 4,
          backgroundColor: BORDER,
          marginBottom: 8,
        }}
      />
      <div
        style={{
          width: "90%",
          height: 12,
          borderRadius: 4,
          backgroundColor: BORDER,
          marginBottom: 6,
        }}
      />
      <div
        style={{
          width: "50%",
          height: 10,
          borderRadius: 4,
          backgroundColor: BORDER,
        }}
      />
    </div>
  );
}

// ---- Recommendation card (Perfect For section) ---------------------------

function RecommendationCard({
  event,
  portalSlug,
}: {
  event: EventWithLocation;
  portalSlug: string;
}) {
  const displayTitle = stripProgramCode(event.title);
  const timeLabel = event.start_time ? formatEventTime(event.start_time) : null;

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      style={{
        display: "flex",
        gap: 12,
        backgroundColor: CARD,
        borderRadius: 14,
        border: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${SAGE}`,
        padding: "10px 12px",
        textDecoration: "none",
        alignItems: "center",
        boxShadow: "0 1px 4px rgba(30,40,32,0.06)",
      }}
    >
      {/* Image */}
      {event.image_url && (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            overflow: "hidden",
            flexShrink: 0,
            position: "relative",
          }}
        >
          <SmartImage
            src={event.image_url}
            alt={displayTitle}
            fill
            sizes="56px"
            style={{ objectFit: "cover" }}
          />
        </div>
      )}

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {timeLabel && (
          <p
            style={{
              fontFamily: FONT_HEADING,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.5px",
              color: SAGE,
              marginBottom: 2,
              textTransform: "uppercase",
            }}
          >
            {timeLabel}
          </p>
        )}
        <p
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 14,
            fontWeight: 700,
            color: TEXT,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayTitle}
        </p>
        {event.venue?.name && (
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              color: MUTED,
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.venue.name}
          </p>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
          {event.is_free && (
            <span
              style={{
                backgroundColor: `${MOSS}1A`,
                color: MOSS,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: FONT_BODY,
                padding: "2px 6px",
                borderRadius: 8,
              }}
            >
              Free
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---- Weekend forecast strip ----------------------------------------------

const SKY = "#78B7D0";
const RAIN_COLOR = SKY;
const SUN_COLOR = SAGE;

interface DayForecastPillProps {
  label: string; // "Saturday" | "Sunday"
  emoji: string;
  tempHigh: number;
  tempLow: number;
  condition: string;
}

function DayForecastPill({ label, emoji, tempHigh, tempLow, condition }: DayForecastPillProps) {
  const isRainy =
    condition.toLowerCase().includes("rain") ||
    condition.toLowerCase().includes("shower") ||
    condition.toLowerCase().includes("thunder") ||
    condition.toLowerCase().includes("drizzle");
  const pillColor = isRainy ? RAIN_COLOR : SUN_COLOR;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        backgroundColor: `${pillColor}14`,
        border: `1px solid ${pillColor}30`,
        borderRadius: 10,
        padding: "7px 12px",
        flex: 1,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            color: pillColor,
            marginBottom: 1,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            fontWeight: 600,
            color: TEXT,
            lineHeight: 1.2,
          }}
        >
          {tempHigh}° / {tempLow}°
        </p>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 10,
            color: MUTED,
            marginTop: 1,
          }}
        >
          {condition}
        </p>
      </div>
    </div>
  );
}

function WeekendForecastStrip({
  portalSlug,
}: {
  portalSlug: string;
}) {
  const { saturday, sunday, loading, hasRain } = useWeekendForecast();

  if (loading) {
    return (
      <div style={{ display: "flex", gap: 8, padding: "0 20px 12px" }}>
        {[1, 2].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 64,
              borderRadius: 10,
              backgroundColor: BORDER,
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    );
  }

  // Don't render if we have no forecast data
  if (!saturday && !sunday) return null;

  return (
    <div style={{ padding: "0 20px 4px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: hasRain ? 8 : 0 }}>
        {saturday && (
          <DayForecastPill
            label="Saturday"
            emoji={saturday.emoji}
            tempHigh={saturday.tempHigh}
            tempLow={saturday.tempLow}
            condition={saturday.condition}
          />
        )}
        {sunday && (
          <DayForecastPill
            label="Sunday"
            emoji={sunday.emoji}
            tempHigh={sunday.tempHigh}
            tempLow={sunday.tempLow}
            condition={sunday.condition}
          />
        )}
      </div>

      {/* Rain advisory: nudge toward indoor alternatives */}
      {hasRain && (
        <div
          style={{
            backgroundColor: `${SKY}10`,
            border: `1px solid ${SKY}30`,
            borderRadius: 8,
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 13 }}>☂️</span>
          <span
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              color: MUTED,
              lineHeight: 1.4,
            }}
          >
            Rain possible this weekend.{" "}
            <Link
              href={`/${portalSlug}?tab=programs`}
              style={{ color: SKY, fontWeight: 600 }}
            >
              See indoor options →
            </Link>
          </span>
        </div>
      )}
    </div>
  );
}

// ---- Budget Picks section ------------------------------------------------

/**
 * Compact horizontal scroll of free and low-cost weekend events.
 * Derives from existing fetched data — no additional API call.
 */
function BudgetPicksSection({
  events,
  portalSlug,
  isLoading,
}: {
  events: EventWithLocation[];
  portalSlug: string;
  isLoading: boolean;
}) {
  // Take free events first, then low-cost (price_max <= 15), cap at 4
  const freeEvents = events.filter((e) => e.is_free);
  const cheapEvents = events.filter(
    (e) =>
      !e.is_free &&
      e.price_max !== null &&
      e.price_max !== undefined &&
      (e.price_max as number) <= 15
  );
  const picks = [...freeEvents, ...cheapEvents].slice(0, 4);

  // Only render when we have at least 2 picks or we're loading
  if (!isLoading && picks.length < 2) return null;

  return (
    <div style={{ paddingTop: 20 }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px 10px",
        }}
      >
        <p
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "1.2px",
            color: AMBER,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Budget Picks
        </p>
        <Link
          href={buildExploreUrl({
            portalSlug,
            lane: "events",
            date: "weekend",
            extraParams: { free: "1" },
          })}
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: SAGE,
            textDecoration: "none",
          }}
        >
          All free →
        </Link>
      </div>

      {/* Horizontal scroll row */}
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          padding: "0 20px 4px",
          scrollbarWidth: "none",
        }}
      >
        {isLoading
          ? [1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  flexShrink: 0,
                  width: 160,
                  height: 96,
                  borderRadius: 12,
                  backgroundColor: BORDER,
                  opacity: 0.5,
                }}
              />
            ))
          : picks.map((event) => {
              const displayTitle = stripProgramCode(event.title);
              const timeLabel = event.start_time ? formatEventTime(event.start_time) : null;
              const priceLabel =
                event.is_free
                  ? "Free"
                  : event.price_max != null
                  ? `$${event.price_max}`
                  : null;

              return (
                <Link
                  key={event.id}
                  href={`/${portalSlug}?event=${event.id}`}
                  style={{
                    flexShrink: 0,
                    width: 160,
                    backgroundColor: CARD,
                    borderRadius: 12,
                    border: `1px solid ${BORDER}`,
                    borderTop: `3px solid ${AMBER}`,
                    padding: "10px 12px",
                    textDecoration: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    boxShadow: "0 1px 4px rgba(30,40,32,0.06)",
                  }}
                >
                  {/* Price badge */}
                  {priceLabel && (
                    <span
                      style={{
                        alignSelf: "flex-start",
                        fontFamily: FONT_BODY,
                        fontSize: 10,
                        fontWeight: 700,
                        color: event.is_free ? "#3D6B3D" : "#7A5C00",
                        backgroundColor: event.is_free ? "#5E7A5E14" : `${AMBER}14`,
                        borderRadius: 6,
                        padding: "2px 6px",
                        letterSpacing: "0.3px",
                      }}
                    >
                      {priceLabel}
                    </span>
                  )}

                  {/* Title */}
                  <p
                    style={{
                      fontFamily: FONT_HEADING,
                      fontSize: 13,
                      fontWeight: 700,
                      color: TEXT,
                      lineHeight: 1.3,
                      margin: 0,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {displayTitle}
                  </p>

                  {/* Venue + time */}
                  <p
                    style={{
                      fontFamily: FONT_BODY,
                      fontSize: 11,
                      color: MUTED,
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {timeLabel ? `${timeLabel} · ` : ""}{event.venue?.name ?? ""}
                  </p>
                </Link>
              );
            })}
      </div>
    </div>
  );
}

// ---- Weekend Destinations section ----------------------------------------

function WeekendDestinationsSection({
  destinations,
  isLoading,
  portalSlug,
  satIsRainy,
  sunIsRainy,
}: {
  destinations: FamilyDestination[];
  isLoading: boolean;
  portalSlug: string;
  satIsRainy: boolean;
  sunIsRainy: boolean;
}) {
  if (!isLoading && destinations.length === 0) return null;

  // Choose section header based on forecast
  let headerLabel = "Weekend Destinations";
  if (satIsRainy && !sunIsRainy) {
    headerLabel = "Indoor Picks for Saturday";
  } else if (!satIsRainy && sunIsRainy) {
    headerLabel = "Outdoor Picks for Sunday";
  } else if (satIsRainy && sunIsRainy) {
    headerLabel = "Indoor Activities This Weekend";
  }

  return (
    <div style={{ paddingTop: 20 }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px 10px",
        }}
      >
        <p
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "1.2px",
            color: SAGE,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          {headerLabel}
        </p>
        <Link
          href={buildExploreUrl({ portalSlug, lane: "places" })}
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: SAGE,
            textDecoration: "none",
          }}
        >
          All →
        </Link>
      </div>

      {/* Horizontal scroll row */}
      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          padding: "0 20px 4px",
          scrollbarWidth: "none",
        }}
      >
        {isLoading
          ? [1, 2].map((i) => (
              <div
                key={i}
                style={{
                  flexShrink: 0,
                  width: 260,
                  height: 200,
                  borderRadius: 14,
                  backgroundColor: BORDER,
                  opacity: 0.5,
                }}
              />
            ))
          : destinations.map((d) => (
              <FamilyDestinationCard
                key={d.id}
                destination={d}
                portalSlug={portalSlug}
                layout="carousel"
              />
            ))}
      </div>
    </div>
  );
}

// ---- Main component ------------------------------------------------------

export const WeekendPlanner = memo(function WeekendPlanner({
  // portalId kept in interface for API compatibility; slug is used for data fetching
  portalSlug,
  activeKidIds = [],
  kids = [],
  activeGenericFilters = [],
}: Omit<WeekendPlannerProps, "portalId"> & { portalId?: string }) {
  const { saturday, sunday } = getWeekendDates();
  const satStr = toDateString(saturday);
  const sunStr = toDateString(sunday);

  const indoorActive = activeGenericFilters.includes("indoor");
  const outdoorActive = activeGenericFilters.includes("outdoor");

  // Weekend forecast for destination environment prioritization
  const { saturday: satForecast, sunday: sunForecast } = useWeekendForecast();

  const satIsRainy =
    !!satForecast?.condition &&
    (satForecast.condition.toLowerCase().includes("rain") ||
      satForecast.condition.toLowerCase().includes("shower") ||
      satForecast.condition.toLowerCase().includes("thunder"));

  const sunIsRainy =
    !!sunForecast?.condition &&
    (sunForecast.condition.toLowerCase().includes("rain") ||
      sunForecast.condition.toLowerCase().includes("shower") ||
      sunForecast.condition.toLowerCase().includes("thunder"));

  // Prefer indoor when more rainy days, outdoor when more sunny days
  const weekendDestEnvironment: "indoor" | "outdoor" | undefined = (() => {
    const rainyCount = (satIsRainy ? 1 : 0) + (sunIsRainy ? 1 : 0);
    if (rainyCount >= 1) return "indoor";
    if (rainyCount === 0 && (satForecast || sunForecast)) return "outdoor";
    return undefined;
  })();

  const { data: weekendDestinations = [], isLoading: loadingDestinations } = useQuery({
    queryKey: ["family-weekend-destinations", portalSlug, weekendDestEnvironment],
    queryFn: () => fetchWeekendDestinations(portalSlug, weekendDestEnvironment),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ["family-weekend-events", portalSlug],
    queryFn: () => fetchWeekendEvents(portalSlug),
    staleTime: 60 * 1000,
  });

  // Apply indoor/outdoor filter if a chip is active
  const filteredEvents = useMemo(() => {
    if (indoorActive) {
      return allEvents.filter((e) =>
        matchesEnvironmentFilter(e.venue?.place_type, "indoor")
      );
    }
    if (outdoorActive) {
      return allEvents.filter((e) =>
        matchesEnvironmentFilter(e.venue?.place_type, "outdoor")
      );
    }
    return allEvents;
  }, [allEvents, indoorActive, outdoorActive]);

  // Split by day
  const satEvents = filteredEvents.filter((e) => e.start_date === satStr).slice(0, 4);
  const sunEvents = filteredEvents.filter((e) => e.start_date === sunStr).slice(0, 4);

  // Perfect For section: top events that have an image (prefer richer cards)
  const recommendations = filteredEvents
    .filter((e) => e.image_url)
    .slice(0, 3);
  // Fall back to any top events if no images
  const recEvents = recommendations.length >= 2 ? recommendations : filteredEvents.slice(0, 3);

  // Date range label
  const satLabel = saturday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const sunLabel = sunday.toLocaleDateString("en-US", { day: "numeric" });
  const dateRangeLabel = `${satLabel}–${sunLabel}`;

  return (
    <div style={{ backgroundColor: CANVAS, paddingBottom: 32 }}>
      {/* ---- Header ---- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          paddingTop: 16,
        }}
      >
        <h2
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 28,
            fontWeight: 800,
            color: TEXT,
            margin: 0,
          }}
        >
          This Weekend
        </h2>
        <span
          style={{
            fontFamily: FONT_BODY,
            fontSize: 14,
            fontWeight: 500,
            color: MUTED,
          }}
        >
          {dateRangeLabel}
        </span>
      </div>

      {/* ---- Kid filter chips ---- */}
      {kids.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 10,
            padding: "8px 20px",
            overflowX: "auto",
          }}
        >
          <AllKidsChip
            isActive={activeKidIds.length === 0}
            onClick={() => {/* parent controls kid filter state */}}
          />
          {kids.map((kid) => (
            <KidChip
              key={kid.id}
              kid={kid}
              isActive={activeKidIds.includes(kid.id)}
              onClick={() => {/* parent controls kid filter state */}}
            />
          ))}
        </div>
      )}

      {/* ---- Weekend weather forecast ---- */}
      <WeekendForecastStrip portalSlug={portalSlug} />

      {/* ---- Two-column Sat / Sun grid — always rendered, each column shows its own empty state ---- */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          padding: "4px 12px",
          maxWidth: 800,
        }}
      >
        <DayColumn
          label={formatDayLabel(saturday)}
          date={saturday}
          events={satEvents}
          portalSlug={portalSlug}
          activeKidIds={activeKidIds}
          kids={kids}
          isLoading={isLoading}
        />
        <DayColumn
          label={formatDayLabel(sunday)}
          date={sunday}
          events={sunEvents}
          portalSlug={portalSlug}
          activeKidIds={activeKidIds}
          kids={kids}
          isLoading={isLoading}
        />
      </div>

      {/* ---- Budget Picks ---- */}
      <BudgetPicksSection
        events={filteredEvents}
        portalSlug={portalSlug}
        isLoading={isLoading}
      />

      {/* ---- Weekend Destinations ---- */}
      <WeekendDestinationsSection
        destinations={weekendDestinations}
        isLoading={loadingDestinations}
        portalSlug={portalSlug}
        satIsRainy={satIsRainy}
        sunIsRainy={sunIsRainy}
      />

      {/* ---- Free with Library Card ---- */}
      <div style={{ paddingTop: 20 }}>
        <LibraryPassSection portalSlug={portalSlug} />
      </div>

      {/* ---- Perfect For This Weekend ---- */}
      {!isLoading && recEvents.length > 0 && (
        <div style={{ padding: "16px 20px 0", maxWidth: 800 }}>
          {/* Section header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <p
              style={{
                fontFamily: FONT_HEADING,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.2px",
                color: AMBER,
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              Perfect For This Weekend
            </p>
            <Link
              href={buildExploreUrl({
                portalSlug,
                lane: "events",
                date: "weekend",
              })}
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                color: SAGE,
                textDecoration: "none",
              }}
            >
              More →
            </Link>
          </div>

          {/* Recommendation cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recEvents.map((event) => (
              <RecommendationCard
                key={event.id}
                event={event}
                portalSlug={portalSlug}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export type { WeekendPlannerProps };
