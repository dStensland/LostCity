"use client";

/**
 * LineupHero — Neon Underground featured event card.
 *
 * Full-bleed image with category-color gradient bleed, glassmorphic badges,
 * contextual time display (NOW / Soon / tonight 7pm), and accent glow.
 */

import Link from "next/link";
import Image from "@/components/SmartImage";
import { getCategoryColor, getCategoryLabel } from "@/lib/category-config";
import CategoryIcon from "@/components/CategoryIcon";
import { Users, Lightning, Ticket } from "@phosphor-icons/react";
import { formatTime, getEventStatus } from "@/lib/formats";
import type { FeedEventData } from "@/components/EventCard";
import { getCivicEventHref } from "@/lib/civic-routing";
import { usePublishEventSeed } from "@/lib/detail/publish-seed-helpers";
import { prefetchDetailView } from "@/lib/detail/prefetch-detail-view";

interface LineupHeroProps {
  event: FeedEventData;
  portalSlug: string;
  vertical?: string | null;
}

/** Build a contextual time string: "NOW", "Soon · 7pm", "Tonight 8pm", "All Day" */
function buildTimeDisplay(event: FeedEventData): {
  label: string;
  isLive: boolean;
  isSoon: boolean;
} {
  if (event.is_all_day) return { label: "All Day", isLive: false, isSoon: false };

  const status = getEventStatus(event.start_date, event.start_time);
  const time = formatTime(event.start_time);

  if (status?.label === "NOW") {
    return { label: "Happening Now", isLive: true, isSoon: false };
  }
  if (status?.label === "Soon") {
    return { label: `Soon · ${time}`, isLive: false, isSoon: true };
  }
  return { label: time, isLive: false, isSoon: false };
}

export default function LineupHero({ event, portalSlug, vertical }: LineupHeroProps) {
  usePublishEventSeed(event);
  const { label: timeLabel, isLive, isSoon } = buildTimeDisplay(event);
  const catColor = getCategoryColor(event.category);
  const catLabel = getCategoryLabel(event.category);
  const goingCount = event.going_count || 0;
  const eventHref = getCivicEventHref(event, portalSlug, vertical) ?? `/${portalSlug}?event=${event.id}`;

  return (
    <Link
      href={eventHref}
      scroll={false}
      onMouseEnter={() => prefetchDetailView("event")}
      onFocus={() => prefetchDetailView("event")}
      className="block overflow-hidden transition-all group mb-0 relative"
    >
      <div className="relative h-56 sm:h-72 overflow-hidden">
        {event.image_url ? (
          <>
            <Image
              src={event.image_url}
              alt=""
              fill
              className="object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
              sizes="(max-width: 768px) 100vw, 600px"
              blurhash={event.blurhash}
              fallback={
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(145deg, color-mix(in srgb, ${catColor} 40%, #18181F), color-mix(in srgb, ${catColor} 20%, #0F0F14))`,
                  }}
                >
                  <CategoryIcon
                    type={event.category || "other"}
                    size={56}
                    glow="none"
                    weight="light"
                  />
                </div>
              }
            />
            {/* Category-tinted gradient: image fades into dark overlay for text readability */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to top, color-mix(in srgb, ${catColor} 25%, #09090b) 0%, color-mix(in srgb, ${catColor} 8%, rgba(9,9,11,0.5)) 40%, transparent 70%)`,
              }}
            />
          </>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, ${catColor} 40%, #18181F), color-mix(in srgb, ${catColor} 20%, #0F0F14))`,
            }}
          >
            <CategoryIcon
              type={event.category || "other"}
              size={56}
              glow="none"
              weight="light"
            />
          </div>
        )}

        {/* Time badge — top-left, glassmorphic */}
        <span
          className={[
            "absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold leading-none",
            "bg-black/50 backdrop-blur-md border border-white/10",
            isLive && "!border-[var(--neon-red)]/40",
          ]
            .filter(Boolean)
            .join(" ")}
          style={isLive ? { color: "var(--neon-red)" } : isSoon ? { color: "var(--neon-amber)" } : { color: "white" }}
        >
          {isLive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--neon-red)]" />
            </span>
          )}
          {isSoon && <Lightning weight="fill" className="w-3 h-3" />}
          {timeLabel}
        </span>

        {/* Category pill — top-right, with glow */}
        <span
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1.5 rounded-lg font-mono text-2xs font-bold uppercase tracking-wider leading-none border border-white/10"
          style={{
            color: catColor,
            boxShadow: `inset 0 0 12px color-mix(in srgb, ${catColor} 30%, transparent)`,
          }}
        >
          <CategoryIcon
            type={event.category || "other"}
            size={12}
            glow="none"
            weight="bold"
          />
          {catLabel}
        </span>

        {/* FREE badge — below category pill */}
        {event.is_free && (
          <span className="absolute top-12 right-3 inline-flex items-center gap-1 bg-[var(--neon-green)]/15 backdrop-blur-md px-2 py-1 rounded-md font-mono text-2xs font-bold uppercase tracking-wider leading-none text-[var(--neon-green)] border border-[var(--neon-green)]/20">
            <Ticket weight="bold" className="w-2.5 h-2.5" />
            Free
          </span>
        )}

        {/* Bottom content — title, venue, social proof */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <p
            className="font-masthead text-2xl sm:text-3xl font-bold text-white leading-tight line-clamp-2"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}
          >
            {event.title}
          </p>
          <div className="flex items-center gap-2.5 mt-2">
            <p className="text-sm text-white/70 truncate" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
              {event.venue?.name}
              {event.venue?.neighborhood && (
                <span className="text-white/50">
                  {" "}&middot; {event.venue.neighborhood}
                </span>
              )}
            </p>
            {goingCount > 0 && (
              <span
                className="shrink-0 inline-flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full font-mono text-2xs font-medium border border-white/10"
                style={{ color: catColor }}
              >
                <Users weight="bold" className="w-3 h-3" />
                {goingCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom accent bar — category color bleed */}
      <div
        className="h-[3px]"
        style={{
          background: `linear-gradient(to right, ${catColor}, color-mix(in srgb, ${catColor} 30%, transparent))`,
        }}
      />
    </Link>
  );
}
