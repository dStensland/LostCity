"use client";

/**
 * CompactEventRow — grid card for the Lineup event grid.
 *
 * Layout: image top (aspect 4:3) with solid category accent top-border,
 * then title / venue / time + badges below.
 */

import { useMemo } from "react";
import Link from "next/link";
import type { FeedEventData } from "@/components/EventCard";
import Image from "@/components/SmartImage";
import { getCategoryColor, getCategoryLabel } from "@/lib/category-config";
import CategoryIcon from "@/components/CategoryIcon";
import { Users, Lightning, Ticket } from "@phosphor-icons/react";
import { formatTime, getEventStatus } from "@/lib/formats";

interface CompactEventRowProps {
  event: FeedEventData;
  portalSlug: string;
  isLast?: boolean;
  /** "sm" = shorter image, tighter text, no category row */
  size?: "default" | "sm";
}

export default function CompactEventRow({ event, portalSlug, size = "default" }: CompactEventRowProps) {
  const isSm = size === "sm";
  const catColor = getCategoryColor(event.category);
  const catLabel = getCategoryLabel(event.category);
  const goingCount = event.going_count || 0;

  // Contextual time
  const status = getEventStatus(event.start_date, event.start_time);
  const isLive = status?.label === "NOW";
  const isSoon = status?.label === "Soon";
  const timeStr = event.is_all_day
    ? "All Day"
    : isLive
      ? "Now"
      : isSoon
        ? `Soon · ${formatTime(event.start_time)}`
        : formatTime(event.start_time);

  const cardStyle = useMemo(() => ({
    "--card-accent": catColor,
    "--card-accent-glow": `color-mix(in srgb, ${catColor} 15%, transparent)`,
  } as React.CSSProperties), [catColor]);

  const placeholderStyle = useMemo(() => ({
    background: `linear-gradient(160deg, color-mix(in srgb, ${catColor} 30%, var(--night)) 0%, color-mix(in srgb, ${catColor} 15%, var(--void)) 60%, var(--void) 100%)`,
  }), [catColor]);

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      scroll={false}
      className="block overflow-hidden transition-all group relative rounded-lg border border-[var(--twilight)]/30 hover:border-[var(--card-accent)]/40 hover:shadow-[0_0_12px_var(--card-accent-glow)]"
      style={cardStyle}
    >
      {/* Solid category accent — top border */}
      <div
        className={isSm ? "h-[2px]" : "h-[3px]"}
        style={{ backgroundColor: catColor }}
      />

      {/* Image */}
      <div className={`relative overflow-hidden ${isSm ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt=""
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 50vw, 33vw"
            blurhash={event.blurhash}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={placeholderStyle}
          >
            <span className="opacity-30">
              <CategoryIcon type={event.category || "other"} size={isSm ? 28 : 40} glow="subtle" weight="light" />
            </span>
          </div>
        )}

        {/* Time badge overlay — top-left */}
        <span
          className={[
            "absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-md font-mono text-2xs font-bold leading-none",
            "bg-black/60 backdrop-blur-sm",
            isLive ? "text-[var(--neon-red)]" : isSoon ? "text-[var(--neon-amber)]" : "text-white",
          ].join(" ")}
        >
          {isLive && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--neon-red)]" />
            </span>
          )}
          {isSoon && <Lightning weight="fill" className="w-2.5 h-2.5" />}
          {timeStr}
        </span>

        {/* Free badge — top-right */}
        {event.is_free && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-0.5 px-1.5 py-1 rounded-md font-mono text-2xs font-bold uppercase tracking-wider leading-none bg-black/60 backdrop-blur-sm text-[var(--neon-green)]">
            <Ticket weight="bold" className="w-2.5 h-2.5" />
            Free
          </span>
        )}
      </div>

      {/* Content — below image */}
      <div className={isSm ? "px-2 py-2 space-y-0.5" : "px-2.5 py-2.5 space-y-1"}>
        {/* Title */}
        <p className={`font-semibold text-[var(--cream)] group-hover:text-white transition-colors leading-snug ${isSm ? "text-xs line-clamp-1" : "text-sm line-clamp-2"}`}>
          {event.title}
        </p>

        {/* Venue · Neighborhood */}
        <p className="text-xs text-[var(--cream)]/70 truncate">
          {event.venue?.name}
          {event.venue?.neighborhood && (
            <span className="opacity-60">
              {" "}&middot; {event.venue.neighborhood}
            </span>
          )}
        </p>

        {/* Category + going — hidden in sm */}
        {!isSm && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 font-mono text-2xs font-semibold uppercase tracking-wider"
              style={{ color: catColor }}
            >
              <CategoryIcon type={event.category || "other"} size={10} glow="none" weight="bold" />
              {catLabel}
            </span>

            {goingCount > 0 && (
              <span
                className="inline-flex items-center gap-0.5 font-mono text-xs font-medium"
                style={{ color: catColor }}
              >
                <Users weight="bold" className="w-3 h-3" />
                {goingCount}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
