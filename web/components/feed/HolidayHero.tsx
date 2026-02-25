"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  type HolidayConfig,
  getActiveHeroSlugs,
  getActiveHoliday,
} from "@/config/holidays";

// ============================================================================
// Shared card renderer — used by both HolidayHero and HolidayHeroBanner
// ============================================================================

function HolidayCard({
  holiday,
  eventCount,
}: {
  holiday: HolidayConfig & { countdown: string; daysUntil: number };
  eventCount: number | null;
}) {
  const isToday = !holiday.countdownOverride && holiday.daysUntil === 0;
  const isTomorrow = !holiday.countdownOverride && holiday.daysUntil === 1;
  const hasImageIcon = holiday.icon.startsWith("/");

  return (
    <>
      {/* Background image */}
      {holiday.bgImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${holiday.bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.7,
          }}
        />
      )}

      {/* Blurred icon background glow (Valentine's / Friday 13th style) */}
      {holiday.iconBgGlow && hasImageIcon && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -right-8 -top-8 w-[200px] h-[200px] sm:w-[280px] sm:h-[280px] opacity-30 animate-[heartbeat_2s_ease-in-out_infinite]"
            style={{
              backgroundImage: `url(${holiday.icon})`,
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              filter: "blur(30px) saturate(1.5)",
            }}
          />
        </div>
      )}

      {/* Glow accents */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 20% 50%, ${holiday.glowColor}40 0%, transparent 60%),
                       radial-gradient(ellipse at 80% 80%, ${holiday.glowColor}20 0%, transparent 50%)`,
        }}
      />

      {/* Shimmer animation for urgent days */}
      {(isToday || isTomorrow) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute inset-y-0 w-[200%] animate-[shimmer_8s_ease-in-out_infinite]"
            style={{
              background: `linear-gradient(90deg, transparent, ${holiday.glowColor}08, transparent)`,
            }}
          />
        </div>
      )}

      <div className="relative flex items-center gap-5 px-5 py-5 sm:px-6 sm:py-6">
        {/* Icon */}
        <div className="flex-shrink-0 relative">
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center overflow-hidden"
            style={{
              backgroundColor: `color-mix(in srgb, ${holiday.glowColor} 12%, transparent)`,
              boxShadow: isToday
                ? `0 0 30px ${holiday.glowColor}30`
                : `0 0 20px ${holiday.glowColor}15`,
              backdropFilter: "blur(8px)",
            }}
          >
            {hasImageIcon ? (
              <Image
                src={holiday.icon}
                alt=""
                width={150}
                height={150}
                unoptimized={holiday.icon.endsWith(".gif")}
                className="w-20 h-20 sm:w-24 sm:h-24 object-cover scale-125"
              />
            ) : (
              <span className="text-5xl sm:text-6xl leading-none select-none">
                {holiday.icon}
              </span>
            )}
          </div>
          {/* Pulse ring on event day */}
          {isToday && (
            <span
              className="absolute -inset-1 rounded-2xl animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] opacity-20"
              style={{ backgroundColor: holiday.glowColor }}
            />
          )}
          {/* Pulsing glow ring (Valentine's / Friday 13th style) */}
          {holiday.iconGlowRing && (
            <span
              className="absolute -inset-1.5 rounded-2xl animate-[heartbeat_2s_ease-in-out_infinite] opacity-40"
              style={{ boxShadow: `0 0 20px ${holiday.glowColor}, 0 0 40px ${holiday.glowColor}40` }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Countdown badge */}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-bold uppercase tracking-wider"
              style={{
                color: isToday || isTomorrow ? "#fff" : holiday.accentColor,
                backgroundColor: isToday
                  ? holiday.glowColor
                  : `color-mix(in srgb, ${holiday.glowColor} 20%, transparent)`,
                boxShadow: isToday
                  ? `0 0 16px ${holiday.glowColor}60`
                  : undefined,
              }}
            >
              {(isToday || isTomorrow) && (
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"
                    style={{ backgroundColor: isToday ? "#fff" : holiday.glowColor }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: isToday ? "#fff" : holiday.glowColor }}
                  />
                </span>
              )}
              {holiday.countdown}
            </span>
          </div>

          {/* Title */}
          <h3
            className="text-xl sm:text-2xl font-bold leading-tight"
            style={{
              color: "var(--cream)",
              textShadow: `0 0 30px ${holiday.glowColor}30`,
            }}
          >
            {holiday.title}
          </h3>

          {/* Subtitle */}
          <p className="text-sm text-[var(--soft)] mt-0.5 italic">{holiday.subtitle}</p>

          {/* Event count pill */}
          {eventCount !== null && eventCount > 0 && (
            <div className="flex items-center gap-3 mt-3">
              <span
                className="font-mono text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  color: holiday.accentColor,
                  backgroundColor: `color-mix(in srgb, ${holiday.glowColor} 15%, transparent)`,
                }}
              >
                {eventCount} {eventCount === 1 ? "event" : "events"}
              </span>
            </div>
          )}
        </div>

        {/* Arrow */}
        <svg
          className="w-6 h-6 text-[var(--muted)] group-hover:text-[var(--cream)] transition-colors flex-shrink-0 group-hover:translate-x-1 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </>
  );
}

// ============================================================================
// HolidayHero — shows active holidays sorted by nearest event date
// ============================================================================

interface HolidayHeroProps {
  portalSlug: string;
  /** Which hero position (1 = nearest event, 2 = second nearest). Default 1. */
  position?: number;
  /** Pre-fetched event count — skips internal fetch when provided. */
  eventCount?: number | null;
}

export default function HolidayHero({ portalSlug, position = 1, eventCount: prefetchedCount }: HolidayHeroProps) {
  const [fetchedCount, setFetchedCount] = useState<number | null>(null);

  // Get the holiday for this position, sorted by nearest event date
  const slugs = getActiveHeroSlugs();
  const targetSlug = slugs[position - 1] ?? null;
  const holiday = targetSlug ? getActiveHoliday(targetSlug) : null;

  // Only fetch if no prefetched count was provided
  const hasPrefetched = prefetchedCount !== undefined;
  useEffect(() => {
    if (hasPrefetched || !holiday) return;

    async function fetchCount() {
      try {
        const res = await fetch(`/api/portals/${portalSlug}/feed`);
        if (!res.ok) return;
        const data = await res.json();
        const sections = data?.sections ?? [];
        const section = sections.find(
          (s: { slug?: string }) => s.slug === holiday!.slug
        );
        if (section?.events) {
          setFetchedCount(section.events.length);
        }
      } catch {
        // Silently fail — hero still renders without count
      }
    }
    fetchCount();
  }, [portalSlug, holiday, hasPrefetched]);

  const eventCount = hasPrefetched ? (prefetchedCount ?? null) : fetchedCount;

  if (!holiday) return null;

  return (
    <Link
      href={`/${portalSlug}?tags=${holiday.tag}&view=find`}
      className="block relative rounded-2xl overflow-hidden group"
      style={{ background: holiday.gradient }}
    >
      <HolidayCard holiday={holiday} eventCount={eventCount} />
    </Link>
  );
}
