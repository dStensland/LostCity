"use client";

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import type { EventWithLocation } from "@/lib/search";
import type { KidProfile } from "@/lib/types/kid-profiles";
import { useAuth } from "@/lib/auth-context";

// ---- Palette (Afternoon Field) -------------------------------------------

const CANVAS = "#F0EDE4";
const CARD = "#FAFAF6";
const SAGE = "#5E7A5E";
const AMBER = "#C48B1D";
const MOSS = "#7A9E7A";
const TEXT = "#1E2820";
const MUTED = "#756E63";
const BORDER = "#E0DDD4";
const SAGE_WASH = "#EEF2EE";

// ---- Props ---------------------------------------------------------------

interface WeekendPlannerProps {
  portalId: string;
  portalSlug: string;
  activeKidIds?: string[];
  kids?: KidProfile[];
}

// ---- Date helpers --------------------------------------------------------

function getWeekendDates(): { saturday: Date; sunday: Date } {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 6=Sat
  const daysUntilSat = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
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

async function fetchWeekendEvents(portalId: string): Promise<EventWithLocation[]> {
  const params = new URLSearchParams({
    date: "weekend",
    tags: "family-friendly",
    portal_id: portalId,
    limit: "30",
    useCursor: "true",
  });

  const res = await fetch(`/api/events?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.events ?? []) as EventWithLocation[];
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
        fontFamily: "DM Sans, system-ui, sans-serif",
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
        fontFamily: "DM Sans, system-ui, sans-serif",
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

  // Tint border to first assigned kid's color if assigned to exactly one kid
  const borderColor =
    assignedKids.length === 1
      ? `${assignedKids[0].color}30`
      : BORDER;

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      style={{
        display: "block",
        backgroundColor: CARD,
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${assignedKids.length === 1 ? assignedKids[0].color : SAGE}`,
        padding: 12,
        textDecoration: "none",
        transition: "box-shadow 0.15s",
      }}
    >
      {timeLabel && (
        <p
          style={{
            fontFamily: "Outfit, system-ui, sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.5px",
            color: timeColor,
            marginBottom: 4,
            textTransform: "uppercase",
          }}
        >
          {timeLabel}
        </p>
      )}

      <p
        style={{
          fontFamily: "Outfit, system-ui, sans-serif",
          fontSize: 14,
          fontWeight: 700,
          color: TEXT,
          lineHeight: 1.3,
          marginBottom: 4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {event.title}
      </p>

      {event.venue?.name && (
        <p
          style={{
            fontFamily: "DM Sans, system-ui, sans-serif",
            fontSize: 11,
            color: MUTED,
            marginBottom: assignedKids.length > 0 || event.is_free ? 6 : 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {event.venue.name}
        </p>
      )}

      {/* Kid dots + free badge row */}
      {(assignedKids.length > 0 || event.is_free) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Kid color dots */}
          {assignedKids.length > 0 && (
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {assignedKids.map((kid) => (
                <span
                  key={kid.id}
                  title={kid.nickname}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    backgroundColor: kid.color,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
              ))}
              {assignedKids.length === 1 && (
                <span
                  style={{
                    fontFamily: "DM Sans, system-ui, sans-serif",
                    fontSize: 10,
                    color: MUTED,
                  }}
                >
                  {assignedKids[0].nickname} only
                </span>
              )}
            </div>
          )}

          {/* Free badge */}
          {event.is_free && (
            <span
              style={{
                backgroundColor: `${MOSS}1A`,
                color: MOSS,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: "DM Sans, system-ui, sans-serif",
                padding: "2px 6px",
                borderRadius: 8,
              }}
            >
              Free
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

// ---- Add something card --------------------------------------------------

function AddSomethingCard() {
  return (
    <button
      disabled
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        backgroundColor: SAGE_WASH,
        borderRadius: 12,
        border: `1px solid ${SAGE}33`,
        padding: "16px 12px",
        cursor: "default",
        width: "100%",
        minHeight: 80,
      }}
    >
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: SAGE,
          lineHeight: 1,
        }}
      >
        +
      </span>
      <span
        style={{
          fontFamily: "DM Sans, system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 500,
          color: SAGE,
        }}
      >
        Add something
      </span>
    </button>
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
  isAuthenticated,
}: {
  label: string;
  date: Date;
  events: EventWithLocation[];
  portalSlug: string;
  activeKidIds: string[];
  kids: KidProfile[];
  isLoading: boolean;
  isAuthenticated: boolean;
}) {
  const shortDate = formatShortDate(date);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Column header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <p
          style={{
            fontFamily: "Outfit, system-ui, sans-serif",
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
            fontFamily: "DM Sans, system-ui, sans-serif",
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
        events.map((event) => {
          // Find which active kids are age-appropriate (simple: any active kid)
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
        })
      ) : isAuthenticated ? (
        <AddSomethingCard />
      ) : null}
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
  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      style={{
        display: "flex",
        gap: 12,
        backgroundColor: CARD,
        borderRadius: 14,
        border: `1px solid ${BORDER}`,
        padding: "10px 12px",
        textDecoration: "none",
        alignItems: "center",
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
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            sizes="56px"
            style={{ objectFit: "cover" }}
          />
        </div>
      )}

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "Outfit, system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 700,
            color: TEXT,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {event.title}
        </p>
        {event.venue?.name && (
          <p
            style={{
              fontFamily: "DM Sans, system-ui, sans-serif",
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
                fontFamily: "DM Sans, system-ui, sans-serif",
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

// ---- Main component ------------------------------------------------------

export const WeekendPlanner = memo(function WeekendPlanner({
  portalId,
  portalSlug,
  activeKidIds = [],
  kids = [],
}: WeekendPlannerProps) {
  const { authState } = useAuth();
  const isAuthenticated = authState === "authenticated";
  const { saturday, sunday } = getWeekendDates();
  const satStr = toDateString(saturday);
  const sunStr = toDateString(sunday);

  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ["family-weekend-events", portalId],
    queryFn: () => fetchWeekendEvents(portalId),
    staleTime: 60 * 1000,
  });

  // Split by day
  const satEvents = allEvents.filter((e) => e.start_date === satStr).slice(0, 4);
  const sunEvents = allEvents.filter((e) => e.start_date === sunStr).slice(0, 4);

  // Perfect For section: top events that have an image (prefer richer cards)
  const recommendations = allEvents
    .filter((e) => e.image_url)
    .slice(0, 3);
  // Fall back to any top events if no images
  const recEvents = recommendations.length >= 2 ? recommendations : allEvents.slice(0, 3);

  // Date range label
  const satLabel = saturday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const sunLabel = sunday.toLocaleDateString("en-US", { day: "numeric" });
  const dateRangeLabel = `${satLabel}–${sunLabel}`;

  const hasAnyEvents = !isLoading && allEvents.length === 0;

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
            fontFamily: "Outfit, system-ui, sans-serif",
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
            fontFamily: "DM Sans, system-ui, sans-serif",
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

      {/* ---- Full empty state ---- */}
      {hasAnyEvents && (
        <div
          style={{
            padding: "48px 20px",
            textAlign: "center",
          }}
        >
          <div
            className="inline-flex items-center justify-center rounded-2xl mb-4"
            style={{ width: 56, height: 56, backgroundColor: SAGE_WASH }}
          >
            <span style={{ fontSize: 28 }}>🌤️</span>
          </div>
          <p
            style={{
              fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
              fontSize: 16,
              fontWeight: 700,
              color: TEXT,
              marginBottom: 6,
            }}
          >
            Weekend is wide open
          </p>
          <p
            style={{
              fontFamily: "DM Sans, system-ui, sans-serif",
              fontSize: 13,
              color: MUTED,
              marginBottom: 16,
              maxWidth: 280,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Find family-friendly events happening this Saturday and Sunday.
          </p>
          <Link
            href={`/${portalSlug}?view=find&type=events&date=weekend`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 24px",
              borderRadius: 24,
              backgroundColor: SAGE,
              color: "#fff",
              fontFamily: "DM Sans, system-ui, sans-serif",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Browse weekend events →
          </Link>
        </div>
      )}

      {/* ---- Two-column Sat / Sun grid ---- */}
      {!hasAnyEvents && (
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
            isAuthenticated={isAuthenticated}
          />
          <DayColumn
            label={formatDayLabel(sunday)}
            date={sunday}
            events={sunEvents}
            portalSlug={portalSlug}
            activeKidIds={activeKidIds}
            kids={kids}
            isLoading={isLoading}
            isAuthenticated={isAuthenticated}
          />
        </div>
      )}

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
                fontFamily: "Outfit, system-ui, sans-serif",
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
              href={`/${portalSlug}?view=find&type=events&date=weekend`}
              style={{
                fontFamily: "DM Sans, system-ui, sans-serif",
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
