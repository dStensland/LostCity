"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

interface HolidayConfig {
  slug: string;
  tag: string;
  title: string;
  subtitle: string;
  /** Gradient: left to right */
  gradient: string;
  accentColor: string;
  glowColor: string;
  icon: string; // path to image in /public/ (starts with /) or emoji string
  bgImage?: string; // optional background image path
  /** Show between these dates [month, day] inclusive */
  showFrom: [number, number];
  showUntil: [number, number];
  /** When does the event actually happen? For countdown */
  eventDate: [number, number, number]; // [year, month, day]
  /** Override countdown text (e.g. "ALL MONTH" for month-long observances) */
  countdownOverride?: string;
}

// Holiday configs — first match wins, order by specificity
const HOLIDAYS: HolidayConfig[] = [
  {
    slug: "friday-the-13th",
    tag: "friday-13",
    title: "Friday the 13th",
    subtitle: "Embrace the unlucky",
    gradient: "linear-gradient(135deg, #050a05 0%, #0a1a0a 30%, #051005 60%, #030a03 100%)",
    accentColor: "#00ff41",
    glowColor: "#00ff41",
    icon: "🔪",
    showFrom: [2, 10],
    showUntil: [2, 13],
    eventDate: [2026, 2, 13],
  },
  {
    slug: "valentines-day",
    tag: "valentines",
    title: "Valentine's Day",
    subtitle: "The heart has reasons that reason cannot know",
    gradient: "linear-gradient(135deg, #1a0a1e 0%, #2d0a2e 30%, #1e0a28 60%, #0f0a1a 100%)",
    accentColor: "#ff4da6",
    glowColor: "#ff4da6",
    icon: "/images/valentines-heart-neon.gif",
    showFrom: [2, 8],
    showUntil: [2, 14],
    eventDate: [2026, 2, 14],
  },
  {
    slug: "mardi-gras",
    tag: "mardi-gras",
    title: "Mardi Gras",
    subtitle: "Laissez les bons temps rouler",
    gradient: "linear-gradient(135deg, #0d0520 0%, #1a0a35 30%, #15082a 60%, #0d0520 100%)",
    accentColor: "#f0c420",
    glowColor: "#9b59b6",
    icon: "\u269C\uFE0F",
    showFrom: [2, 15],
    showUntil: [2, 17],
    eventDate: [2026, 2, 17],
  },
  {
    slug: "lunar-new-year",
    tag: "lunar-new-year",
    title: "Lunar New Year",
    subtitle: "G\u014Dng x\u01D0 f\u0101 c\u00E1i \u2014 Year of the Horse",
    gradient: "linear-gradient(135deg, #1a0505 0%, #350a0a 30%, #2a0808 60%, #1a0303 100%)",
    accentColor: "#ff4444",
    glowColor: "#cc0000",
    icon: "\uD83C\uDFEE",
    showFrom: [2, 18],
    showUntil: [2, 22],
    eventDate: [2026, 2, 17],
    countdownOverride: "YEAR OF THE HORSE",
  },
  {
    slug: "black-history-month",
    tag: "black-history",
    title: "Black History Month",
    subtitle: "Honoring Black culture, art & community in Atlanta",
    gradient: "linear-gradient(135deg, #0a0a05 0%, #1a1508 30%, #0f0d05 60%, #0a0a05 100%)",
    accentColor: "#d4a017",
    glowColor: "#c8960e",
    icon: "\u270A\uD83C\uDFFF",
    showFrom: [2, 1],
    showUntil: [2, 28],
    eventDate: [2026, 2, 1],
    countdownOverride: "ALL MONTH",
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
      if (h.countdownOverride) {
        countdown = h.countdownOverride;
      } else if (diff < 0) {
        countdown = "IT'S OVER";
      } else if (diff === 0) {
        countdown = "TODAY";
      } else if (diff === 1) {
        countdown = "TOMORROW";
      } else {
        countdown = `IN ${diff} DAYS`;
      }

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

  if (!holiday || (!holiday.countdownOverride && holiday.daysUntil < 0)) return null;

  const isToday = !holiday.countdownOverride && holiday.daysUntil === 0;
  const isTomorrow = !holiday.countdownOverride && holiday.daysUntil === 1;

  return (
    <Link
      href={`/${portalSlug}?tags=${holiday.tag}&view=find`}
      className="block relative rounded-2xl overflow-hidden group"
      style={{ background: holiday.gradient }}
    >
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

      {/* Valentine's: blurred neon heart background glow */}
      {holiday.slug === "valentines-day" && (
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
            {holiday.icon.startsWith("/") ? (
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
          {/* Heartbeat glow ring for valentines */}
          {holiday.slug === "valentines-day" && (
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
    </Link>
  );
}
