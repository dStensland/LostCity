"use client";

/**
 * CompactEventRow — Neon Underground event row for the Lineup list.
 *
 * Layout: category glow edge | 80px thumbnail | title / venue·neighborhood / time·free·social
 * Featured/trending events get a stronger glow and tinted background.
 */

import Link from "next/link";
import type { FeedEventData } from "@/components/EventCard";
import Image from "@/components/SmartImage";
import { getCategoryColor } from "@/lib/category-config";
import CategoryIcon from "@/components/CategoryIcon";
import { Users, Lightning, Ticket } from "@phosphor-icons/react";
import { formatTime, getEventStatus } from "@/lib/formats";

interface CompactEventRowProps {
  event: FeedEventData;
  portalSlug: string;
  isLast?: boolean;
}

export default function CompactEventRow({ event, portalSlug, isLast }: CompactEventRowProps) {
  const catColor = getCategoryColor(event.category);
  const goingCount = event.going_count || 0;
  const isFeatured = event.is_tentpole || event.is_trending;

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

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      scroll={false}
      className={[
        "flex items-stretch gap-3 pr-3 transition-all group relative",
        !isLast && "border-b border-[var(--twilight)]/20",
      ]
        .filter(Boolean)
        .join(" ")}
      style={isFeatured ? {
        background: `linear-gradient(to right, color-mix(in srgb, ${catColor} 6%, transparent), transparent 60%)`,
      } : undefined}
    >
      {/* Category accent — gradient edge glow */}
      <div
        className="shrink-0 self-stretch rounded-r-full"
        style={{
          width: isFeatured ? "3px" : "2px",
          background: `linear-gradient(to bottom, ${catColor}, color-mix(in srgb, ${catColor} ${isFeatured ? "40%" : "20%"}, transparent))`,
        }}
      />

      {/* 80px thumbnail with subtle category ring */}
      <div
        className="shrink-0 w-20 h-20 self-center relative overflow-hidden rounded-xl my-2.5"
        style={{
          boxShadow: `0 0 0 1px color-mix(in srgb, ${catColor} 15%, transparent)`,
        }}
      >
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt=""
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="80px"
            blurhash={event.blurhash}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: `color-mix(in srgb, ${catColor} 10%, var(--void))` }}
          >
            <CategoryIcon type={event.category || "other"} size={24} glow="none" weight="light" />
          </div>
        )}
      </div>

      {/* Event info — three lines */}
      <div className="min-w-0 flex-1 py-3 flex flex-col justify-center gap-0.5">
        {/* Line 1: Title */}
        <p className="text-[0.875rem] font-semibold text-[var(--cream)] truncate group-hover:text-white transition-colors leading-snug">
          {event.title}
        </p>

        {/* Line 2: Venue · Neighborhood */}
        <p className="text-[0.75rem] text-[var(--muted)] truncate">
          {event.venue?.name}
          {event.venue?.neighborhood && (
            <span className="opacity-50">
              {" "}&middot; {event.venue.neighborhood}
            </span>
          )}
        </p>

        {/* Line 3: Time + badges */}
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={[
              "inline-flex items-center gap-1 font-mono text-[0.6875rem] font-medium leading-none",
              isLive ? "text-[var(--neon-red)]" : isSoon ? "text-[var(--neon-amber)]" : "text-[var(--soft)]",
            ].join(" ")}
          >
            {isLive && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--neon-red)]" />
              </span>
            )}
            {isSoon && <Lightning weight="fill" className="w-3 h-3" />}
            {timeStr}
          </span>

          {event.is_free && (
            <span className="inline-flex items-center gap-0.5 font-mono text-[0.5625rem] font-bold uppercase tracking-wider text-[var(--neon-green)]">
              <Ticket weight="bold" className="w-2.5 h-2.5" />
              Free
            </span>
          )}

          {goingCount > 0 && (
            <span
              className="inline-flex items-center gap-0.5 font-mono text-[0.5625rem] font-medium"
              style={{ color: catColor }}
            >
              <Users weight="bold" className="w-2.5 h-2.5" />
              {goingCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
