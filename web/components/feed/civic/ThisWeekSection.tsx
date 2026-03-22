"use client";

import { useMemo } from "react";
import Link from "next/link";
import { inferCivicIntent, INTENT_CONFIG } from "@/lib/civic-intent";
import type { CityPulseSection, CityPulseEventItem } from "@/lib/city-pulse/types";
import type { FeedEventData } from "@/components/EventCard";

// Static badge styles — dynamic class names are not picked up by Tailwind's
// build-time scan, so we map intent → full class string here.
const BADGE_STYLES: Record<string, string> = {
  volunteer: "bg-emerald-500/10 text-emerald-600",
  meeting: "bg-sky-500/10 text-sky-600",
  action: "bg-amber-500/10 text-amber-600",
  event: "bg-zinc-500/10 text-zinc-600",
};

type CivicEvent = FeedEventData & {
  contextual_label?: string;
  score?: number;
};

interface ThisWeekSectionProps {
  portalSlug: string;
  /** Events from CityPulse lineup sections. Pass lineupSections directly. */
  events: CityPulseSection[];
  /** Event IDs that belong to channels the user is subscribed to — these are sorted first. */
  subscribedChannelEventIds?: Set<number>;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenEvents(sections: CityPulseSection[]): CivicEvent[] {
  const seenIds = new Set<number>();
  const result: CivicEvent[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      if (item.item_type !== "event") continue;
      const event = (item as CityPulseEventItem).event as CivicEvent;
      if (seenIds.has(event.id)) continue;
      seenIds.add(event.id);
      result.push(event);
    }
  }

  return result;
}

/**
 * Re-sort events: subscribed channel events first, then ascending by start_date/start_time.
 * Limits to 8 after sorting.
 */
function sortAndLimit(
  events: CivicEvent[],
  subscribedIds: Set<number>,
  limit = 8,
): CivicEvent[] {
  return [...events]
    .sort((a, b) => {
      const aSubscribed = subscribedIds.has(a.id) ? 0 : 1;
      const bSubscribed = subscribedIds.has(b.id) ? 0 : 1;
      if (aSubscribed !== bSubscribed) return aSubscribed - bSubscribed;

      const aKey = `${a.start_date}T${a.start_time ?? "23:59:59"}`;
      const bKey = `${b.start_date}T${b.start_time ?? "23:59:59"}`;
      return aKey.localeCompare(bKey);
    })
    .slice(0, limit);
}

/**
 * Format a relative date label for events.
 * - Today:    "Today at 2 PM"
 * - Tomorrow: "Tomorrow at 9 AM"
 * - This week: "Wed at 7 PM"
 */
function formatRelativeDate(startDate: string, startTime: string | null): string {
  // Parse as local midnight to avoid TZ shift on date-only strings
  const eventDate = new Date(`${startDate}T00:00:00`);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (eventDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24),
  );

  const timeSuffix = startTime ? ` at ${formatTime12(startTime)}` : "";

  if (diffDays === 0) return `Today${timeSuffix}`;
  if (diffDays === 1) return `Tomorrow${timeSuffix}`;

  const dayName = eventDate.toLocaleDateString("en-US", { weekday: "short" });
  return `${dayName}${timeSuffix}`;
}

/** Convert "HH:MM:SS" → "2 PM" style. */
function formatTime12(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr ?? "0", 10);
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minuteLabel = minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
  return `${hour12}${minuteLabel} ${period}`;
}

function cleanTitle(raw: string): string {
  return raw.replace(/^Volunteer:\s*/i, "").trim();
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonCards() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading this week's events">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 rounded-lg border border-[var(--twilight)]/10"
        >
          <div
            className="shrink-0 h-5 w-16 rounded skeleton-shimmer"
            style={{ opacity: 0.15, animationDelay: `${i * 100}ms` }}
          />
          <div className="flex-1 space-y-2">
            <div
              className="h-3.5 w-3/4 rounded-full skeleton-shimmer"
              style={{ opacity: 0.15, animationDelay: `${i * 100 + 50}ms` }}
            />
            <div
              className="h-3 w-1/2 rounded-full skeleton-shimmer"
              style={{ opacity: 0.1, animationDelay: `${i * 100 + 100}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ThisWeekSection({
  portalSlug,
  events: sections,
  subscribedChannelEventIds = new Set(),
  isLoading = false,
}: ThisWeekSectionProps) {
  const sortedEvents = useMemo(() => {
    const flat = flattenEvents(sections);
    return sortAndLimit(flat, subscribedChannelEventIds);
  }, [sections, subscribedChannelEventIds]);

  // Loading: show skeletons
  if (isLoading && sortedEvents.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider opacity-50">
          This Week
        </h2>
        <SkeletonCards />
      </section>
    );
  }

  // Too few events: render nothing — caller can show something else
  if (sortedEvents.length < 3) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider opacity-50">
        This Week
      </h2>

      <div className="space-y-2">
        {sortedEvents.map((event) => {
          const intent = inferCivicIntent(
            [...(event.tags ?? []), ...(event.genres ?? [])],
          );
          const badgeStyle = BADGE_STYLES[intent] ?? BADGE_STYLES.event;
          const intentLabel = INTENT_CONFIG[intent].label;
          const title = cleanTitle(event.title);
          const venueName = event.venue?.name ?? null;
          const dateLabel = formatRelativeDate(event.start_date, event.start_time);
          const metaParts = [venueName, dateLabel].filter(Boolean);
          const linkHref = event.ticket_url || event.source_url || `/${portalSlug}?event=${event.id}`;
          const isExternal = Boolean(event.ticket_url || event.source_url);

          return (
            <div
              key={event.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-[var(--twilight)]/10 hover:border-[var(--twilight)]/30 transition-colors"
            >
              {/* Intent badge */}
              <span
                className={`shrink-0 mt-0.5 px-2 py-0.5 rounded text-2xs font-medium ${badgeStyle}`}
                aria-label={`Intent: ${intentLabel}`}
              >
                {intentLabel}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-[var(--cream)] truncate">
                  {title}
                </h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {metaParts.join(" · ")}
                </p>
              </div>

              {/* Arrow link */}
              {isExternal ? (
                <a
                  href={linkHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${title}`}
                  className="shrink-0 text-xs opacity-40 hover:opacity-100 transition-opacity pt-0.5"
                >
                  →
                </a>
              ) : (
                <Link
                  href={linkHref}
                  scroll={false}
                  aria-label={`View ${title}`}
                  className="shrink-0 text-xs opacity-40 hover:opacity-100 transition-opacity pt-0.5"
                >
                  →
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <Link
        href={`/${portalSlug}/happening`}
        className="inline-block text-xs font-medium opacity-60 hover:opacity-100 transition-opacity"
      >
        See all events →
      </Link>
    </section>
  );
}

export type { ThisWeekSectionProps };
