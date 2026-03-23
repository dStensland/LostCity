"use client";

import { useMemo } from "react";
import Link from "next/link";
import { getSunMoonData } from "@/lib/sun-moon";
import type { FeedContext } from "@/lib/city-pulse/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SignalStripProps {
  context: FeedContext;
  sportsTentpole?: {
    title: string;
    start_time: string | null;
    venue_name?: string;
    href: string;
  } | null;
  portalSlug?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map weather condition/icon string to a single emoji. */
function weatherEmoji(condition: string | undefined, icon: string | undefined): string {
  const src = (condition ?? icon ?? "").toLowerCase();
  if (src.includes("thunder") || src.includes("storm")) return "⛈";
  if (src.includes("snow") || src.includes("sleet") || src.includes("flurr")) return "🌨";
  if (src.includes("fog") || src.includes("mist") || src.includes("haze")) return "🌫";
  if (src.includes("rain") || src.includes("drizzle") || src.includes("shower")) return "🌧";
  if (src.includes("partly") || src.includes("mostly cloudy") || src.includes("broken")) return "⛅";
  if (src.includes("cloud") || src.includes("overcast")) return "☁";
  return "☀";
}

/** Returns true if condition string indicates precipitation. */
function isRaining(condition: string | undefined): boolean {
  if (!condition) return false;
  const c = condition.toLowerCase();
  return c.includes("rain") || c.includes("storm") || c.includes("thunder") || c.includes("drizzle") || c.includes("shower");
}

/**
 * Format a DB time string "HH:MM:SS" or "HH:MM" as "7:20 PM".
 * Returns null if the string is invalid or looks like a midnight placeholder.
 */
function formatSportsTime(time: string | null): string | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23) return null;
  if (hour === 0 && minute === 0) return null;
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minStr = minute === 0 ? "" : `:${minute.toString().padStart(2, "0")}`;
  return `${hour12}${minStr} ${period}`;
}

/**
 * Abbreviate a sports event title to fit the pill.
 * Keeps it under ~20 chars. Truncates at first " vs " or " at " if present,
 * otherwise hard-truncates.
 */
function abbreviateTitle(title: string): string {
  const vsIdx = title.toLowerCase().indexOf(" vs ");
  if (vsIdx > 0 && vsIdx < 18) return title.slice(0, vsIdx);
  const atIdx = title.toLowerCase().indexOf(" at ");
  if (atIdx > 0 && atIdx < 18) return title.slice(0, atIdx);
  return title.length > 18 ? title.slice(0, 16) + "…" : title;
}

// ---------------------------------------------------------------------------
// Pill sub-components
// ---------------------------------------------------------------------------

interface PillProps {
  children: React.ReactNode;
  className?: string;
}

function Pill({ children, className = "" }: PillProps) {
  return (
    <span
      className={`font-mono text-2xs px-2 py-0.5 rounded-md bg-black/30 backdrop-blur-sm text-[var(--cream)] whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

interface LinkPillProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

function LinkPill({ href, children, className = "" }: LinkPillProps) {
  return (
    <Link
      href={href}
      className={`font-mono text-2xs px-2 py-0.5 rounded-md bg-black/30 backdrop-blur-sm text-[var(--cream)] whitespace-nowrap transition-opacity hover:opacity-75 ${className}`}
    >
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// SignalStrip
// ---------------------------------------------------------------------------

export function SignalStrip({ context, sportsTentpole, portalSlug = "atlanta" }: SignalStripProps) {
  const { moonPhase, sunset } = useMemo(() => getSunMoonData(), []);

  const showSunset = ["happy_hour", "evening", "late_night"].includes(context.time_slot);
  const rain = isRaining(context.weather?.condition);
  const holiday = context.active_holidays?.[0] ?? null;

  const happeningHref = `/${portalSlug}?view=happening`;

  // Sports time label — compute once
  const sportsLabel = useMemo(() => {
    if (!sportsTentpole) return null;
    const abbr = abbreviateTitle(sportsTentpole.title);
    const time = formatSportsTime(sportsTentpole.start_time);
    return time ? `${abbr} · ${time}` : abbr;
  }, [sportsTentpole]);

  return (
    <div className="flex gap-1.5 flex-wrap" role="region" aria-label="City context">

      {/* 1. Weather — always present */}
      {context.weather && (
        <LinkPill
          href={happeningHref}
          className={rain ? "!bg-[var(--neon-cyan)]/15 !text-[var(--neon-cyan)]" : ""}
        >
          {weatherEmoji(context.weather.condition, context.weather.icon)}{" "}
          {Math.round(context.weather.temperature_f)}°{" "}
          {context.weather.condition}
        </LinkPill>
      )}

      {/* 2. Sunset — afternoon/evening only */}
      {showSunset && (
        <Pill>Sunset {sunset}</Pill>
      )}

      {/* 3. Moon — only on notable phases */}
      {moonPhase.isNotable && (
        <Pill>
          {moonPhase.emoji} {moonPhase.label}
        </Pill>
      )}

      {/* 4. Sports — gold, links to event */}
      {sportsTentpole && sportsLabel && (
        <LinkPill
          href={sportsTentpole.href}
          className="!bg-[var(--gold)]/15 !text-[var(--gold)]"
        >
          {sportsLabel}
        </LinkPill>
      )}

      {/* 5. Holiday */}
      {holiday && (
        <Pill className="!bg-[var(--vibe)]/15 !text-[var(--vibe)]">
          🎄 {holiday.title}
        </Pill>
      )}

      {/* 6. Rain warning + indoor picks nudge */}
      {rain && (
        <LinkPill
          href={happeningHref}
          className="!bg-[var(--neon-cyan)]/15 !text-[var(--neon-cyan)]"
        >
          🌧 Rain
        </LinkPill>
      )}
      {rain && (
        <Pill className="!bg-[var(--neon-cyan)]/15 !text-[var(--neon-cyan)]">
          Indoor picks below ↓
        </Pill>
      )}

    </div>
  );
}

export type { SignalStripProps };
