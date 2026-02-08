"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

interface HolidayConfig {
  slug: string;
  tag: string;
  title: string;
  subtitle: string;
  ctaLabel?: string; // deprecated — kept for config compat
  /** Gradient: left to right */
  gradient: string;
  accentColor: string;
  glowColor: string;
  icon: string; // path to icon in /public/icons/ or "lx-logo" for inline SVG
  bgImage?: string; // optional background image path
  /** Show between these dates [month, day] inclusive */
  showFrom: [number, number];
  showUntil: [number, number];
  /** When does the event actually happen? For countdown */
  eventDate: [number, number, number]; // [year, month, day]
}

// Holiday configs — add new holidays here
const HOLIDAYS: HolidayConfig[] = [
  {
    slug: "super-bowl",
    tag: "super-bowl",
    title: "Super Bowl LX",
    subtitle: "Watch parties & game day events across Atlanta",
    ctaLabel: "Find Watch Parties",
    gradient: "linear-gradient(135deg, #0a2e1a 0%, #0d3320 30%, #143d28 60%, #091a0f 100%)",
    accentColor: "var(--neon-green)",
    glowColor: "#00D9A0",
    icon: "lx-logo", // inline SVG logo
    bgImage: "/images/super-bowl-tecmo.svg",
    showFrom: [2, 2],
    showUntil: [2, 9],
    eventDate: [2026, 2, 8],
  },
];

/** Returns the slug of any holiday currently promoted to hero, so HolidayGrid can exclude it */
export function getActiveHeroSlug(): string | null {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  for (const h of HOLIDAYS) {
    const [fromM, fromD] = h.showFrom;
    const [untilM, untilD] = h.showUntil;
    const afterStart = month > fromM || (month === fromM && day >= fromD);
    const beforeEnd = month < untilM || (month === untilM && day <= untilD);
    if (afterStart && beforeEnd) return h.slug;
  }
  return null;
}

function getActiveHoliday(): (HolidayConfig & { countdown: string; daysUntil: number }) | null {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  for (const h of HOLIDAYS) {
    const [fromM, fromD] = h.showFrom;
    const [untilM, untilD] = h.showUntil;

    const afterStart = month > fromM || (month === fromM && day >= fromD);
    const beforeEnd = month < untilM || (month === untilM && day <= untilD);

    if (afterStart && beforeEnd) {
      const eventDate = new Date(h.eventDate[0], h.eventDate[1] - 1, h.eventDate[2]);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diff = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let countdown: string;
      if (diff < 0) countdown = "Game Over";
      else if (diff === 0) countdown = "GAME DAY";
      else if (diff === 1) countdown = "TOMORROW";
      else countdown = `IN ${diff} DAYS`;

      return { ...h, countdown, daysUntil: diff };
    }
  }
  return null;
}

interface HolidayHeroProps {
  portalSlug: string;
}

export default function HolidayHero({ portalSlug }: HolidayHeroProps) {
  const [eventCount, setEventCount] = useState<number | null>(null);
  const holiday = getActiveHoliday();

  useEffect(() => {
    if (!holiday) return;

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
          setEventCount(section.events.length);
        }
      } catch {
        // Silently fail — hero still renders without count
      }
    }
    fetchCount();
  }, [portalSlug, holiday]);

  if (!holiday || holiday.daysUntil < 0) return null;

  const isGameDay = holiday.daysUntil === 0;
  const isTomorrow = holiday.daysUntil === 1;

  return (
    <Link
      href={`/${portalSlug}?tags=${holiday.tag}&view=find`}
      className="block relative rounded-2xl overflow-hidden group"
      style={{ background: holiday.gradient }}
    >
      {/* Tecmo Bowl background image */}
      {holiday.bgImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${holiday.bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.7,
            imageRendering: "pixelated",
          }}
        />
      )}

      {/* Glow accents */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 20% 50%, ${holiday.glowColor}40 0%, transparent 60%),
                       radial-gradient(ellipse at 80% 80%, ${holiday.glowColor}20 0%, transparent 50%)`,
        }}
      />

      {/* Scan line animation for game day / tomorrow */}
      {(isGameDay || isTomorrow) && (
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
        {/* LX Logo */}
        <div className="flex-shrink-0 relative">
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center overflow-hidden"
            style={{
              backgroundColor: `color-mix(in srgb, ${holiday.glowColor} 12%, transparent)`,
              boxShadow: isGameDay
                ? `0 0 30px ${holiday.glowColor}30`
                : `0 0 20px ${holiday.glowColor}15`,
              backdropFilter: "blur(8px)",
            }}
          >
            {holiday.icon === "lx-logo" ? (
              <svg
                viewBox="0 0 80 80"
                className="w-16 h-16 sm:w-20 sm:h-20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <filter id="lx-glow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Shield fill - subtle */}
                <path
                  d="M40 4 L70 17 L70 46 Q70 65 40 78 Q10 65 10 46 L10 17 Z"
                  fill={`${holiday.glowColor}10`}
                  stroke={holiday.glowColor}
                  strokeWidth="1.5"
                  opacity="0.4"
                />
                {/* L - bold white */}
                <text
                  x="16"
                  y="58"
                  fontFamily="'Impact', 'Arial Black', sans-serif"
                  fontSize="44"
                  fontWeight="900"
                  fill="#ffffff"
                  filter="url(#lx-glow)"
                >
                  L
                </text>
                {/* X - bold accent */}
                <text
                  x="40"
                  y="58"
                  fontFamily="'Impact', 'Arial Black', sans-serif"
                  fontSize="44"
                  fontWeight="900"
                  fill={holiday.glowColor}
                  filter="url(#lx-glow)"
                >
                  X
                </text>
                {/* Star above */}
                <polygon
                  points="40,8 42.5,14 49,14 44,18 45.5,24 40,20.5 34.5,24 36,18 31,14 37.5,14"
                  fill={holiday.glowColor}
                  opacity="0.7"
                />
                {/* Tiny football laces accent below */}
                <line x1="32" y1="66" x2="48" y2="66" stroke={holiday.glowColor} strokeWidth="1" opacity="0.3" />
                <line x1="37" y1="64" x2="37" y2="68" stroke={holiday.glowColor} strokeWidth="0.8" opacity="0.25" />
                <line x1="40" y1="64" x2="40" y2="68" stroke={holiday.glowColor} strokeWidth="0.8" opacity="0.25" />
                <line x1="43" y1="64" x2="43" y2="68" stroke={holiday.glowColor} strokeWidth="0.8" opacity="0.25" />
              </svg>
            ) : (
              <Image
                src={holiday.icon}
                alt=""
                width={80}
                height={80}
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
              />
            )}
          </div>
          {/* Pulse ring on game day */}
          {isGameDay && (
            <span
              className="absolute -inset-1 rounded-2xl animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] opacity-20"
              style={{ backgroundColor: holiday.glowColor }}
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
                color: isGameDay || isTomorrow ? "#fff" : holiday.accentColor,
                backgroundColor: isGameDay
                  ? holiday.glowColor
                  : `color-mix(in srgb, ${holiday.glowColor} 20%, transparent)`,
                boxShadow: isGameDay
                  ? `0 0 16px ${holiday.glowColor}60`
                  : undefined,
              }}
            >
              {(isGameDay || isTomorrow) && (
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"
                    style={{ backgroundColor: isGameDay ? "#fff" : holiday.glowColor }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: isGameDay ? "#fff" : holiday.glowColor }}
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
          <p className="text-sm text-[var(--soft)] mt-0.5">{holiday.subtitle}</p>

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
    </Link>
  );
}
