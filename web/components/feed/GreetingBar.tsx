"use client";

/**
 * GreetingBar — magazine-cover hero with rotating layout treatments.
 *
 * Design: Full-bleed city photo, day/time as giant condensed masthead,
 * editorial headline as subtitle, quiet events pulse metadata.
 * Rotates between layout variants based on time slot for visual variety.
 */

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import type {
  FeedContext,
  DashboardCard,
  ResolvedHeader,
  TimeSlot,
  LayoutVariant,
  TextTreatment,
} from "@/lib/city-pulse/types";
import { formatTemperature, getWeatherIconName } from "@/lib/weather-utils";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  Wind,
  Coffee,
  BeerStein,
  SunHorizon,
  MusicNotes,
  Martini,
  ForkKnife,
  Umbrella,
  Tree,
  PersonSimpleWalk,
  Storefront,
  Bank,
  Path,
  Egg,
  CookingPot,
  SmileyWink,
  CalendarBlank,
  ArrowRight,
} from "@phosphor-icons/react";
import type { IconProps } from "@phosphor-icons/react";

interface GreetingBarProps {
  header: ResolvedHeader;
  context: FeedContext;
  portalSlug: string;
}

// ---------------------------------------------------------------------------
// Layout variants — rotated for visual variety
// ---------------------------------------------------------------------------

/** Pick a layout based on time slot + day for deterministic variety */
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

  const variants: LayoutVariant[] = ["centered", "bottom-left", "split", "editorial"];
  return variants[(dayIdx + slotIdx) % variants.length];
}

// ---------------------------------------------------------------------------
// Masthead text generation
// ---------------------------------------------------------------------------

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

  // Always day + time of day — like subscribing to "MONDAY MORNING" magazine
  return { line1: day, line2: timeLabel };
}

// ---------------------------------------------------------------------------
// Weather icon (kept minimal)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Text treatment system — gradient + shadow + backdrop presets
// ---------------------------------------------------------------------------

interface TreatmentStyle {
  /** CSS for the overlay div */
  overlay: React.CSSProperties;
  /** Optional second overlay (vignette) */
  vignette?: React.CSSProperties;
  /** text-shadow for masthead (h1) */
  mastheadShadow: string;
  /** text-shadow for body text */
  bodyShadow: string;
  /** Optional CSS class for the text content wrapper (frosted backdrop) */
  contentClass?: string;
  /** Optional inline style for content wrapper */
  contentStyle?: React.CSSProperties;
}

function getTreatmentStyle(treatment: TextTreatment, variant: LayoutVariant): TreatmentStyle {
  switch (treatment) {
    case "clean":
      return {
        overlay: getCleanGradient(variant),
        mastheadShadow: "0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.9)",
        bodyShadow: "0 1px 6px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.8)",
      };

    case "frosted":
      return {
        overlay: getLightGradient(variant),
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
        overlay: getHeavyGradient(variant),
        mastheadShadow: "0 3px 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)",
        bodyShadow: "0 2px 8px rgba(0,0,0,0.8), 0 0 3px rgba(0,0,0,1)",
      };

    case "cinematic":
      return {
        overlay: getCinematicGradient(variant),
        vignette: {
          background: "radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(9,9,11,0.6) 100%)",
        },
        mastheadShadow: "0 2px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.3)",
        bodyShadow: "0 1px 10px rgba(0,0,0,0.7), 0 0 20px rgba(0,0,0,0.2)",
      };

    // "auto" — default per variant, with baseline text shadows
    default:
      return {
        overlay: getCleanGradient(variant),
        mastheadShadow: "0 2px 16px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.95), 0 0 40px rgba(0,0,0,0.4)",
        bodyShadow: "0 1px 8px rgba(0,0,0,0.75), 0 0 3px rgba(0,0,0,0.9)",
      };
  }
}

// --- Gradient presets by intensity ---

function getCleanGradient(variant: LayoutVariant): React.CSSProperties {
  const gradients: Record<LayoutVariant, string> = {
    centered: "linear-gradient(to bottom, rgba(9,9,11,0.55) 0%, rgba(9,9,11,0.45) 30%, rgba(9,9,11,0.7) 65%, #09090b 100%)",
    "bottom-left": "linear-gradient(to bottom, rgba(9,9,11,0.5) 0%, rgba(9,9,11,0.4) 40%, rgba(9,9,11,0.8) 75%, #09090b 100%)",
    split: "linear-gradient(170deg, rgba(9,9,11,0.45) 0%, rgba(9,9,11,0.5) 40%, rgba(9,9,11,0.9) 70%, #09090b 100%)",
    editorial: "linear-gradient(to bottom, rgba(9,9,11,0.55) 0%, rgba(9,9,11,0.45) 35%, rgba(9,9,11,0.75) 65%, #09090b 100%)",
  };
  return { background: gradients[variant] };
}

function getLightGradient(variant: LayoutVariant): React.CSSProperties {
  // Lighter gradient for frosted — the backdrop-blur does the heavy lifting
  const gradients: Record<LayoutVariant, string> = {
    centered: "linear-gradient(to bottom, rgba(9,9,11,0.45) 0%, rgba(9,9,11,0.35) 40%, rgba(9,9,11,0.6) 70%, #09090b 100%)",
    "bottom-left": "linear-gradient(to bottom, rgba(9,9,11,0.4) 0%, rgba(9,9,11,0.3) 40%, rgba(9,9,11,0.65) 75%, #09090b 100%)",
    split: "linear-gradient(170deg, rgba(9,9,11,0.35) 0%, rgba(9,9,11,0.4) 40%, rgba(9,9,11,0.75) 70%, #09090b 100%)",
    editorial: "linear-gradient(to bottom, rgba(9,9,11,0.45) 0%, rgba(9,9,11,0.35) 35%, rgba(9,9,11,0.65) 65%, #09090b 100%)",
  };
  return { background: gradients[variant] };
}

function getHeavyGradient(variant: LayoutVariant): React.CSSProperties {
  const gradients: Record<LayoutVariant, string> = {
    centered: "linear-gradient(to bottom, rgba(9,9,11,0.4) 0%, rgba(9,9,11,0.3) 30%, rgba(9,9,11,0.7) 60%, #09090b 100%)",
    "bottom-left": "linear-gradient(to bottom, rgba(9,9,11,0.35) 0%, rgba(9,9,11,0.25) 40%, rgba(9,9,11,0.85) 75%, #09090b 100%)",
    split: "linear-gradient(170deg, rgba(9,9,11,0.25) 0%, rgba(9,9,11,0.45) 40%, rgba(9,9,11,0.92) 70%, #09090b 100%)",
    editorial: "linear-gradient(to bottom, rgba(9,9,11,0.45) 0%, rgba(9,9,11,0.35) 35%, rgba(9,9,11,0.75) 65%, #09090b 100%)",
  };
  return { background: gradients[variant] };
}

function getCinematicGradient(variant: LayoutVariant): React.CSSProperties {
  const gradients: Record<LayoutVariant, string> = {
    centered: "linear-gradient(to bottom, rgba(9,9,11,0.35) 0%, rgba(9,9,11,0.2) 35%, rgba(9,9,11,0.6) 60%, #09090b 100%)",
    "bottom-left": "linear-gradient(to bottom, rgba(9,9,11,0.3) 0%, rgba(9,9,11,0.15) 40%, rgba(9,9,11,0.75) 75%, #09090b 100%)",
    split: "linear-gradient(170deg, rgba(9,9,11,0.2) 0%, rgba(9,9,11,0.35) 40%, rgba(9,9,11,0.88) 70%, #09090b 100%)",
    editorial: "linear-gradient(to bottom, rgba(9,9,11,0.4) 0%, rgba(9,9,11,0.25) 35%, rgba(9,9,11,0.65) 65%, #09090b 100%)",
  };
  return { background: gradients[variant] };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GreetingBar({ header, context, portalSlug }: GreetingBarProps) {
  const headline = header.headline;
  const cityPhoto = header.hero_image_url;
  const accentColor = header.accent_color;
  const eventsPulse = header.events_pulse;

  const hasFestival = context.active_festivals.length > 0;
  const hasHoliday = context.active_holidays.length > 0;

  const variant = useMemo(
    () => header.layout_variant || getLayoutVariant(context.time_slot, context.day_of_week),
    [header.layout_variant, context.time_slot, context.day_of_week],
  );

  const treatment = useMemo(
    () => getTreatmentStyle(header.text_treatment || "auto", variant),
    [header.text_treatment, variant],
  );

  const masthead = useMemo(() => getMastheadText(context), [context]);

  // Metadata line: weather + event count
  const metaItems: string[] = [];
  if (context.weather) {
    metaItems.push(`${Math.round(context.weather.temperature_f)}${String.fromCharCode(176)}`);
  }
  if (eventsPulse.total_active > 0) {
    metaItems.push(`${eventsPulse.total_active} events today`);
  }

  const layoutProps: LayoutProps = {
    masthead,
    headline,
    subtitle: header.subtitle,
    accentColor,
    metaItems,
    weather: context.weather,
    trending: eventsPulse.trending_event,
    treatment,
  };

  return (
    <div>
      {/* ── Photo hero ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Background photo */}
        <Image
          src={cityPhoto}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 860px"
        />

        {/* Gradient overlay — varies per treatment + layout */}
        <div className="absolute inset-0" style={treatment.overlay} />

        {/* Vignette overlay (cinematic treatment) */}
        {treatment.vignette && (
          <div className="absolute inset-0" style={treatment.vignette} />
        )}

        {/* Content — layout varies */}
        {variant === "centered" && <CenteredLayout {...layoutProps} />}
        {variant === "bottom-left" && <BottomLeftLayout {...layoutProps} />}
        {variant === "split" && <SplitLayout {...layoutProps} />}
        {variant === "editorial" && <EditorialLayout {...layoutProps} />}
      </div>

      {/* ── Festival/holiday alert ─────────────────────────────── */}
      {hasFestival && !hasHoliday && (
        <Link
          href={`/${portalSlug}?view=find&type=events&series=${context.active_festivals[0].slug}`}
          className="w-full flex items-center rounded-xl px-4 py-2.5 border text-left transition-colors hover:bg-[var(--dusk)] mt-2"
          style={{
            borderColor: `color-mix(in srgb, ${accentColor} 30%, var(--twilight))`,
            backgroundColor: `color-mix(in srgb, ${accentColor} 4%, var(--night))`,
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
  );
}

// ---------------------------------------------------------------------------
// Layout shared props
// ---------------------------------------------------------------------------

interface LayoutProps {
  masthead: { line1: string; line2: string };
  headline: string;
  subtitle?: string;
  accentColor: string;
  metaItems: string[];
  weather: FeedContext["weather"];
  trending: string | null;
  treatment: TreatmentStyle;
}

// ---------------------------------------------------------------------------
// Variant: Centered — magazine cover, centered masthead
// ---------------------------------------------------------------------------

function CenteredLayout({ masthead, headline, subtitle, accentColor, metaItems, weather, trending, treatment }: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col items-center justify-end text-center min-h-[260px] sm:min-h-[300px] px-6 pb-7 pt-5">
      {/* Top: weather pill */}
      {weather && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[var(--cream)]/70" style={{ textShadow: treatment.bodyShadow }}>
          <WeatherIcon icon={weather.icon} className="w-3.5 h-3.5" />
          <span className="font-mono text-xs tracking-wide">
            {formatTemperature(weather.temperature_f)}
          </span>
        </div>
      )}

      {/* Masthead — giant condensed type */}
      <div className={`mt-auto mb-1 ${treatment.contentClass || ""}`} style={treatment.contentStyle}>
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

        {/* Editorial headline */}
        <p className="text-sm sm:text-base text-[var(--cream)]/90 mt-3 max-w-[320px] leading-snug" style={{ textShadow: treatment.bodyShadow }}>
          {headline}
          {subtitle && (
            <span className="text-[var(--cream)]/65 ml-1">{subtitle}</span>
          )}
        </p>

        {/* Metadata line */}
        <MetadataLine items={metaItems} trending={trending} accentColor={accentColor} centered bodyShadow={treatment.bodyShadow} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant: Bottom-left — classic editorial, content anchored bottom-left
// ---------------------------------------------------------------------------

function BottomLeftLayout({ masthead, headline, subtitle, accentColor, metaItems, weather, trending, treatment }: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col justify-end min-h-[260px] sm:min-h-[300px] px-6 pb-7 pt-5">
      {/* Top-right: weather */}
      {weather && (
        <div className="absolute top-4 right-5 flex items-center gap-1.5 text-[var(--cream)]/65" style={{ textShadow: treatment.bodyShadow }}>
          <WeatherIcon icon={weather.icon} className="w-3.5 h-3.5" />
          <span className="font-mono text-xs tracking-wide">
            {formatTemperature(weather.temperature_f)}
          </span>
        </div>
      )}

      {/* Masthead */}
      <div className={`mt-auto ${treatment.contentClass || ""}`} style={treatment.contentStyle}>
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

        {/* Headline + accent rule */}
        <div className="mt-3 flex items-start gap-3">
          <div
            className="w-0.5 shrink-0 self-stretch rounded-full mt-0.5"
            style={{ backgroundColor: accentColor, opacity: 0.6 }}
          />
          <div>
            <p className="text-sm text-[var(--cream)]/70 leading-snug max-w-[280px]" style={{ textShadow: treatment.bodyShadow }}>
              {headline}
            </p>
            {subtitle && (
              <p className="text-xs text-[var(--cream)]/65 mt-0.5 leading-snug" style={{ textShadow: treatment.bodyShadow }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Metadata */}
        <MetadataLine items={metaItems} trending={trending} accentColor={accentColor} bodyShadow={treatment.bodyShadow} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant: Split — masthead top, content bottom with breathing room
// ---------------------------------------------------------------------------

function SplitLayout({ masthead, headline, subtitle, accentColor, metaItems, weather, trending, treatment }: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col min-h-[260px] sm:min-h-[300px] px-6 pb-7 pt-6">
      {/* Top: masthead + weather side-by-side */}
      <div className="flex items-start justify-between">
        <div>
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
        {weather && (
          <div className="flex items-center gap-1.5 text-[var(--cream)]/35 mt-2" style={{ textShadow: treatment.bodyShadow }}>
            <WeatherIcon icon={weather.icon} className="w-4 h-4" />
            <span className="font-mono text-xs">
              {formatTemperature(weather.temperature_f)}
            </span>
          </div>
        )}
      </div>

      {/* Spacer — lets the photo breathe */}
      <div className="flex-1" />

      {/* Bottom: headline + metadata */}
      <div className={treatment.contentClass || ""} style={treatment.contentStyle}>
        <p className="text-base text-[var(--cream)]/90 leading-snug max-w-[300px]" style={{ textShadow: treatment.bodyShadow }}>
          {headline}
        </p>
        {subtitle && (
          <p className="text-xs text-[var(--cream)]/65 mt-1 leading-snug" style={{ textShadow: treatment.bodyShadow }}>
            {subtitle}
          </p>
        )}
        <MetadataLine items={metaItems} trending={trending} accentColor={accentColor} bodyShadow={treatment.bodyShadow} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant: Editorial — right-aligned masthead, left-aligned copy
// ---------------------------------------------------------------------------

function EditorialLayout({ masthead, headline, subtitle, accentColor, metaItems, weather, trending, treatment }: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col min-h-[260px] sm:min-h-[300px] px-6 pb-7 pt-5">
      {/* Top-left: weather */}
      {weather && (
        <div className="flex items-center gap-1.5 text-[var(--cream)]/65" style={{ textShadow: treatment.bodyShadow }}>
          <WeatherIcon icon={weather.icon} className="w-3.5 h-3.5" />
          <span className="font-mono text-xs tracking-wide">
            {formatTemperature(weather.temperature_f)}
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* Bottom: right-aligned masthead */}
      <div className={`text-right ${treatment.contentClass || ""}`} style={treatment.contentStyle}>
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

      {/* Left-aligned headline underneath — creates asymmetric tension */}
      <p className="text-sm text-[var(--cream)]/70 mt-3 leading-snug max-w-[260px]" style={{ textShadow: treatment.bodyShadow }}>
        {headline}
        {subtitle && (
          <span className="text-[var(--cream)]/65 ml-1">{subtitle}</span>
        )}
      </p>

      {/* Metadata */}
      <MetadataLine items={metaItems} trending={trending} accentColor={accentColor} bodyShadow={treatment.bodyShadow} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: metadata line (events count + trending)
// ---------------------------------------------------------------------------

function MetadataLine({
  items,
  trending,
  accentColor,
  centered,
  bodyShadow,
}: {
  items: string[];
  trending: string | null;
  accentColor: string;
  centered?: boolean;
  bodyShadow?: string;
}) {
  if (items.length === 0 && !trending) return null;

  return (
    <div
      className={`flex items-center gap-2.5 mt-3 flex-wrap ${
        centered ? "justify-center" : ""
      }`}
      style={bodyShadow ? { textShadow: bodyShadow } : undefined}
    >
      {items.map((item) => (
        <span key={item} className="font-mono text-2xs tracking-wide text-[var(--cream)]/35 uppercase">
          {item}
        </span>
      ))}

      {trending && (
        <>
          <span className="w-px h-2.5 bg-[var(--cream)]/15" />
          <span
            className="text-xs italic truncate max-w-[180px] sm:max-w-[220px]"
            style={{ color: `color-mix(in srgb, ${accentColor} 70%, var(--cream))` }}
          >
            {trending}
          </span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard card (glass-card styling) — kept as named export
// ---------------------------------------------------------------------------

const CARD_ICONS: Record<string, React.ComponentType<IconProps>> = {
  Coffee,
  PersonSimpleWalk,
  Storefront,
  Tree,
  SunHorizon,
  Path,
  MusicNotes,
  Martini,
  ForkKnife,
  Umbrella,
  BeerStein,
  Bank,
  Egg,
  CookingPot,
  SmileyWink,
  CalendarBlank,
};

function CardIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = CARD_ICONS[name];
  if (!IconComponent) return null;
  return <IconComponent weight="duotone" className={className || "w-5 h-5"} />;
}

export function DashboardCardComponent({ card }: { card: DashboardCard }) {
  const accent = card.accent || "var(--coral)";

  return (
    <Link
      href={card.href}
      className="flex-1 min-w-[130px] rounded-xl glass-card px-3 py-2.5 transition-colors hover:bg-white/[0.06] group"
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)` }}
        >
          <span style={{ color: accent }}>
            <CardIcon name={card.icon} className="w-4 h-4" />
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-[0.1em] text-[var(--muted)] group-hover:text-[var(--soft)] transition-colors">
          {card.label}
        </span>
        <span className="font-mono text-xs font-bold text-[var(--cream)] ml-auto tabular-nums">
          {card.value}
        </span>
      </div>
    </Link>
  );
}
