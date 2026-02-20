"use client";

import { memo, type CSSProperties } from "react";
import Link from "next/link";
import type { AroundMeItem, AroundMeSpot, AroundMeEvent } from "@/app/api/around-me/route";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";
import { getReflectionClass, getSpotReflectionClass } from "@/lib/card-utils";

interface Props {
  item: AroundMeItem;
  index?: number;
  portalSlug?: string;
  showDistance?: boolean;
  insideCluster?: boolean;
}

function formatDistance(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 1) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles * 10) / 10} mi`;
}

/** Returns a human-readable remaining-time or end-time string for a live event. */
function formatEventTiming(startTime: string | null, endTime: string | null, isAllDay: boolean): string {
  if (isAllDay) return "All day";
  const now = new Date();

  if (endTime) {
    const end = new Date(endTime);
    const diffMs = end.getTime() - now.getTime();
    if (diffMs <= 0) return "Ending soon";
    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 60) return `${diffMin}m left`;
    const diffHrs = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    if (diffHrs < 6) {
      return remMin > 0 ? `${diffHrs}h ${remMin}m left` : `${diffHrs}h left`;
    }
    // Far-out end time — just show the end time
    const h = end.getHours();
    const m = end.getMinutes();
    const period = h >= 12 ? "pm" : "am";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? `Til ${display}${period}` : `Til ${display}:${m.toString().padStart(2, "0")}${period}`;
  }

  // No end time — show how long ago it started
  if (startTime) {
    const start = new Date(startTime);
    const agoMs = now.getTime() - start.getTime();
    const agoMin = Math.round(agoMs / 60_000);
    if (agoMin < 60) return `Started ${agoMin}m ago`;
    const agoHrs = Math.floor(agoMin / 60);
    return `Started ${agoHrs}h ago`;
  }
  return "Live now";
}

/** Returns minutes until a spot closes, or null if unknown. */
function minutesUntilClose(closesAt: string | null): number | null {
  if (!closesAt) return null;
  // closesAt is formatted like "2am", "11:30pm" etc.
  const match = closesAt.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2] || "0", 10);
  const period = match[3].toLowerCase();
  if (period === "am" && h === 12) h = 0;
  if (period === "pm" && h !== 12) h += 12;

  const now = new Date();
  const closeDate = new Date(now);
  closeDate.setHours(h, m, 0, 0);
  // If close time is earlier than now, it's tomorrow (e.g. closes at 2am)
  if (closeDate <= now) closeDate.setDate(closeDate.getDate() + 1);

  return Math.round((closeDate.getTime() - now.getTime()) / 60_000);
}

// Spot card variant
function SpotCardContent({ spot, distance, portalSlug, showDistance = true, insideCluster = false }: { spot: AroundMeSpot; distance: number; portalSlug?: string; showDistance?: boolean; insideCluster?: boolean }) {
  const minsLeft = minutesUntilClose(spot.closesAt);
  const closingSoon = minsLeft !== null && minsLeft <= 60;
  const accentColor = closingSoon ? "var(--amber, #f59e0b)" : "var(--neon-green)";
  const reflectionClass = spot.venue_type ? getSpotReflectionClass(spot.venue_type) : "";

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?spot=${spot.slug}` : `/spots/${spot.slug}`}
      scroll={false}
      data-category={spot.venue_type || "other"}
      data-accent="spot"
      className={`block find-row-card rounded-xl border border-[var(--twilight)]/75 ${reflectionClass} overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] border-l-[2px] border-l-[var(--accent-color)]`}
      style={
        {
          "--accent-color": accentColor,
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
        } as CSSProperties
      }
    >
      <div className="flex items-start gap-3 p-3">
        {/* Type badge + icon column */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <span className={`font-mono text-[0.5rem] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            closingSoon
              ? "text-[#f59e0b] bg-[#f59e0b]/10"
              : "text-[var(--neon-green)] bg-[var(--neon-green)]/10"
          }`}>
            {closingSoon ? "Closing soon" : "Open"}
          </span>
          <span
            data-category={spot.venue_type || undefined}
            className="inline-flex items-center justify-center w-8 h-8 rounded category-chip"
          >
            <CategoryIcon type={spot.venue_type || "venue"} size={18} glow="subtle" />
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--cream)] leading-tight line-clamp-1 group-hover:text-[var(--coral)] transition-colors">
            {spot.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 text-sm">
            {spot.closesAt ? (
              <span className={`font-medium ${closingSoon ? "text-[#f59e0b]" : "text-[var(--neon-green)]"}`}>
                {closingSoon && minsLeft !== null
                  ? `${minsLeft}m left`
                  : `Til ${spot.closesAt}`}
              </span>
            ) : (
              <span className="text-[var(--muted)]">24 hrs</span>
            )}
            <span className="text-[var(--muted)]">·</span>
            <span className="text-[var(--soft)]">{spot.label}</span>
          </div>
          {spot.neighborhood && !insideCluster && (
            <p className="text-xs text-[var(--muted)] mt-1 truncate">
              {spot.neighborhood}
            </p>
          )}
        </div>

        {/* Distance — only show with GPS */}
        {showDistance && (
          <div className="flex-shrink-0 text-right">
            <span className="font-mono text-sm font-medium text-[var(--coral)]">
              {formatDistance(distance)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

// Event card variant
function EventCardContent({ event, distance, portalSlug, showDistance = true, insideCluster = false }: { event: AroundMeEvent; distance: number; portalSlug?: string; showDistance?: boolean; insideCluster?: boolean }) {
  const timing = formatEventTiming(event.start_time, event.end_time, event.is_all_day);
  const accentColor = event.category ? getCategoryColor(event.category) : "var(--neon-red)";
  const reflectionClass = getReflectionClass(event.category);

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
      scroll={false}
      data-category={event.category || "other"}
      data-accent={event.category ? "category" : ""}
      className={`block find-row-card rounded-xl border border-[var(--twilight)]/75 ${reflectionClass} overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] border-l-[2px] border-l-[var(--accent-color)]`}
      style={
        {
          "--accent-color": accentColor,
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
        } as CSSProperties
      }
    >
      <div className="flex items-start gap-3 p-3">
        {/* Type badge + icon column */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--neon-red)]/15 border border-[var(--neon-red)]/30">
            <span className="inline-flex rounded-full h-1.5 w-1.5 bg-[var(--neon-red)]" />
            <span className="font-mono text-[0.5rem] font-semibold text-[var(--neon-red)] uppercase tracking-wider">
              Live
            </span>
          </span>
          {event.category && (
            <span
              data-category={event.category}
              className="inline-flex items-center justify-center w-8 h-8 rounded category-chip"
            >
              <CategoryIcon type={event.category} size={18} glow="subtle" />
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--cream)] leading-tight line-clamp-2 group-hover:text-[var(--coral)] transition-colors">
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 text-sm">
            <span className="text-[var(--neon-red)] font-medium">
              {timing}
            </span>
            {event.venue && (
              <>
                <span className="text-[var(--muted)]">·</span>
                <span className="text-[var(--soft)] truncate max-w-[120px]">{event.venue.name}</span>
              </>
            )}
          </div>
          {event.venue?.neighborhood && !insideCluster && (
            <p className="text-xs text-[var(--muted)] mt-1 truncate">
              {event.venue.neighborhood}
            </p>
          )}
          {/* Price badge */}
          {event.is_free && (
            <span className="inline-flex items-center px-2 py-0.5 mt-1.5 rounded-full font-mono text-[0.6rem] font-semibold bg-[var(--neon-green)]/25 text-[var(--neon-green)] border border-[var(--neon-green)]/40">
              Free
            </span>
          )}
        </div>

        {/* Distance — only show with GPS */}
        {showDistance && (
          <div className="flex-shrink-0 text-right">
            <span className="font-mono text-sm font-medium text-[var(--coral)]">
              {formatDistance(distance)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function AroundMeCard({ item, index = 0, portalSlug, showDistance = true, insideCluster = false }: Props) {
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "";

  return (
    <div className={`animate-fade-in ${staggerClass}`}>
      {item.type === "spot" ? (
        <SpotCardContent
          spot={item.data as AroundMeSpot}
          distance={item.distance}
          portalSlug={portalSlug}
          showDistance={showDistance}
          insideCluster={insideCluster}
        />
      ) : (
        <EventCardContent
          event={item.data as AroundMeEvent}
          distance={item.distance}
          portalSlug={portalSlug}
          showDistance={showDistance}
          insideCluster={insideCluster}
        />
      )}
    </div>
  );
}

export default memo(AroundMeCard);
