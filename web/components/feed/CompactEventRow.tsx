"use client";

/**
 * CompactEventRow — compact row for the Lineup event list.
 *
 * Layout: category accent border | time column | square thumbnail | title + venue | going badge.
 */

import Link from "next/link";
import type { FeedEventData } from "@/components/EventCard";
import Image from "@/components/SmartImage";
import { getCategoryColor } from "@/lib/category-config";
import CategoryIcon from "@/components/CategoryIcon";
import { Users } from "@phosphor-icons/react";
import { formatTime } from "@/lib/formats";

interface CompactEventRowProps {
  event: FeedEventData;
  portalSlug: string;
  isLast?: boolean;
}

export default function CompactEventRow({ event, portalSlug, isLast }: CompactEventRowProps) {
  const timeLabel = event.is_all_day ? "All Day" : formatTime(event.start_time);
  const catColor = getCategoryColor(event.category);
  const goingCount = event.going_count || 0;

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      scroll={false}
      className={[
        "flex items-stretch gap-3 pr-3 transition-colors hover:bg-white/[0.02] group",
        !isLast && "border-b border-[var(--twilight)]/30",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Category accent — 2px left border */}
      <div
        className="shrink-0 w-0.5 self-stretch rounded-full"
        style={{ backgroundColor: catColor }}
      />

      {/* Time column — dedicated, scannable */}
      <div className="shrink-0 w-14 min-h-[4.5rem] flex items-center justify-end py-3 pr-1">
        <span className="font-mono text-[0.6875rem] font-medium text-[var(--cream)] text-right leading-tight whitespace-nowrap">
          {timeLabel}
        </span>
      </div>

      {/* Square thumbnail */}
      <div className="shrink-0 w-16 h-16 self-center relative overflow-hidden rounded-lg">
        {event.image_url ? (
          <Image
            src={event.image_url}
            alt=""
            fill
            className="object-cover"
            sizes="64px"
            blurhash={event.blurhash}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: `color-mix(in srgb, ${catColor} 10%, var(--void))` }}
          >
            <CategoryIcon type={event.category || "other"} size={20} glow="none" weight="light" />
          </div>
        )}
      </div>

      {/* Event info — two lines */}
      <div className="min-w-0 flex-1 py-3 flex flex-col justify-center">
        <p className="text-[0.875rem] font-semibold text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors leading-snug">
          {event.title}
        </p>
        <p className="text-[0.75rem] text-[var(--muted)] truncate mt-0.5">
          {event.venue?.name}
          {event.venue?.neighborhood && (
            <span className="opacity-50">
              {" "}&middot; {event.venue.neighborhood}
            </span>
          )}
        </p>
      </div>

      {/* Going count badge — right-aligned */}
      {goingCount > 0 && (
        <div className="shrink-0 self-center pl-1">
          <span className="inline-flex items-center gap-1 font-mono text-[0.625rem] font-medium text-[var(--coral)]">
            <Users weight="bold" className="w-3 h-3" />
            {goingCount}
          </span>
        </div>
      )}
    </Link>
  );
}
