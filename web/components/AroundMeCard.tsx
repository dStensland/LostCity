"use client";

import { memo, type CSSProperties } from "react";
import Link from "next/link";
import type { AroundMeItem, AroundMeSpot, AroundMeEvent } from "@/app/api/around-me/route";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";
import { formatTimeSplit } from "@/lib/formats";
import { getReflectionClass, getSpotReflectionClass } from "@/lib/card-utils";

interface Props {
  item: AroundMeItem;
  index?: number;
  portalSlug?: string;
}

function formatDistance(miles: number): string {
  if (miles < 0.1) return "< 0.1 mi";
  if (miles < 1) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles * 10) / 10} mi`;
}

// Spot card variant
function SpotCardContent({ spot, distance, portalSlug }: { spot: AroundMeSpot; distance: number; portalSlug?: string }) {
  const accentColor = "var(--neon-green)";
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
          <span className="font-mono text-[0.5rem] font-semibold text-[var(--neon-green)] uppercase tracking-wider bg-[var(--neon-green)]/10 px-1.5 py-0.5 rounded">
            Open
          </span>
          <span
            data-category={spot.venue_type || undefined}
            className="inline-flex items-center justify-center w-8 h-8 rounded category-chip"
          >
            <span className="text-lg">{spot.icon}</span>
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--cream)] leading-tight line-clamp-1 group-hover:text-[var(--coral)] transition-colors">
            {spot.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 text-sm">
            {spot.closesAt ? (
              <span className="text-[var(--neon-green)] font-medium">
                Til {spot.closesAt}
                {spot.closingTimeInferred && (
                  <span className="text-[var(--muted)] ml-1 text-xs">(typical)</span>
                )}
              </span>
            ) : (
              <span className="text-[var(--muted)]">24 hrs</span>
            )}
            <span className="text-[var(--muted)]">·</span>
            <span className="text-[var(--soft)]">{spot.label}</span>
          </div>
          {spot.neighborhood && (
            <p className="text-xs text-[var(--muted)] mt-1 truncate">
              {spot.neighborhood}
            </p>
          )}
        </div>

        {/* Distance */}
        <div className="flex-shrink-0 text-right">
          <span className="font-mono text-sm font-medium text-[var(--coral)]">
            {formatDistance(distance)}
          </span>
        </div>
      </div>
    </Link>
  );
}

// Event card variant
function EventCardContent({ event, distance, portalSlug }: { event: AroundMeEvent; distance: number; portalSlug?: string }) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
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
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-40" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--neon-red)]" />
            </span>
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
              Started {time}
              {period && <span className="text-xs ml-0.5">{period}</span>}
            </span>
            {event.venue && (
              <>
                <span className="text-[var(--muted)]">·</span>
                <span className="text-[var(--soft)] truncate max-w-[120px]">{event.venue.name}</span>
              </>
            )}
          </div>
          {event.venue?.neighborhood && (
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

        {/* Distance */}
        <div className="flex-shrink-0 text-right">
          <span className="font-mono text-sm font-medium text-[var(--coral)]">
            {formatDistance(distance)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function AroundMeCard({ item, index = 0, portalSlug }: Props) {
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "";

  return (
    <div className={`animate-fade-in ${staggerClass}`}>
      {item.type === "spot" ? (
        <SpotCardContent
          spot={item.data as AroundMeSpot}
          distance={item.distance}
          portalSlug={portalSlug}
        />
      ) : (
        <EventCardContent
          event={item.data as AroundMeEvent}
          distance={item.distance}
          portalSlug={portalSlug}
        />
      )}
    </div>
  );
}

export default memo(AroundMeCard);
