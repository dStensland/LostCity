"use client";

/**
 * CityBriefing — full-bleed cinematic hero for the Atlanta feed.
 *
 * Zone 1: Full-viewport-bleed hero (parallax, Ken Burns, layout variants,
 *         weather pill, live badge, quick links).
 *
 * News ("Today in Atlanta") has been extracted to TodayInAtlantaSection
 * and is rendered below The Lineup in CityPulseShell.
 *
 * Self-fetching:
 *   - /api/portals/[slug]/happening-now?countOnly=true → live count badge
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import {
  ArrowRight,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  Wind,
  Coffee,
  ForkKnife,
  Barbell,
  Storefront,
  CalendarBlank,
  Ticket,
  BeerStein,
  MoonStars,
  MusicNotes,
  SmileyWink,
  Champagne,
  CalendarCheck,
  Park,
  SunHorizon,
  Bank,
  GameController,
  UsersThree,
  PaintBrush,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import type {
  FeedContext,
  ResolvedHeader,
  FlagshipEvent,
  TimeSlot,
  LayoutVariant,
  TextTreatment,
  QuickLink,
} from "@/lib/city-pulse/types";
import { formatTemperature, getWeatherIconName, type ForecastDay, type WeatherData } from "@/lib/weather-utils";
import { useFeedVisible } from "@/lib/feed-visibility";
import { SignalStrip } from "./SignalStrip";
import { SummaryLine } from "./SummaryLine";
import { NewsDigest } from "./NewsDigest";

// ── Icon map for quick link pills ────────────────────────────────────────────

const QUICK_LINK_ICONS: Record<string, PhosphorIcon> = {
  Coffee, ForkKnife, Barbell, Storefront, CalendarBlank, Ticket,
  BeerStein, MoonStars, MusicNotes, SmileyWink, Champagne,
  CalendarCheck, Park, SunHorizon, Bank, GameController, UsersThree, PaintBrush,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CityBriefingProps {
  header: ResolvedHeader;
  context: FeedContext;
  portalSlug: string;
  portalId: string;
  quickLinks?: QuickLink[];
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
  categoryCounts?: { today: Record<string, number> } | null;
  /** Server-computed hero URL — available before JS hydrates, used as initial state. */
  serverHeroUrl?: string;
}

// ── Layout variant selection ──────────────────────────────────────────────────

function getLayoutVariant(timeSlot: TimeSlot, dayOfWeek: string): LayoutVariant {
  const DAY_INDEX: Record<string, number> = {
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
    friday: 4, saturday: 5, sunday: 6,
  };
  const dayIdx = DAY_INDEX[dayOfWeek] ?? 0;

  const SLOT_INDEX: Record<TimeSlot, number> = {
    morning: 0, midday: 1, happy_hour: 2, evening: 3, late_night: 4,
  };
  const slotIdx = SLOT_INDEX[timeSlot];

  // Bottom-left is the most reliable layout (text always in darkest gradient zone).
  // Use it as the dominant variant, with editorial and centered as occasional variety.
  const variants: LayoutVariant[] = [
    "bottom-left", "editorial", "bottom-left", "centered",
    "bottom-left", "editorial", "bottom-left",
  ];
  return variants[(dayIdx + slotIdx) % variants.length];
}

// ── Masthead text ─────────────────────────────────────────────────────────────

const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: "MORNING",
  midday: "AFTERNOON",
  happy_hour: "HAPPY HOUR",
  evening: "EVENING",
  late_night: "LATE NIGHT",
};

function getMastheadText(context: FeedContext): { line1: string; line2: string } {
  const day = (context.day_of_week || "").toUpperCase();
  const timeLabel = TIME_SLOT_LABELS[context.time_slot];
  return { line1: day, line2: timeLabel };
}

// ── Treatment style system ────────────────────────────────────────────────────

interface TreatmentStyle {
  overlay: React.CSSProperties;
  vignette?: React.CSSProperties;
  mastheadShadow: string;
  bodyShadow: string;
  contentClass?: string;
  contentStyle?: React.CSSProperties;
}

type GradientIntensity = "light" | "standard" | "heavy";

const GRADIENT_PRESETS: Record<GradientIntensity, string> = {
  light: [
    "linear-gradient(to bottom,",
    "rgba(9,9,11,0.2) 0%,",
    "rgba(9,9,11,0.1) 15%,",
    "rgba(9,9,11,0.05) 35%,",
    "rgba(9,9,11,0.05) 50%,",
    "rgba(9,9,11,0.15) 65%,",
    "rgba(9,9,11,0.45) 80%,",
    "rgba(9,9,11,0.75) 92%,",
    "#09090b 100%)",
  ].join(" "),
  standard: [
    "linear-gradient(to bottom,",
    "rgba(9,9,11,0.35) 0%,",
    "rgba(9,9,11,0.2) 10%,",
    "rgba(9,9,11,0.08) 25%,",
    "rgba(9,9,11,0.05) 40%,",
    "rgba(9,9,11,0.1) 55%,",
    "rgba(9,9,11,0.35) 68%,",
    "rgba(9,9,11,0.65) 80%,",
    "rgba(9,9,11,0.88) 92%,",
    "#09090b 100%)",
  ].join(" "),
  heavy: [
    "linear-gradient(to bottom,",
    "rgba(9,9,11,0.4) 0%,",
    "rgba(9,9,11,0.3) 10%,",
    "rgba(9,9,11,0.15) 22%,",
    "rgba(9,9,11,0.1) 38%,",
    "rgba(9,9,11,0.12) 50%,",
    "rgba(9,9,11,0.35) 62%,",
    "rgba(9,9,11,0.65) 76%,",
    "rgba(9,9,11,0.88) 88%,",
    "#09090b 100%)",
  ].join(" "),
};

function getTreatmentStyle(treatment: TextTreatment): TreatmentStyle {
  switch (treatment) {
    case "clean":
      return {
        overlay: { background: GRADIENT_PRESETS.light },
        mastheadShadow: "0 2px 20px rgba(0,0,0,0.9), 0 1px 6px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.5)",
        bodyShadow: "0 1px 12px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,1), 0 0 30px rgba(0,0,0,0.4)",
      };
    case "frosted":
      return {
        overlay: { background: GRADIENT_PRESETS.light },
        mastheadShadow: "0 1px 8px rgba(0,0,0,0.5)",
        bodyShadow: "0 1px 4px rgba(0,0,0,0.4)",
        contentClass: "rounded-xl",
        contentStyle: {
          background: "rgba(9,9,11,0.35)",
          backdropFilter: "blur(12px) saturate(1.4)",
          WebkitBackdropFilter: "blur(12px) saturate(1.4)",
          padding: "0.75rem 1rem",
          margin: "-0.75rem -1rem",
        },
      };
    case "bold":
      return {
        overlay: { background: GRADIENT_PRESETS.heavy },
        mastheadShadow: "0 3px 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)",
        bodyShadow: "0 2px 8px rgba(0,0,0,0.8), 0 0 3px rgba(0,0,0,1)",
      };
    case "cinematic":
      return {
        overlay: { background: GRADIENT_PRESETS.heavy },
        vignette: {
          background: "radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(9,9,11,0.6) 100%)",
        },
        mastheadShadow: "0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.3)",
        bodyShadow: "0 1px 10px rgba(0,0,0,0.7), 0 0 20px rgba(0,0,0,0.2)",
      };
    default:
      return {
        overlay: { background: GRADIENT_PRESETS.standard },
        mastheadShadow: "0 2px 20px rgba(0,0,0,0.9), 0 1px 6px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.5)",
        bodyShadow: "0 1px 12px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,1), 0 0 30px rgba(0,0,0,0.4)",
      };
  }
}

// ── Weather icon ──────────────────────────────────────────────────────────────

function WeatherIcon({ icon, className }: { icon: string; className?: string }) {
  const name = getWeatherIconName(icon);
  const cls = className || "w-4 h-4";
  switch (name) {
    case "clear":
      return <Sun weight="duotone" className={cls} />;
    case "partly-cloudy":
    case "cloudy":
      return <Cloud weight="duotone" className={cls} />;
    case "rain":
      return <CloudRain weight="duotone" className={cls} />;
    case "thunderstorm":
      return <CloudLightning weight="duotone" className={cls} />;
    case "snow":
      return <Snowflake weight="duotone" className={cls} />;
    case "mist":
      return <Wind weight="duotone" className={cls} />;
    default:
      return <Sun weight="duotone" className={cls} />;
  }
}

// ── Hero quick links ──────────────────────────────────────────────────────────

function HeroQuickLinks({
  links,
  categoryCounts,
}: {
  links?: QuickLink[];
  categoryCounts?: Record<string, number> | null;
}) {
  if (!links || links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5">
      {links.filter((link) => QUICK_LINK_ICONS[link.icon]).map((link) => {
        const IconComp = QUICK_LINK_ICONS[link.icon];
        const count =
          link.category_key && categoryCounts
            ? categoryCounts[link.category_key] ?? null
            : null;
        return (
          <Link
            key={link.label}
            href={link.href}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/35 backdrop-blur-sm border border-white/[0.30] transition-all hover:bg-black/45 hover:border-white/[0.40]"
          >
            {IconComp && (
              <IconComp
                weight="duotone"
                className="w-3.5 h-3.5 opacity-80"
                style={{ color: link.accent_color }}
              />
            )}
            <span
              className="font-mono text-xs font-medium tracking-wide"
              style={{ color: link.accent_color }}
            >
              {link.label}
              {count != null && count > 0 && (
                <span className="ml-1 opacity-70">{count}</span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ── Layout variant shared props ───────────────────────────────────────────────

interface LayoutProps {
  masthead: { line1: string; line2: string };
  accentColor: string;
  headline: string;
  treatment: TreatmentStyle;
  weather: FeedContext["weather"];
  quickLinks?: QuickLink[];
  liveCount: number | null;
  portalSlug: string;
  context: FeedContext;
  sportsTentpole?: ResolvedHeader["sports_tentpole"];
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
  categoryCounts?: { today: Record<string, number> } | null;
}

// ── Weather pill (shared across variants) ────────────────────────────────────

function WeatherPill({
  weather,
  position = "top-right",
  portalSlug,
}: {
  weather: FeedContext["weather"];
  position?: "top-right" | "top-left" | "inline";
  portalSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch forecast on first open
  useEffect(() => {
    if (!open || forecast) return;
    const controller = new AbortController();
    fetch(`/api/portals/${portalSlug}/weather`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!controller.signal.aborted && d.forecast) {
          setForecast(d.forecast);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [open, forecast, portalSlug]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!weather) return null;

  const posClass =
    position === "top-right"
      ? "absolute top-4 right-4 z-20"
      : position === "top-left"
        ? "absolute top-4 right-4 z-20"
        : "z-20";

  const condition = weather.condition.charAt(0).toUpperCase() + weather.condition.slice(1);

  return (
    <div
      ref={ref}
      className={`${posClass} animate-fade-in hero-stagger-1`}
      style={{ transform: "translateY(var(--parallax-weather, 0px))" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-black/25 backdrop-blur-md border border-white/10 text-[var(--cream)]/80 hover:bg-black/35 transition-colors cursor-pointer"
      >
        <WeatherIcon icon={weather.icon} className="w-3.5 h-3.5" />
        <span className="font-mono text-xs tracking-wide">
          {formatTemperature(weather.temperature_f)}
        </span>
      </button>

      {/* Forecast popover */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 rounded-xl bg-[var(--night)]/95 backdrop-blur-xl border border-[var(--twilight)] shadow-2xl overflow-hidden animate-fade-in z-50">
          {/* Current */}
          <div className="px-4 py-3 border-b border-[var(--twilight)]/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">Now</p>
                <p className="text-2xl font-semibold text-[var(--cream)] tabular-nums">
                  {formatTemperature(weather.temperature_f)}
                </p>
              </div>
              <div className="text-right">
                <WeatherIcon icon={weather.icon} className="w-8 h-8 text-[var(--soft)] ml-auto" />
                <p className="text-xs text-[var(--soft)] mt-0.5">{condition}</p>
              </div>
            </div>
            {"humidity" in weather && "wind_mph" in weather && (
              <div className="flex gap-3 mt-1.5">
                <span className="font-mono text-2xs text-[var(--muted)]">
                  💧 {(weather as WeatherData).humidity}%
                </span>
                <span className="font-mono text-2xs text-[var(--muted)]">
                  💨 {Math.round((weather as WeatherData).wind_mph)} mph
                </span>
              </div>
            )}
          </div>

          {/* Forecast days */}
          {forecast && forecast.length > 0 ? (
            <div className="divide-y divide-[var(--twilight)]/30">
              {forecast.map((day) => (
                <div key={day.date} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-mono text-xs text-[var(--soft)] w-16 shrink-0">
                    {day.day_label}
                  </span>
                  <WeatherIcon icon={day.icon} className="w-4 h-4 text-[var(--soft)] shrink-0" />
                  <span className="font-mono text-xs text-[var(--cream)] tabular-nums">
                    {Math.round(day.high_f)}°
                  </span>
                  <span className="font-mono text-xs text-[var(--muted)] tabular-nums">
                    {Math.round(day.low_f)}°
                  </span>
                  <span className="text-2xs text-[var(--muted)] truncate ml-auto">
                    {day.condition.charAt(0).toUpperCase() + day.condition.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3">
              <div className="h-3 w-24 rounded bg-[var(--twilight)] animate-pulse" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Live count badge (shared across variants) ─────────────────────────────────

function LiveBadge({
  liveCount,
  portalSlug,
}: {
  liveCount: number | null;
  portalSlug: string;
}) {
  if (!liveCount || liveCount <= 0) return null;
  return (
    <div className="absolute top-4 left-4 z-10">
      <Link
        href={`/${portalSlug}/happening-now`}
        className="flex items-center gap-1 rounded-full px-2.5 py-1.5 bg-[var(--neon-red)]/20 backdrop-blur-md border border-[var(--neon-red)]/40 transition-colors hover:bg-[var(--neon-red)]/30"
      >
        <span className="relative flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)]" />
          <span className="absolute inset-0 rounded-full bg-[var(--neon-red)]/50 animate-ping" />
        </span>
        <span className="font-mono text-xs font-bold text-[var(--neon-red)] uppercase tracking-wide">
          {liveCount} Live
        </span>
      </Link>
    </div>
  );
}

// ── Editorial headline subtitle ───────────────────────────────────────────────

function HeadlineSubtitle({
  headline,
  bodyShadow,
}: {
  headline: string;
  bodyShadow: string;
}) {
  if (!headline) return null;
  return (
    <p
      className="text-base italic text-white/85 leading-snug line-clamp-1 mt-1.5"
      style={{ textShadow: bodyShadow, fontFamily: "var(--font-body), sans-serif" }}
    >
      {headline}
    </p>
  );
}

// ── Layout variants ───────────────────────────────────────────────────────────

function CenteredLayout({
  masthead, accentColor, headline, treatment, weather, quickLinks,
  liveCount, portalSlug, context, sportsTentpole,
  tabCounts, categoryCounts,
}: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col items-center justify-end text-center min-h-[300px] sm:min-h-[480px] px-6 pb-7 pt-5">
      <LiveBadge liveCount={liveCount} portalSlug={portalSlug} />
      <WeatherPill weather={weather} position="top-right" portalSlug={portalSlug} />

      <div className={`mt-auto mb-1 ${treatment.contentClass || ""}`} style={treatment.contentStyle}>
        <div
          className="animate-fade-in hero-stagger-2"
          style={{ transform: "translateY(var(--parallax-masthead, 0px))" }}
        >
          <div className="flex justify-center mb-2">
            <SignalStrip context={context} sportsTentpole={sportsTentpole} portalSlug={portalSlug} />
          </div>
          <h1
            className="text-[3.5rem] sm:text-[4.5rem] leading-[0.85] tracking-[0.04em] text-[var(--cream)]"
            style={{ fontFamily: "var(--font-masthead), sans-serif", textShadow: treatment.mastheadShadow }}
          >
            {masthead.line1}
          </h1>
          {masthead.line2 && (
            <p
              className="text-[1.75rem] sm:text-[2.25rem] leading-[0.9] tracking-[0.06em] mt-0.5"
              style={{
                fontFamily: "var(--font-masthead), sans-serif",
                color: accentColor,
                textShadow: treatment.mastheadShadow,
              }}
            >
              {masthead.line2}
            </p>
          )}
          <HeadlineSubtitle headline={headline} bodyShadow={treatment.bodyShadow} />
          <SummaryLine tabCounts={tabCounts} categoryCounts={categoryCounts} weather={context.weather} />
        </div>

        <div
          className="animate-fade-in hero-stagger-3 flex justify-center"
          style={{ transform: "translateY(var(--parallax-meta, 0px))" }}
        >
          <HeroQuickLinks links={quickLinks} categoryCounts={categoryCounts?.today} />
        </div>
      </div>
    </div>
  );
}

function BottomLeftLayout({
  masthead, accentColor, headline, treatment, weather, quickLinks,
  liveCount, portalSlug, context, sportsTentpole,
  tabCounts, categoryCounts,
}: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col justify-end min-h-[300px] sm:min-h-[520px] px-6 sm:px-10 pb-8 pt-5">
      <LiveBadge liveCount={liveCount} portalSlug={portalSlug} />
      <WeatherPill weather={weather} position="top-right" portalSlug={portalSlug} />

      <div className={`mt-auto ${treatment.contentClass || ""}`} style={treatment.contentStyle}>
        <div
          className="animate-fade-in hero-stagger-2"
          style={{ transform: "translateY(var(--parallax-masthead, 0px))" }}
        >
          <div className="mb-2">
            <SignalStrip context={context} sportsTentpole={sportsTentpole} portalSlug={portalSlug} />
          </div>
          <h1
            className="text-[3rem] sm:text-[4rem] leading-[0.85] tracking-[0.03em] text-[var(--cream)]"
            style={{ fontFamily: "var(--font-masthead), sans-serif", textShadow: treatment.mastheadShadow }}
          >
            {masthead.line1}
          </h1>
          {masthead.line2 && (
            <p
              className="text-[1.5rem] sm:text-[2rem] leading-[0.9] tracking-[0.05em]"
              style={{
                fontFamily: "var(--font-masthead), sans-serif",
                color: accentColor,
                textShadow: treatment.mastheadShadow,
              }}
            >
              {masthead.line2}
            </p>
          )}
          <HeadlineSubtitle headline={headline} bodyShadow={treatment.bodyShadow} />
          <SummaryLine tabCounts={tabCounts} categoryCounts={categoryCounts} weather={context.weather} />
        </div>

        <div
          className="animate-fade-in hero-stagger-3 mt-3"
          style={{ transform: "translateY(var(--parallax-meta, 0px))" }}
        >
          <HeroQuickLinks links={quickLinks} categoryCounts={categoryCounts?.today} />
        </div>
      </div>
    </div>
  );
}

function SplitLayout({
  masthead, accentColor, headline, treatment, weather, quickLinks,
  liveCount, portalSlug, context, sportsTentpole,
  tabCounts, categoryCounts,
}: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col min-h-[300px] sm:min-h-[480px] px-6 pb-7 pt-6">
      <LiveBadge liveCount={liveCount} portalSlug={portalSlug} />

      {/* Top: masthead + weather side-by-side (pr-14 clears any floating ToC button) */}
      <div className="flex items-start justify-between pr-14">
        <div
          className="animate-fade-in hero-stagger-2"
          style={{ transform: "translateY(var(--parallax-masthead, 0px))" }}
        >
          <div className="mb-2">
            <SignalStrip context={context} sportsTentpole={sportsTentpole} portalSlug={portalSlug} />
          </div>
          <h1
            className="text-[2.5rem] sm:text-[3.25rem] leading-[0.85] tracking-[0.03em] text-[var(--cream)]"
            style={{ fontFamily: "var(--font-masthead), sans-serif", textShadow: treatment.mastheadShadow }}
          >
            {masthead.line1}
          </h1>
          {masthead.line2 && (
            <p
              className="text-[1.25rem] sm:text-[1.75rem] leading-[0.9] tracking-[0.05em]"
              style={{
                fontFamily: "var(--font-masthead), sans-serif",
                color: accentColor,
                textShadow: treatment.mastheadShadow,
              }}
            >
              {masthead.line2}
            </p>
          )}
        </div>
        <WeatherPill weather={weather} position="inline" portalSlug={portalSlug} />
      </div>

      <div className="flex-1" />

      <div className={treatment.contentClass || ""} style={treatment.contentStyle}>
        <div
          className="animate-fade-in hero-stagger-3"
          style={{ transform: "translateY(var(--parallax-meta, 0px))" }}
        >
          <HeadlineSubtitle headline={headline} bodyShadow={treatment.bodyShadow} />
          <SummaryLine tabCounts={tabCounts} categoryCounts={categoryCounts} weather={context.weather} />
          <HeroQuickLinks links={quickLinks} categoryCounts={categoryCounts?.today} />
        </div>
      </div>
    </div>
  );
}

function EditorialLayout({
  masthead, accentColor, headline, treatment, weather, quickLinks,
  liveCount, portalSlug, context, sportsTentpole,
  tabCounts, categoryCounts,
}: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col min-h-[300px] sm:min-h-[480px] px-6 pb-7 pt-5">
      <LiveBadge liveCount={liveCount} portalSlug={portalSlug} />
      <WeatherPill weather={weather} position="top-right" portalSlug={portalSlug} />

      <div className="flex-1" />

      {/* Bottom: right-aligned masthead */}
      <div className={`text-right ${treatment.contentClass || ""}`} style={treatment.contentStyle}>
        <div
          className="animate-fade-in hero-stagger-2"
          style={{ transform: "translateY(var(--parallax-masthead, 0px))" }}
        >
          <div className="flex justify-end mb-2">
            <SignalStrip context={context} sportsTentpole={sportsTentpole} portalSlug={portalSlug} />
          </div>
          <h1
            className="text-[3rem] sm:text-[4rem] leading-[0.85] tracking-[0.04em] text-[var(--cream)]"
            style={{ fontFamily: "var(--font-masthead), sans-serif", textShadow: treatment.mastheadShadow }}
          >
            {masthead.line1}
          </h1>
          {masthead.line2 && (
            <p
              className="text-[1.5rem] sm:text-[2rem] leading-[0.9] tracking-[0.06em]"
              style={{
                fontFamily: "var(--font-masthead), sans-serif",
                color: accentColor,
                textShadow: treatment.mastheadShadow,
              }}
            >
              {masthead.line2}
            </p>
          )}
        </div>
      </div>

      <div
        className="animate-fade-in hero-stagger-3 mt-3"
        style={{ transform: "translateY(var(--parallax-meta, 0px))" }}
      >
        <HeadlineSubtitle headline={headline} bodyShadow={treatment.bodyShadow} />
        <SummaryLine tabCounts={tabCounts} categoryCounts={categoryCounts} weather={context.weather} />
        <HeroQuickLinks links={quickLinks} categoryCounts={categoryCounts?.today} />
      </div>
    </div>
  );
}

// ── Flagship event hero content ───────────────────────────────────────────────

function FlagshipHeroContent({
  flagship,
  weather,
  liveCount,
  portalSlug,
  quickLinks,
  context,
  sportsTentpole,
  categoryCounts,
}: {
  flagship: FlagshipEvent;
  weather: FeedContext["weather"];
  liveCount: number | null;
  portalSlug: string;
  quickLinks?: QuickLink[];
  context: FeedContext;
  sportsTentpole?: ResolvedHeader["sports_tentpole"];
  categoryCounts?: { today: Record<string, number> } | null;
}) {
  return (
    <div className="relative z-10 flex flex-col justify-end min-h-[300px] sm:min-h-[520px] px-6 sm:px-10 pb-8 pt-5">
      <LiveBadge liveCount={liveCount} portalSlug={portalSlug} />
      <WeatherPill
        weather={weather}
        position="top-right"
        portalSlug={portalSlug}
      />

      <div className="mt-auto">
        <div
          className="animate-fade-in hero-stagger-2"
          style={{ transform: "translateY(var(--parallax-masthead, 0px))" }}
        >
          <div className="mb-2">
            <SignalStrip context={context} sportsTentpole={sportsTentpole} portalSlug={portalSlug} />
          </div>
          {/* "HAPPENING NOW" label */}
          <span className="font-mono text-2xs uppercase tracking-[1.2px] text-[var(--gold)]"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>
            HAPPENING NOW
          </span>

          {/* Event title replaces time-of-day masthead */}
          <Link href={flagship.href}>
            <h1
              className="text-[2.25rem] sm:text-[3rem] leading-[0.92] tracking-[0.01em] text-white mt-1 hover:opacity-90 transition-opacity line-clamp-2"
              style={{
                textShadow: "0 2px 16px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.95)",
                fontFamily: "var(--font-masthead), sans-serif",
              }}
            >
              {flagship.title}
            </h1>
          </Link>

          {/* Venue + time + price metadata */}
          {(flagship.venue_name || flagship.start_time || flagship.price_info) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {flagship.venue_name && (
                <span
                  className="text-sm text-[var(--cream)]/80"
                  style={{ textShadow: "0 1px 8px rgba(0,0,0,0.75)" }}
                >
                  {flagship.venue_name}
                </span>
              )}
              {flagship.venue_name && flagship.start_time && (
                <span className="text-[var(--cream)]/50 text-sm">·</span>
              )}
              {flagship.start_time && (
                <span
                  className="font-mono text-sm text-[var(--cream)]/80"
                  style={{ textShadow: "0 1px 8px rgba(0,0,0,0.75)" }}
                >
                  {flagship.start_time}
                </span>
              )}
              {flagship.price_info && (
                <>
                  <span className="text-[var(--cream)]/50 text-sm">·</span>
                  <span
                    className="font-mono text-sm text-[var(--neon-green)]"
                    style={{ textShadow: "0 1px 8px rgba(0,0,0,0.75)" }}
                  >
                    {flagship.price_info}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div
          className="animate-fade-in hero-stagger-3 mt-3"
          style={{ transform: "translateY(var(--parallax-meta, 0px))" }}
        >
          <HeroQuickLinks links={quickLinks} categoryCounts={categoryCounts?.today} />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CityBriefing({
  header,
  context,
  portalSlug,
  quickLinks,
  tabCounts,
  categoryCounts,
  serverHeroUrl,
}: CityBriefingProps) {
  const [liveCount, setLiveCount] = useState<number | null>(null);

  // ── Fetch live count ──────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/portals/${portalSlug}/happening-now?countOnly=true`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (controller.signal.aborted) return;
        const count = (data.eventCount || 0) + (data.spotCount || 0);
        setLiveCount(count);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [portalSlug]);

  // ── Hero configuration ───────────────────────────────────────────────────
  const feedVisible = useFeedVisible();

  const variant = useMemo(
    () => header.layout_variant || getLayoutVariant(context.time_slot, context.day_of_week),
    [header.layout_variant, context.time_slot, context.day_of_week],
  );

  const treatment = useMemo(
    () => getTreatmentStyle(header.text_treatment || "auto"),
    [header.text_treatment],
  );

  const masthead = useMemo(() => getMastheadText(context), [context]);

  // ── Parallax scroll ──────────────────────────────────────────────────────
  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!feedVisible) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const el = heroRef.current;
        if (!el) { ticking = false; return; }
        const rect = el.getBoundingClientRect();
        if (rect.bottom > 0) {
          const offset = -rect.top;
          el.style.setProperty("--parallax-bg", `${offset * 0.4}px`);
          el.style.setProperty("--parallax-weather", `${offset * 0.15}px`);
          el.style.setProperty("--parallax-masthead", `${offset * 0.08}px`);
          el.style.setProperty("--parallax-meta", `${offset * 0.04}px`);
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [feedVisible]);

  // ── Flagship event binding ────────────────────────────────────────────────
  // Flagship events disabled — tentpole data not curated enough.
  // "VIP Show Floor Early Access" was replacing the city hero content.
  // Re-enable when flagship_event is a curated list, not raw is_tentpole inference.
  const flagship = null; // header.flagship_event ?? null;

  // ── Hero image with fallback ─────────────────────────────────────────────
  // CMS header photo or atmospheric city photo. Flagship events get hero cards
  // in the Lineup but don't override the page hero — tentpole data isn't curated
  // enough to trust random event images as the full-bleed background.
  const atmosphericImageUrl = header.hero_image_url;
  const initialHeroUrl = serverHeroUrl ?? atmosphericImageUrl;
  const [heroImageUrl, setHeroImageUrl] = useState(initialHeroUrl);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeroImageUrl(atmosphericImageUrl);
  }, [atmosphericImageUrl]);

  // ── Derived state ────────────────────────────────────────────────────────
  const effectiveQuickLinks = quickLinks ?? header.quick_links ?? [];
  const hasFestival = context.active_festivals.length > 0;
  const hasHoliday = context.active_holidays.length > 0;

  const layoutProps: LayoutProps = {
    masthead,
    accentColor: header.accent_color,
    headline: header.headline,
    treatment,
    weather: context.weather,
    quickLinks: effectiveQuickLinks,
    liveCount,
    portalSlug,
    context,
    sportsTentpole: header.sports_tentpole,
    tabCounts,
    categoryCounts,
  };

  return (
    <section aria-label="City Briefing">
      {/* ── Zone 1: Full-bleed hero ──────────────────────────────────────── */}
      <div style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}>
        <div
          ref={heroRef}
          className="relative overflow-hidden"
        >
          {/* Skeleton background */}
          <div className="absolute inset-0 bg-[var(--night)]" />

          {/* Background photo — Ken Burns + parallax */}
          <div
            className="absolute inset-0 will-change-transform"
            style={{
              transform: "translateY(var(--parallax-bg, 0px))",
              top: "-15%",
              bottom: "-15%",
            }}
          >
            <SmartImage
              src={heroImageUrl}
              alt=""
              fill
              priority
              className="object-cover hero-ken-burns"
              style={{ objectPosition: "center 70%" }}
              sizes="100vw"
              onError={() => setHeroImageUrl(flagship ? atmosphericImageUrl : "/portals/atlanta/jackson-st-bridge.jpg")}
            />
          </div>

          {/* Subtle color wash — slight warmth without killing vibrancy */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(9,9,11,0.05)", mixBlendMode: "multiply" }}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0" style={treatment.overlay} />

          {/* Universal vignette */}
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 50% 40%, transparent 60%, rgba(9,9,11,0.15) 100%)",
            }}
          />

          {/* Extra vignette (cinematic treatment) */}
          {treatment.vignette && (
            <div className="absolute inset-0" style={treatment.vignette} />
          )}

          {/* Layout variant content — flagship event owns the hero when present */}
          {flagship ? (
            <FlagshipHeroContent
              flagship={flagship}
              weather={context.weather}
              liveCount={liveCount}
              portalSlug={portalSlug}
              quickLinks={effectiveQuickLinks}
              context={context}
              sportsTentpole={header.sports_tentpole}
              categoryCounts={categoryCounts}
            />
          ) : (
            <>
              {variant === "centered" && <CenteredLayout {...layoutProps} />}
              {variant === "bottom-left" && <BottomLeftLayout {...layoutProps} />}
              {variant === "split" && <SplitLayout {...layoutProps} />}
              {variant === "editorial" && <EditorialLayout {...layoutProps} />}
            </>
          )}
        </div>

        {/* Festival alert ribbon */}
        {hasFestival && !hasHoliday && (
          <Link
            href={`/${portalSlug}?view=happening&series=${context.active_festivals[0].slug}`}
            className="w-full flex items-center px-4 py-2.5 border text-left transition-colors hover:bg-[var(--dusk)] mt-2 animate-fade-in"
            style={{
              borderColor: `color-mix(in srgb, ${header.accent_color} 30%, var(--twilight))`,
              backgroundColor: `color-mix(in srgb, ${header.accent_color} 4%, var(--night))`,
            }}
          >
            <span className="flex-1 min-w-0">
              <span className="font-mono text-xs font-medium text-[var(--cream)]">
                {context.active_festivals[0].name}
              </span>
              <span className="font-mono text-xs text-[var(--muted)] ml-2">
                is happening today
              </span>
            </span>
            <ArrowRight weight="bold" className="w-3.5 h-3.5 text-[var(--muted)] shrink-0 ml-2" />
          </Link>
        )}
      </div>

      {/* ── Zone 2: News Digest ───────────────────────────────────────────── */}
      <NewsDigest portalSlug={portalSlug} />

    </section>
  );
}
