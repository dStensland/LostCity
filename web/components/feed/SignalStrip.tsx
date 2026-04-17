"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { getSunMoonData } from "@/lib/sun-moon";
import type { FeedContext } from "@/lib/city-pulse/types";
import { buildExploreUrl } from "@/lib/find-url";

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

function isRaining(condition: string | undefined): boolean {
  if (!condition) return false;
  const c = condition.toLowerCase();
  return c.includes("rain") || c.includes("storm") || c.includes("thunder") || c.includes("drizzle") || c.includes("shower");
}

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

function abbreviateTitle(title: string): string {
  const vsIdx = title.toLowerCase().indexOf(" vs ");
  if (vsIdx > 0 && vsIdx < 18) return title.slice(0, vsIdx);
  const atIdx = title.toLowerCase().indexOf(" at ");
  if (atIdx > 0 && atIdx < 18) return title.slice(0, atIdx);
  return title.length > 18 ? title.slice(0, 16) + "…" : title;
}

// Unified pill base. Solid surface (no backdrop-blur — violates cinematic
// minimalism rule). Legible 11px sans-serif.
const PILL_BASE =
  "inline-flex items-center gap-1.5 font-sans text-xs font-medium px-2.5 py-1 rounded-full " +
  "bg-black/55 border border-white/[0.08] text-[var(--cream)]/90 " +
  "whitespace-nowrap transition-colors";

const PILL_INTERACTIVE = " hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cream)]/40";

// ---------------------------------------------------------------------------
// SignalStrip — weather anchor + at most one contextual pill.
// Priority (second pill): rain > holiday > sports.
// Moon/sunset live in the weather popover, not as standalone pills.
// ---------------------------------------------------------------------------

export function SignalStrip({ context, sportsTentpole, portalSlug = "atlanta" }: SignalStripProps) {
  const { moonPhase, sunset, sunrise } = useMemo(() => getSunMoonData(), []);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const weatherRef = useRef<HTMLDivElement>(null);

  const rain = isRaining(context.weather?.condition);
  const holiday = context.active_holidays?.[0] ?? null;

  const happeningHref = buildExploreUrl({ portalSlug, lane: "events" });

  useEffect(() => {
    if (!weatherOpen) return;
    const handler = (e: MouseEvent) => {
      if (weatherRef.current && !weatherRef.current.contains(e.target as Node)) {
        setWeatherOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [weatherOpen]);

  const sportsLabel = useMemo(() => {
    if (!sportsTentpole) return null;
    const abbr = abbreviateTitle(sportsTentpole.title);
    const time = formatSportsTime(sportsTentpole.start_time);
    return time ? `${abbr} · ${time}` : abbr;
  }, [sportsTentpole]);

  const contextualPill: React.ReactNode = (() => {
    if (rain) {
      return (
        <Link
          href={happeningHref}
          className={PILL_BASE + PILL_INTERACTIVE}
          style={{
            background: "color-mix(in srgb, var(--neon-cyan) 18%, rgba(0,0,0,0.55))",
            borderColor: "color-mix(in srgb, var(--neon-cyan) 30%, transparent)",
            color: "var(--neon-cyan)",
          }}
        >
          <span aria-hidden>🌧</span>
          <span>Indoor picks</span>
        </Link>
      );
    }
    if (holiday) {
      return (
        <span
          className={PILL_BASE}
          style={{
            background: "color-mix(in srgb, var(--vibe) 18%, rgba(0,0,0,0.55))",
            borderColor: "color-mix(in srgb, var(--vibe) 30%, transparent)",
            color: "var(--vibe)",
          }}
        >
          <span aria-hidden>🎄</span>
          <span>{holiday.title}</span>
        </span>
      );
    }
    if (sportsTentpole && sportsLabel) {
      return (
        <Link
          href={sportsTentpole.href}
          className={PILL_BASE + PILL_INTERACTIVE}
          style={{
            background: "color-mix(in srgb, var(--gold) 15%, rgba(0,0,0,0.55))",
            borderColor: "color-mix(in srgb, var(--gold) 28%, transparent)",
            color: "var(--gold)",
          }}
        >
          {sportsLabel}
        </Link>
      );
    }
    return null;
  })();

  return (
    <div className="flex gap-1.5 flex-wrap items-center" role="region" aria-label="City context">
      {context.weather ? (
        <div className="relative" ref={weatherRef}>
          <button
            type="button"
            onClick={() => setWeatherOpen((o) => !o)}
            aria-expanded={weatherOpen}
            aria-label="Weather details"
            className={PILL_BASE + PILL_INTERACTIVE}
          >
            <span aria-hidden>{weatherEmoji(context.weather.condition, context.weather.icon)}</span>
            <span>{Math.round(context.weather.temperature_f)}° {context.weather.condition}</span>
          </button>
          {weatherOpen && (
            <div
              role="dialog"
              aria-label="Weather, sun, and moon"
              className="absolute bottom-full left-0 mb-2 sm:bottom-auto sm:top-full sm:mb-0 sm:mt-2 z-50 min-w-[220px] rounded-xl bg-[var(--night)] border border-[var(--twilight)] shadow-card-lg p-3 space-y-2 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-[var(--cream)]">
                  {weatherEmoji(context.weather.condition, context.weather.icon)} {Math.round(context.weather.temperature_f)}°F
                </span>
                <span className="text-xs text-[var(--soft)]">{context.weather.condition}</span>
              </div>
              <div className="h-px bg-[var(--twilight)]" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-[var(--muted)]">Sunrise</span>
                <span className="text-[var(--cream)] text-right font-mono">{sunrise}</span>
                <span className="text-[var(--muted)]">Sunset</span>
                <span className="text-[var(--cream)] text-right font-mono">{sunset}</span>
                <span className="text-[var(--muted)]">Moon</span>
                <span className="text-[var(--cream)] text-right">{moonPhase.emoji} {moonPhase.label}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <span className="inline-flex h-7 w-32 rounded-full skeleton-shimmer" style={{ opacity: 0.12 }} />
      )}

      {contextualPill}
    </div>
  );
}

export type { SignalStripProps };
