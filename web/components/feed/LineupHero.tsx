"use client";

/**
 * LineupHero — elevated featured event card for the Lineup section.
 *
 * Continues the Masthead's magazine energy: full-bleed image, gradient to void,
 * font-masthead title, time/category badges, going count.
 */

import Link from "next/link";
import Image from "@/components/SmartImage";
import { getCategoryColor, getCategoryLabel } from "@/lib/category-config";
import CategoryIcon from "@/components/CategoryIcon";
import { Users } from "@phosphor-icons/react";
import { formatTime } from "@/lib/formats";
import type { FeedEventData } from "@/components/EventCard";

interface LineupHeroProps {
  event: FeedEventData;
  portalSlug: string;
}

export default function LineupHero({ event, portalSlug }: LineupHeroProps) {
  const timeLabel = event.is_all_day ? "All Day" : formatTime(event.start_time);
  const catColor = getCategoryColor(event.category);
  const catLabel = getCategoryLabel(event.category);
  const goingCount = event.going_count || 0;

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      scroll={false}
      className="block rounded-xl overflow-hidden border border-[var(--twilight)]/30 transition-all hover:ring-1 hover:ring-[var(--coral)]/30 group mb-3"
    >
      <div className="relative h-48 sm:h-56 overflow-hidden">
        {event.image_url ? (
          <>
            <Image
              src={event.image_url}
              alt=""
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 768px) 100vw, 600px"
              blurhash={event.blurhash}
            />
            {/* Gradient ending at solid void to match Masthead treatment */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent" />
          </>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, ${catColor} 20%, #09090b), #09090b)`,
            }}
          >
            <CategoryIcon
              type={event.category || "other"}
              size={48}
              glow="none"
              weight="light"
            />
          </div>
        )}

        {/* Time badge — top-left */}
        <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg font-mono text-[0.75rem] font-bold text-white/90 leading-none">
          {timeLabel}
        </span>

        {/* Category pill — top-right */}
        <span
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg font-mono text-[0.625rem] font-bold uppercase tracking-wider leading-none"
          style={{ color: catColor }}
        >
          <CategoryIcon
            type={event.category || "other"}
            size={12}
            glow="none"
            weight="bold"
          />
          {catLabel}
        </span>

        {/* Bottom content — title, venue, going */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <p
            className="font-masthead text-[1.5rem] sm:text-[1.75rem] font-bold text-[var(--cream)] leading-tight group-hover:text-[var(--coral)] transition-colors line-clamp-2"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
          >
            {event.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-[0.8125rem] text-[var(--soft)] truncate">
              {event.venue?.name}
              {event.venue?.neighborhood && (
                <span className="text-[var(--muted)]">
                  {" "}&middot; {event.venue.neighborhood}
                </span>
              )}
            </p>
            {goingCount > 0 && (
              <span className="shrink-0 inline-flex items-center gap-1 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-full font-mono text-[0.625rem] font-medium text-[var(--coral)]">
                <Users weight="bold" className="w-3 h-3" />
                {goingCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
