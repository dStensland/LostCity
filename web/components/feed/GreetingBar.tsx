"use client";

/**
 * GreetingBar — magazine-cover hero with rotating layout treatments.
 *
 * Design: Full-bleed city photo, day/time as giant condensed masthead,
 * editorial headline as subtitle, quiet events pulse metadata.
 * Rotates between layout variants based on time slot for visual variety.
 */

import { useMemo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useFeedVisible } from "@/lib/feed-visibility";
import type {
  FeedContext,
  ResolvedHeader,
  TimeSlot,
  LayoutVariant,
  TextTreatment,
  QuickLink,
  DashboardCard,
} from "@/lib/city-pulse/types";
import { formatTemperature, getWeatherIconName } from "@/lib/weather-utils";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  Wind,
  ArrowRight,
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
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";

// Icon map for quick link pills
const QUICK_LINK_ICONS: Record<string, PhosphorIcon> = {
  Coffee, ForkKnife, Barbell, Storefront, CalendarBlank, Ticket,
  BeerStein, MoonStars, MusicNotes, SmileyWink, Champagne,
  CalendarCheck, Park, SunHorizon, Bank, GameController, UsersThree, PaintBrush,
};

interface GreetingBarProps {
  header: ResolvedHeader;
  context: FeedContext;
  portalSlug: string;
  quickLinks?: QuickLink[];
  dashboardCards?: DashboardCard[];
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
// Text treatment system — 3 gradient intensities + shadow presets
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

/**
 * 3 gradient intensity levels — replaces the old 4×5 matrix.
 *
 * "light"    — frosted treatment (backdrop-blur does the heavy lifting)
 * "standard" — default for clean/auto (good all-around)
 * "heavy"    — bold/cinematic (darker for maximum photo visibility in middle)
 */
type GradientIntensity = "light" | "standard" | "heavy";

/**
 * Eased multi-stop gradients — Netflix "three-zone" pattern.
 *
 * Zone 1 (top): Darkened sky — anchor for weather pill readability
 * Zone 2 (mid): Lighter — lets the hero photo breathe
 * Zone 3 (bottom): Darkest — anchors text content with full readability
 *
 * 8-10 stops mimic natural light falloff vs. the harsh 4-stop linear look.
 */
const GRADIENT_PRESETS: Record<GradientIntensity, string> = {
  light: [
    "linear-gradient(to bottom,",
    "rgba(9,9,11,0.45) 0%,",
    "rgba(9,9,11,0.35) 12%,",
    "rgba(9,9,11,0.2) 28%,",
    "rgba(9,9,11,0.15) 42%,",
    "rgba(9,9,11,0.18) 55%,",
    "rgba(9,9,11,0.35) 68%,",
    "rgba(9,9,11,0.6) 82%,",
    "rgba(9,9,11,0.85) 92%,",
    "#09090b 100%)",
  ].join(" "),
  standard: [
    "linear-gradient(to bottom,",
    "rgba(9,9,11,0.55) 0%,",
    "rgba(9,9,11,0.45) 10%,",
    "rgba(9,9,11,0.3) 25%,",
    "rgba(9,9,11,0.22) 40%,",
    "rgba(9,9,11,0.25) 52%,",
    "rgba(9,9,11,0.45) 65%,",
    "rgba(9,9,11,0.7) 78%,",
    "rgba(9,9,11,0.9) 90%,",
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
        overlay: { background: GRADIENT_PRESETS.standard },
        mastheadShadow: "0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.9)",
        bodyShadow: "0 1px 6px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.8)",
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

    // "auto" — default, with strong text shadows for guaranteed readability
    default:
      return {
        overlay: { background: GRADIENT_PRESETS.standard },
        mastheadShadow: "0 2px 16px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.95), 0 0 40px rgba(0,0,0,0.4)",
        bodyShadow: "0 1px 8px rgba(0,0,0,0.75), 0 0 3px rgba(0,0,0,0.9)",
      };
  }
}

// ---------------------------------------------------------------------------
// Hero quick links — subtle glassmorphic colored pills inside the hero
// ---------------------------------------------------------------------------

/** Extract just the number from a dashboard card value like "523 today" */
function extractBadge(card: DashboardCard): string | null {
  const match = card.value.match(/^(\d+)/);
  return match ? match[1] : null;
}

function findMatchingCard(
  link: QuickLink,
  cards: DashboardCard[],
): DashboardCard | undefined {
  return cards.find((c) => c.icon === link.icon) ??
    cards.find((c) => {
      const linkBase = link.href.split("?")[1] || "";
      const cardBase = c.href.split("?")[1] || "";
      return linkBase && cardBase && linkBase === cardBase;
    });
}

function HeroQuickLinks({
  links,
  dashboardCards,
}: {
  links?: QuickLink[];
  dashboardCards?: DashboardCard[];
}) {
  if (!links || links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5">
      {links.map((link) => {
        const IconComp = QUICK_LINK_ICONS[link.icon];
        const card = dashboardCards ? findMatchingCard(link, dashboardCards) : undefined;
        const badge = card ? extractBadge(card) : null;

        return (
          <Link
            key={link.label}
            href={link.href}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/20 backdrop-blur-sm border border-white/[0.08] transition-all hover:bg-black/30 hover:border-white/[0.15]"
          >
            {IconComp && (
              <IconComp
                weight="duotone"
                className="w-3 h-3"
                style={{ color: link.accent_color }}
              />
            )}
            <span
              className="font-mono text-2xs font-medium tracking-wide"
              style={{ color: link.accent_color }}
            >
              {link.label}
            </span>
            {badge && (
              <span
                className="font-mono text-2xs font-bold tabular-nums opacity-60"
                style={{ color: link.accent_color }}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GreetingBar({ header, context, portalSlug, quickLinks, dashboardCards }: GreetingBarProps) {
  const cityPhoto = header.hero_image_url;
  const accentColor = header.accent_color;
  const eventsPulse = header.events_pulse;
  const feedVisible = useFeedVisible();

  const hasFestival = context.active_festivals.length > 0;
  const hasHoliday = context.active_holidays.length > 0;

  const variant = useMemo(
    () => header.layout_variant || getLayoutVariant(context.time_slot, context.day_of_week),
    [header.layout_variant, context.time_slot, context.day_of_week],
  );

  const treatment = useMemo(
    () => getTreatmentStyle(header.text_treatment || "auto"),
    [header.text_treatment],
  );

  const masthead = useMemo(() => getMastheadText(context), [context]);

  // ── Parallax scroll effect ──────────────────────────────────────────
  const heroRef = useRef<HTMLDivElement>(null);
  const [parallaxY, setParallaxY] = useState(0);
  const [contentParallax, setContentParallax] = useState({ weather: 0, masthead: 0, meta: 0 });

  useEffect(() => {
    // Pause scroll listener when feed is hidden behind a detail view
    if (!feedVisible) return;

    // Disable parallax for users who prefer reduced motion
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
        // Only apply parallax while hero is in viewport
        if (rect.bottom > 0) {
          const offset = -rect.top;
          // Background: deepest layer, lags most
          setParallaxY(offset * 0.4);
          // Content layers: progressively less parallax = closer to viewer
          setContentParallax({
            weather: offset * 0.15,   // Mid-depth — floats above image
            masthead: offset * 0.08,  // Foreground — subtle lag
            meta: offset * 0.04,      // Near-surface — barely perceptible
          });
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [feedVisible]);

  // Metadata line: event count only (weather shown in glassmorphic pill)
  const metaItems: string[] = [];
  if (eventsPulse.total_active > 0) {
    metaItems.push(`${eventsPulse.total_active} events today`);
  }

  const layoutProps: LayoutProps = {
    masthead,
    accentColor,
    metaItems,
    weather: context.weather,
    treatment,
    quickLinks,
    dashboardCards,
    contentParallax,
  };

  return (
    <div>
      {/* ── Photo hero — full viewport bleed (escapes max-w + px-4 container) ── */}
      <div
        ref={heroRef}
        className="relative overflow-hidden"
        style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
      >
        {/* Skeleton background while image loads */}
        <div className="absolute inset-0 bg-[var(--night)]" />

        {/* Background photo — Ken Burns slow zoom + parallax scroll */}
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translateY(${parallaxY}px)`,
            // Oversize the image container so parallax shift doesn't reveal edges
            top: "-15%",
            bottom: "-15%",
          }}
        >
          <Image
            src={cityPhoto}
            alt=""
            fill
            priority
            className="object-cover hero-ken-burns"
            sizes="(max-width: 768px) 100vw, 860px"
          />
        </div>

        {/* Gradient overlay — eased multi-stop */}
        <div className="absolute inset-0" style={treatment.overlay} />

        {/* Universal subtle vignette — darkens edges, draws eye to center */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 50% 40%, transparent 50%, rgba(9,9,11,0.35) 100%)",
          }}
        />

        {/* Extra vignette overlay (cinematic treatment) */}
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
  accentColor: string;
  metaItems: string[];
  weather: FeedContext["weather"];
  treatment: TreatmentStyle;
  quickLinks?: QuickLink[];
  dashboardCards?: DashboardCard[];
  contentParallax: { weather: number; masthead: number; meta: number };
}

// ---------------------------------------------------------------------------
// Variant: Centered — magazine cover, centered masthead
// ---------------------------------------------------------------------------

function CenteredLayout({ masthead, accentColor, metaItems, weather, treatment, quickLinks, dashboardCards, contentParallax }: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col items-center justify-end text-center min-h-[260px] sm:min-h-[300px] px-6 pb-7 pt-5">
      {/* Top: glassmorphic weather pill */}
      {weather && (
        <div
          className="absolute top-4 right-16 animate-fade-in hero-stagger-1 will-change-transform"
          style={{ transform: `translateY(${contentParallax.weather}px)` }}
        >
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-black/25 backdrop-blur-md border border-white/10 text-[var(--cream)]/80">
            <WeatherIcon icon={weather.icon} className="w-3.5 h-3.5" />
            <span className="font-mono text-xs tracking-wide">
              {formatTemperature(weather.temperature_f)}
            </span>
          </div>
        </div>
      )}

      {/* Masthead — giant condensed type */}
      <div className={`mt-auto mb-1 ${treatment.contentClass || ""}`} style={treatment.contentStyle}>
        <div
          className="animate-fade-in hero-stagger-2 will-change-transform"
          style={{ transform: `translateY(${contentParallax.masthead}px)` }}
        >
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
        </div>

        {/* Metadata + quick links */}
        <div
          className="animate-fade-in hero-stagger-3 will-change-transform"
          style={{ transform: `translateY(${contentParallax.meta}px)` }}
        >
          <MetadataLine items={metaItems} centered bodyShadow={treatment.bodyShadow} />
          <div className="flex justify-center">
            <HeroQuickLinks links={quickLinks} dashboardCards={dashboardCards} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant: Bottom-left — classic editorial, content anchored bottom-left
// ---------------------------------------------------------------------------

function BottomLeftLayout({ masthead, accentColor, metaItems, weather, treatment, quickLinks, dashboardCards, contentParallax }: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col justify-end min-h-[260px] sm:min-h-[300px] px-6 pb-7 pt-5">
      {/* Top-right: glassmorphic weather pill */}
      {weather && (
        <div
          className="absolute top-4 right-16 animate-fade-in hero-stagger-1 will-change-transform"
          style={{ transform: `translateY(${contentParallax.weather}px)` }}
        >
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-black/25 backdrop-blur-md border border-white/10 text-[var(--cream)]/80">
            <WeatherIcon icon={weather.icon} className="w-3.5 h-3.5" />
            <span className="font-mono text-xs tracking-wide">
              {formatTemperature(weather.temperature_f)}
            </span>
          </div>
        </div>
      )}

      {/* Masthead */}
      <div className={`mt-auto ${treatment.contentClass || ""}`} style={treatment.contentStyle}>
        <div
          className="animate-fade-in hero-stagger-2 will-change-transform"
          style={{ transform: `translateY(${contentParallax.masthead}px)` }}
        >
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
        </div>

        {/* Metadata + quick links */}
        <div
          className="animate-fade-in hero-stagger-3 mt-3 will-change-transform"
          style={{ transform: `translateY(${contentParallax.meta}px)` }}
        >
          <MetadataLine items={metaItems} bodyShadow={treatment.bodyShadow} />
          <HeroQuickLinks links={quickLinks} dashboardCards={dashboardCards} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant: Split — masthead top, content bottom with breathing room
// ---------------------------------------------------------------------------

function SplitLayout({ masthead, accentColor, metaItems, weather, treatment, quickLinks, dashboardCards, contentParallax }: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col min-h-[260px] sm:min-h-[300px] px-6 pb-7 pt-6">
      {/* Top: masthead + weather side-by-side (pr-14 clears fixed ToC button) */}
      <div className="flex items-start justify-between pr-14">
        <div
          className="animate-fade-in hero-stagger-2 will-change-transform"
          style={{ transform: `translateY(${contentParallax.masthead}px)` }}
        >
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
          <div
            className="animate-fade-in hero-stagger-1 will-change-transform"
            style={{ transform: `translateY(${contentParallax.weather}px)` }}
          >
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-black/25 backdrop-blur-md border border-white/10 text-[var(--cream)]/80 mt-2">
              <WeatherIcon icon={weather.icon} className="w-4 h-4" />
              <span className="font-mono text-xs">
                {formatTemperature(weather.temperature_f)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Spacer — lets the photo breathe */}
      <div className="flex-1" />

      {/* Bottom: metadata + quick links */}
      <div className={treatment.contentClass || ""} style={treatment.contentStyle}>
        <div
          className="animate-fade-in hero-stagger-3 will-change-transform"
          style={{ transform: `translateY(${contentParallax.meta}px)` }}
        >
          <MetadataLine items={metaItems} bodyShadow={treatment.bodyShadow} />
          <HeroQuickLinks links={quickLinks} dashboardCards={dashboardCards} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant: Editorial — right-aligned masthead, left-aligned copy
// ---------------------------------------------------------------------------

function EditorialLayout({ masthead, accentColor, metaItems, weather, treatment, quickLinks, dashboardCards, contentParallax }: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col min-h-[260px] sm:min-h-[300px] px-6 pb-7 pt-5">
      {/* Top-left: glassmorphic weather pill */}
      {weather && (
        <div
          className="animate-fade-in hero-stagger-1 will-change-transform"
          style={{ transform: `translateY(${contentParallax.weather}px)` }}
        >
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-black/25 backdrop-blur-md border border-white/10 text-[var(--cream)]/80">
            <WeatherIcon icon={weather.icon} className="w-3.5 h-3.5" />
            <span className="font-mono text-xs tracking-wide">
              {formatTemperature(weather.temperature_f)}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* Bottom: right-aligned masthead */}
      <div className={`text-right ${treatment.contentClass || ""}`} style={treatment.contentStyle}>
        <div
          className="animate-fade-in hero-stagger-2 will-change-transform"
          style={{ transform: `translateY(${contentParallax.masthead}px)` }}
        >
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

      {/* Metadata + quick links */}
      <div
        className="animate-fade-in hero-stagger-3 mt-3 will-change-transform"
        style={{ transform: `translateY(${contentParallax.meta}px)` }}
      >
        <MetadataLine items={metaItems} bodyShadow={treatment.bodyShadow} />
        <HeroQuickLinks links={quickLinks} dashboardCards={dashboardCards} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: metadata line (events count)
// ---------------------------------------------------------------------------

function MetadataLine({
  items,
  centered,
}: {
  items: string[];
  centered?: boolean;
  bodyShadow?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 mt-3 rounded-lg px-3 py-2 bg-black/20 backdrop-blur-sm border border-white/[0.06] ${
        centered ? "justify-center" : ""
      }`}
    >
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-2">
          {i > 0 && <Dot className="text-[var(--cream)]/25" />}
          <span className="font-mono text-xs tracking-wide text-[var(--cream)]/60 uppercase">
            {item}
          </span>
        </span>
      ))}
    </div>
  );
}
