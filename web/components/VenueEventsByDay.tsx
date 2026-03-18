"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import {
  format,
  parseISO,
  isSameDay,
  isToday,
  isTomorrow,
  addDays,
  startOfDay,
} from "date-fns";
import { formatTimeSplit, formatCompactCount } from "@/lib/formats";
import { getEffectiveDate } from "@/lib/event-grouping";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { FreeBadge } from "@/components/Badge";
import { getReflectionClass } from "@/lib/card-utils";

// Common event type that works with both EventDetailView and VenueDetailView
export type VenueEvent = {
  id: number;
  title: string;
  start_date: string;
  end_date?: string | null;
  start_time: string | null;
  is_free?: boolean;
  price_min?: number | null;
  category?: string | null;
  venue?: { id: number; name: string; slug: string } | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
  lineup?: string | null;
  artists?: {
    name: string;
    billing_order?: number | null;
    is_headliner?: boolean;
  }[];
};

interface VenueEventsByDayProps {
  events: VenueEvent[];
  onEventClick?: (eventId: number) => void; // For client-side navigation
  getEventHref?: (eventId: number) => string; // For SSR/Link-based navigation
  portalSlug?: string; // Alternative to getEventHref — pass from server components
  maxDates?: number; // Limit visible date tabs (default: 7)
  showDatePicker?: boolean; // Show "jump to date" option (default: false)
  compact?: boolean; // Smaller variant for detail pages (default: false)
  previewLimit?: number; // Limit visible events per date (default: 5)
}

const normalizeLabel = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildLineupSummary = (event: VenueEvent) => {
  const artists = event.artists || [];
  if (artists.length > 0) {
    const sorted = [...artists].sort((a, b) => {
      const aOrder = a.billing_order ?? 999;
      const bOrder = b.billing_order ?? 999;
      return aOrder - bOrder;
    });
    const headliner =
      sorted.find((artist) => artist.is_headliner)?.name || sorted[0]?.name;
    const supports = sorted
      .map((artist) => artist.name)
      .filter((name) => name && name !== headliner);

    if ((event.category === "sports" || event.category === "recreation") && sorted.length >= 2) {
      const matchup = `${sorted[0].name} vs ${sorted[1].name}`;
      if (normalizeLabel(matchup) !== normalizeLabel(event.title)) {
        return matchup;
      }
      return null;
    }

    if (supports.length > 0) {
      if (event.category === "comedy") {
        return `featuring ${supports.join(", ")}`;
      }
      return `with ${supports.join(", ")}`;
    }

    if (headliner && normalizeLabel(headliner) !== normalizeLabel(event.title)) {
      return headliner;
    }
  }

  const lineup = event.lineup?.trim();
  if (!lineup) return null;
  if (normalizeLabel(lineup) === normalizeLabel(event.title)) return null;
  return lineup;
};

export default function VenueEventsByDay({
  events,
  onEventClick,
  getEventHref: getEventHrefProp,
  portalSlug,
  maxDates = 7,
  showDatePicker = false,
  compact = false,
  previewLimit = 5,
}: VenueEventsByDayProps) {
  // Build getEventHref from prop or portalSlug fallback (safe for server components)
  const getEventHref = getEventHrefProp ?? (portalSlug ? (id: number) => `/${portalSlug}/events/${id}` : undefined);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDatePickerInput, setShowDatePickerInput] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState("");
  const [expanded, setExpanded] = useState(false);

  // Group events by effective date (ongoing multi-day events show as Today)
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, VenueEvent[]>();
    for (const event of events) {
      const dateKey = getEffectiveDate(event.start_date, event.end_date);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    }
    // Sort by date
    return new Map(
      [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
    );
  }, [events]);

  // Get unique dates for the selector
  const availableDates = useMemo(() => {
    return [...eventsByDate.keys()].map((dateStr) => parseISO(dateStr));
  }, [eventsByDate]);

  // Selected date state
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    return availableDates[0] || new Date();
  });

  // Get events for selected date
  const selectedEvents = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  // Progressive disclosure: show limited events by default
  const isPreviewEnabled = previewLimit > 0;
  const visibleEvents = useMemo(
    () => (!isPreviewEnabled || expanded ? selectedEvents : selectedEvents.slice(0, previewLimit)),
    [isPreviewEnabled, expanded, selectedEvents, previewLimit]
  );
  const hasMoreEvents = isPreviewEnabled && selectedEvents.length > previewLimit;

  // Format date label
  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tmrw";
    return format(date, "EEE");
  };

  // Handle date picker change
  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDatePickerValue(value);
    if (value) {
      const pickedDate = parseISO(value);
      // Find closest date with events
      const closestDate = availableDates.find(
        (d) => startOfDay(d) >= startOfDay(pickedDate)
      );
      if (closestDate) {
        setSelectedDate(closestDate);
        // Scroll to the selected date
        setTimeout(() => {
          const index = availableDates.findIndex((d) =>
            isSameDay(d, closestDate)
          );
          if (scrollRef.current && index >= 0) {
            const buttons = scrollRef.current.querySelectorAll("button");
            buttons[index]?.scrollIntoView({
              behavior: "smooth",
              inline: "center",
              block: "nearest",
            });
          }
        }, 100);
      }
    }
    setShowDatePickerInput(false);
  };

  // Don't render if no events
  if (events.length === 0) {
    return null;
  }

  // Single date - simplified view
  if (availableDates.length === 1) {
    return (
      <div className="space-y-2">
        {selectedEvents.map((event) => (
          <VenueEventCard
            key={event.id}
            event={event}
            onClick={onEventClick ? () => onEventClick(event.id) : undefined}
            href={getEventHref ? getEventHref(event.id) : undefined}
            compact={compact}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Date Selector */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-3 px-3"
        >
          {availableDates.slice(0, maxDates).map((date) => {
            const isSelected = isSameDay(date, selectedDate);
            const eventsOnDay =
              eventsByDate.get(format(date, "yyyy-MM-dd"))?.length || 0;

            return (
              <button
                key={date.toISOString()}
                onClick={() => {
                  setSelectedDate(date);
                  setExpanded(false);
                }}
                className={[
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full font-mono text-xs tracking-wide transition-all active:scale-95 border",
                  compact ? "px-2.5 py-1" : "px-3 py-1.5",
                  isSelected
                    ? "bg-[var(--coral)]/15 border-[var(--coral)]/40 text-[var(--coral)] font-semibold"
                    : "border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--coral)]/30 hover:bg-white/[0.02]",
                ].join(" ")}
              >
                <span>{formatDateLabel(date)}</span>
                <span className="tabular-nums font-semibold">{format(date, "d")}</span>
                {eventsOnDay > 1 && (
                  <span className={[
                    "text-2xs tabular-nums",
                    isSelected ? "opacity-70" : "opacity-40",
                  ].join(" ")}>
                    {eventsOnDay}
                  </span>
                )}
              </button>
            );
          })}

          {/* Show more indicator if there are more dates */}
          {availableDates.length > maxDates && !showDatePicker && (
            <span className="shrink-0 inline-flex items-center px-2 text-[var(--muted)] font-mono text-xs">
              +{availableDates.length - maxDates}
            </span>
          )}

          {/* Date Picker Button */}
          {showDatePicker && (
            <div className="shrink-0 relative">
              <button
                onClick={() => setShowDatePickerInput(!showDatePickerInput)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--coral)]/30 hover:text-[var(--coral)] transition-all font-mono text-xs"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>
              {showDatePickerInput && (
                <input
                  type="date"
                  value={datePickerValue}
                  onChange={handleDatePickerChange}
                  min={format(availableDates[0] || new Date(), "yyyy-MM-dd")}
                  max={format(
                    availableDates[availableDates.length - 1] ||
                      addDays(new Date(), 90),
                    "yyyy-MM-dd"
                  )}
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                  onBlur={() => setShowDatePickerInput(false)}
                  autoFocus
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Events for Selected Date */}
      <div className="space-y-2">
        {selectedEvents.length === 0 ? (
          <div className="text-center py-6 text-[var(--muted)] font-mono text-sm">
            No events on this date
          </div>
        ) : (
          <>
            {hasMoreEvents && (
              <p className="text-xs text-[var(--muted)]">
                Showing {visibleEvents.length} of {selectedEvents.length} events
              </p>
            )}
            {visibleEvents.map((event) => (
              <VenueEventCard
                key={event.id}
                event={event}
                onClick={onEventClick ? () => onEventClick(event.id) : undefined}
                href={getEventHref ? getEventHref(event.id) : undefined}
                compact={compact}
              />
            ))}
            {hasMoreEvents && (
              <button
                onClick={() => setExpanded((prev) => !prev)}
                className="w-full py-2.5 text-sm font-medium text-accent hover:text-[var(--cream)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors flex items-center justify-center gap-2"
              >
                {expanded ? "Show fewer events" : `See all ${selectedEvents.length} events`}
                <svg
                  className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Event card component — exported for reuse in VenueShowtimes
export function VenueEventCard({
  event,
  onClick,
  href,
  compact,
  subtitle,
}: {
  event: VenueEvent;
  onClick?: () => void;
  href?: string;
  compact: boolean;
  subtitle?: string;
}) {
  const { time, period } = formatTimeSplit(event.start_time);
  const accentColor = event.category ? getCategoryColor(event.category) : "var(--neon-magenta)";
  const accentClass = createCssVarClass("--accent-color", accentColor, "accent");
  const reflectionClass = getReflectionClass(event.category ?? null);
  const goingCount = event.going_count ?? 0;
  const interestedCount = event.interested_count ?? 0;
  const recommendationCount = event.recommendation_count ?? 0;
  const hasSocialProof = goingCount > 0 || interestedCount > 0 || recommendationCount > 0;
  const lineupSummary = buildLineupSummary(event);

  const cardContent = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {event.category && (
            <span
              className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded bg-accent-20"
            >
              <CategoryIcon type={event.category} size={10} glow="subtle" />
            </span>
          )}
          <h3
            className={`text-[var(--cream)] font-medium group-hover:text-[var(--coral)] transition-colors ${
              compact ? "text-sm leading-tight line-clamp-2" : "truncate"
            } [text-shadow:0_1px_6px_rgba(0,0,0,0.4)]`}
          >
            {event.title}
          </h3>
        </div>
        {subtitle && (
          <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{subtitle}</p>
        )}
        {lineupSummary && (
          <p className="mt-1 text-xs sm:text-xs text-[var(--cream)]/80 truncate">
            {lineupSummary}
          </p>
        )}
        <div
          className={`flex items-center gap-2 mt-1 text-[var(--muted)] ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {event.start_time && (
            <span className="font-mono tabular-nums">
              {time}
              {period && (
                <span className="ml-0.5 text-2xs uppercase tracking-[0.1em] text-[var(--muted)]">
                  {period}
                </span>
              )}
            </span>
          )}
          {event.is_free ? (
            <FreeBadge />
          ) : event.price_min ? (
            <span className="font-mono text-xs text-[var(--muted)]">From ${event.price_min}</span>
          ) : null}
        </div>
        {hasSocialProof && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {/* Mobile: collapsed social proof — single summary pill */}
            {(() => {
              const counts = [
                { type: "going" as const, count: goingCount, label: "going", color: "coral" },
                { type: "interested" as const, count: interestedCount, label: "maybe", color: "gold" },
                { type: "recommended" as const, count: recommendationCount, label: "rec'd", color: "lavender" },
              ];
              const dominant = counts.reduce((a, b) => (b.count > a.count ? b : a));
              const totalCount = goingCount + interestedCount + recommendationCount;
              if (totalCount <= 0) return null;
              return (
                <span className={`sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-xs font-medium ${
                  dominant.color === "coral"
                    ? "bg-[var(--coral)]/10 border border-[var(--coral)]/20 text-[var(--coral)]"
                    : dominant.color === "gold"
                      ? "bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)]"
                      : "bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 text-[var(--lavender)]"
                }`}>
                  {dominant.type === "going" && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {dominant.type === "recommended" && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  )}
                  {formatCompactCount(totalCount)} {dominant.label}
                </span>
              );
            })()}

            {/* Desktop: separate pills */}
            <span className="hidden sm:contents">
              {goingCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-xs font-medium text-[var(--coral)]">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {formatCompactCount(goingCount)} going
                </span>
              )}
              {interestedCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 font-mono text-xs font-medium text-[var(--gold)]">
                  {formatCompactCount(interestedCount)} maybe
                </span>
              )}
              {recommendationCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 font-mono text-xs font-medium text-[var(--lavender)]">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  {formatCompactCount(recommendationCount)} rec&apos;d
                </span>
              )}
            </span>
          </div>
        )}
      </div>
      <span className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </span>
    </div>
  );

  const cardClassName = `block w-full text-left find-row-card border border-[var(--twilight)]/75 ${reflectionClass} overflow-hidden group supports-[backdrop-filter]:backdrop-blur-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${
    compact ? "rounded-xl px-3 py-2.5" : "rounded-xl p-3 sm:p-3.5"
  } ${accentClass?.className ?? ""} ${event.category ? "border-l-[2px] border-l-[var(--accent-color)]" : ""}`;

  const cardStyle = {
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--night) 82%, transparent), color-mix(in srgb, var(--dusk) 64%, transparent))",
  } as const;

  if (href) {
    return (
      <>
        <ScopedStyles css={accentClass?.css} />
        <Link href={href} className={cardClassName} style={cardStyle} data-row-primary-link="true">
          {cardContent}
        </Link>
      </>
    );
  }

  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <button onClick={onClick} className={cardClassName} style={cardStyle} data-row-primary-link="true">
        {cardContent}
      </button>
    </>
  );
}
