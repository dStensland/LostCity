"use client";

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import type { EventWithLocation } from "@/lib/search";
import type { KidProfile } from "@/lib/types/kid-profiles";

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

// ---- Font helpers --------------------------------------------------------

const FONT_HEADING = "var(--font-plus-jakarta-sans, system-ui, sans-serif)";
const FONT_BODY = "var(--font-dm-sans, system-ui, sans-serif)";

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
  const href = `/${portalSlug}?view=find&type=events&date=${dateString}`;

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

// ---- Main component ------------------------------------------------------

export const WeekendPlanner = memo(function WeekendPlanner({
  // portalId kept in interface for API compatibility; slug is used for data fetching
  portalSlug,
  activeKidIds = [],
  kids = [],
}: Omit<WeekendPlannerProps, "portalId"> & { portalId?: string }) {
  const { saturday, sunday } = getWeekendDates();
  const satStr = toDateString(saturday);
  const sunStr = toDateString(sunday);

  const { data: allEvents = [], isLoading } = useQuery({
    queryKey: ["family-weekend-events", portalSlug],
    queryFn: () => fetchWeekendEvents(portalSlug),
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

  const isEmptyState = !isLoading && allEvents.length === 0;

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

      {/* ---- Full empty state ---- */}
      {isEmptyState && (
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
              fontFamily: FONT_HEADING,
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
              fontFamily: FONT_BODY,
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
              fontFamily: FONT_BODY,
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
      {!isEmptyState && (
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
              href={`/${portalSlug}?view=find&type=events&date=weekend`}
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
