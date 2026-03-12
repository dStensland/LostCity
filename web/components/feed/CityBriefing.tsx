"use client";

/**
 * CityBriefing — unified city overview with full-bleed cinematic hero +
 * briefing card (Coming Up festivals, local news).
 *
 * Zone 1: Full-viewport-bleed hero (parallax, Ken Burns, layout variants,
 *         weather pill, live badge, quick links) — stolen from GreetingBar.
 * Zone 2: Briefing card (Coming Up + News) — sits below the hero.
 *
 * Self-fetching (parallel):
 *   - /api/festivals/upcoming     → festivals + standalone tentpoles
 *   - /api/portals/[slug]/network-feed → local news posts
 *   - /api/portals/[slug]/happening-now?countOnly=true → live count
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Lightning,
  ArrowRight,
  ArrowSquareOut,
  Broadcast,
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
import SmartImage from "@/components/SmartImage";
import Dot from "@/components/ui/Dot";
import type { Festival } from "@/lib/festivals";
import {
  computeCountdown,
  getUrgencyColor,
  formatFestivalDates,
} from "@/lib/moments-utils";
import type { NetworkPost } from "./sections/NetworkFeedSection";
import { getCategoryColor, CATEGORY_ICONS } from "./sections/NetworkFeedSection";
import type {
  FeedContext,
  ResolvedHeader,
  TimeSlot,
  LayoutVariant,
  TextTreatment,
  QuickLink,
} from "@/lib/city-pulse/types";
import { formatTemperature, getWeatherIconName } from "@/lib/weather-utils";
import { useFeedVisible } from "@/lib/feed-visibility";

// ── Icon map for quick link pills ────────────────────────────────────────────

const QUICK_LINK_ICONS: Record<string, PhosphorIcon> = {
  Coffee, ForkKnife, Barbell, Storefront, CalendarBlank, Ticket,
  BeerStein, MoonStars, MusicNotes, SmileyWink, Champagne,
  CalendarCheck, Park, SunHorizon, Bank, GameController, UsersThree, PaintBrush,
};

// ── Types ─────────────────────────────────────────────────────────────────────

type StandaloneTentpole = {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
  image_url: string | null;
  description: string | null;
  source_id: number | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
};

type BigStuffItem = {
  id: string;
  kind: "festival" | "event";
  title: string;
  start: string | null;
  end: string | null;
  location: string | null;
  imageUrl: string | null;
  href: string;
  countdownText: string;
  urgencyColor: string;
};

export interface CityBriefingProps {
  header: ResolvedHeader;
  context: FeedContext;
  portalSlug: string;
  portalId: string;
  quickLinks?: QuickLink[];
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

  const variants: LayoutVariant[] = ["centered", "bottom-left", "split", "editorial"];
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
        overlay: { background: GRADIENT_PRESETS.light },
        mastheadShadow: "0 2px 16px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.95)",
        bodyShadow: "0 1px 8px rgba(0,0,0,0.7), 0 0 3px rgba(0,0,0,0.9)",
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
        overlay: { background: GRADIENT_PRESETS.light },
        mastheadShadow: "0 2px 16px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.95), 0 0 40px rgba(0,0,0,0.4)",
        bodyShadow: "0 1px 8px rgba(0,0,0,0.75), 0 0 3px rgba(0,0,0,0.9)",
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

function HeroQuickLinks({ links }: { links?: QuickLink[] }) {
  if (!links || links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5">
      {links.filter((link) => QUICK_LINK_ICONS[link.icon]).map((link) => {
        const IconComp = QUICK_LINK_ICONS[link.icon];
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
  contentParallax: { weather: number; masthead: number; meta: number };
  liveCount: number | null;
  portalSlug: string;
}

// ── Weather pill (shared across variants) ────────────────────────────────────

function WeatherPill({
  weather,
  parallaxY,
  position = "top-right",
}: {
  weather: FeedContext["weather"];
  parallaxY: number;
  position?: "top-right" | "top-left" | "inline";
}) {
  if (!weather) return null;

  const posClass =
    position === "top-right"
      ? "absolute top-4 right-20"
      : position === "top-left"
        ? "absolute top-4 left-4"
        : "";

  return (
    <div
      className={`${posClass} animate-fade-in hero-stagger-1 will-change-transform`}
      style={{ transform: `translateY(${parallaxY}px)` }}
    >
      <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-black/25 backdrop-blur-md border border-white/10 text-[var(--cream)]/80">
        <WeatherIcon icon={weather.icon} className="w-3.5 h-3.5" />
        <span className="font-mono text-xs tracking-wide">
          {formatTemperature(weather.temperature_f)}
        </span>
      </div>
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
  contentParallax, liveCount, portalSlug,
}: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col items-center justify-end text-center min-h-[300px] sm:min-h-[480px] px-6 pb-7 pt-5">
      <LiveBadge liveCount={liveCount} portalSlug={portalSlug} />
      <WeatherPill weather={weather} parallaxY={contentParallax.weather} position="top-right" />

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
          <HeadlineSubtitle headline={headline} bodyShadow={treatment.bodyShadow} />
        </div>

        <div
          className="animate-fade-in hero-stagger-3 will-change-transform flex justify-center"
          style={{ transform: `translateY(${contentParallax.meta}px)` }}
        >
          <HeroQuickLinks links={quickLinks} />
        </div>
      </div>
    </div>
  );
}

function BottomLeftLayout({
  masthead, accentColor, headline, treatment, weather, quickLinks,
  contentParallax, liveCount, portalSlug,
}: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col justify-end min-h-[300px] sm:min-h-[480px] px-6 pb-7 pt-5">
      <LiveBadge liveCount={liveCount} portalSlug={portalSlug} />
      <WeatherPill weather={weather} parallaxY={contentParallax.weather} position="top-right" />

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
          <HeadlineSubtitle headline={headline} bodyShadow={treatment.bodyShadow} />
        </div>

        <div
          className="animate-fade-in hero-stagger-3 mt-3 will-change-transform"
          style={{ transform: `translateY(${contentParallax.meta}px)` }}
        >
          <HeroQuickLinks links={quickLinks} />
        </div>
      </div>
    </div>
  );
}

function SplitLayout({
  masthead, accentColor, headline, treatment, weather, quickLinks,
  contentParallax, liveCount, portalSlug,
}: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col min-h-[300px] sm:min-h-[480px] px-6 pb-7 pt-6">
      <LiveBadge liveCount={liveCount} portalSlug={portalSlug} />

      {/* Top: masthead + weather side-by-side (pr-14 clears any floating ToC button) */}
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
        <WeatherPill weather={weather} parallaxY={contentParallax.weather} position="inline" />
      </div>

      <div className="flex-1" />

      <div className={treatment.contentClass || ""} style={treatment.contentStyle}>
        <div
          className="animate-fade-in hero-stagger-3 will-change-transform"
          style={{ transform: `translateY(${contentParallax.meta}px)` }}
        >
          <HeadlineSubtitle headline={headline} bodyShadow={treatment.bodyShadow} />
          <HeroQuickLinks links={quickLinks} />
        </div>
      </div>
    </div>
  );
}

function EditorialLayout({
  masthead, accentColor, headline, treatment, weather, quickLinks,
  contentParallax, liveCount, portalSlug,
}: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col min-h-[300px] sm:min-h-[480px] px-6 pb-7 pt-5">
      <LiveBadge liveCount={liveCount} portalSlug={portalSlug} />
      <WeatherPill weather={weather} parallaxY={contentParallax.weather} position="top-left" />

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

      <div
        className="animate-fade-in hero-stagger-3 mt-3 will-change-transform"
        style={{ transform: `translateY(${contentParallax.meta}px)` }}
      >
        <HeadlineSubtitle headline={headline} bodyShadow={treatment.bodyShadow} />
        <HeroQuickLinks links={quickLinks} />
      </div>
    </div>
  );
}

// ── Briefing card sub-components ──────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function UrgencyBadge({ text, color }: { text: string; color: string }) {
  const isLive = text === "Happening Now";
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={{
        color,
        backgroundColor: `${color}18`,
      }}
    >
      {isLive && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: color }}
        />
      )}
      {text}
    </span>
  );
}

function ComingUpCard({ item }: { item: BigStuffItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 rounded-lg p-2.5 bg-[var(--dusk)]/60 border border-[var(--twilight)]/40 hover:bg-[var(--dusk)] transition-colors group"
    >
      <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden bg-[var(--night)]">
        {item.imageUrl ? (
          <SmartImage
            src={item.imageUrl}
            alt={item.title}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Lightning weight="duotone" className="w-4 h-4 text-[var(--muted)]" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <UrgencyBadge text={item.countdownText} color={item.urgencyColor} />
        <p className="text-sm font-semibold text-[var(--cream)] truncate leading-snug mt-0.5 group-hover:text-[var(--gold)] transition-colors">
          {item.title}
        </p>
        {(item.location || item.start) && (
          <p className="text-xs text-[var(--muted)] truncate mt-0.5">
            {item.location}
            {item.location && item.start && <Dot />}
            {item.start && formatFestivalDates(item.start, item.end)}
          </p>
        )}
      </div>

      <ArrowRight
        weight="bold"
        className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
      />
    </Link>
  );
}

function NewsItem({ post, isLast }: { post: NetworkPost; isLast: boolean }) {
  const cats = post.categories ?? post.source?.categories ?? [];
  const catColor = getCategoryColor(cats);
  const CatIcon = CATEGORY_ICONS[cats[0] || "news"] || CATEGORY_ICONS.news;

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        "flex items-start gap-2 py-2 -mx-1 px-1 rounded-lg transition-colors group",
        "hover:bg-[var(--dusk)]/60",
        !isLast && "border-b border-[var(--twilight)]/25",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CatIcon
        weight="duotone"
        className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
        style={{ color: catColor }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] leading-snug line-clamp-2 group-hover:text-[var(--cream)] group-hover:underline underline-offset-2 transition-colors">
          {post.title}
        </p>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          {post.source.name}
          <Dot />
          {timeAgo(post.published_at)}
        </p>
      </div>
      <ArrowSquareOut
        weight="bold"
        className="w-3 h-3 text-[var(--muted)] flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity"
      />
    </a>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CityBriefing({
  header,
  context,
  portalSlug,
  portalId,
  quickLinks,
}: CityBriefingProps) {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [tentpoles, setTentpoles] = useState<StandaloneTentpole[]>([]);
  const [posts, setPosts] = useState<NetworkPost[]>([]);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch all three sources in parallel ──────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    let festDone = false;
    let newsDone = false;
    let liveDone = false;
    const checkDone = () => {
      if (festDone && newsDone && liveDone) setLoading(false);
    };

    fetch(`/api/festivals/upcoming?portal_id=${portalId}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (controller.signal.aborted) return;
        setFestivals((data.festivals || []) as Festival[]);
        setTentpoles((data.standalone_tentpoles || []) as StandaloneTentpole[]);
      })
      .catch(() => {})
      .finally(() => { festDone = true; checkDone(); });

    fetch(`/api/portals/${portalSlug}/network-feed?limit=5`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (controller.signal.aborted) return;
        setPosts((data.posts || []) as NetworkPost[]);
      })
      .catch(() => {})
      .finally(() => { newsDone = true; checkDone(); });

    fetch(`/api/portals/${portalSlug}/happening-now?countOnly=true`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (controller.signal.aborted) return;
        const count = (data.eventCount || 0) + (data.spotCount || 0);
        setLiveCount(count);
      })
      .catch(() => {})
      .finally(() => { liveDone = true; checkDone(); });

    return () => controller.abort();
  }, [portalId, portalSlug]);

  // ── Process festivals + tentpoles ────────────────────────────────────────
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const bigItems = useMemo<BigStuffItem[]>(() => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    const festivalItems: BigStuffItem[] = festivals.flatMap((festival) => {
      const countdown = computeCountdown(festival, today);
      if (countdown.urgency === "tbd") return [];
      return [{
        id: `festival:${festival.id}`,
        kind: "festival",
        title: festival.name,
        start: festival.announced_start,
        end: festival.announced_end,
        location: festival.neighborhood || festival.location,
        imageUrl: festival.image_url,
        href: festival.slug
          ? `/${portalSlug}/festivals/${festival.slug}`
          : `/${portalSlug}/festivals`,
        countdownText: countdown.text,
        urgencyColor: getUrgencyColor(countdown.urgency),
      }];
    });

    const festivalNorms = festivalItems.map((f) => normalize(f.title));
    const tentpoleItems: BigStuffItem[] = tentpoles.flatMap((event) => {
      const normTitle = normalize(event.title);
      if (festivalNorms.some((fn) => fn.includes(normTitle) || normTitle.includes(fn))) {
        return [];
      }
      const pseudoFestival = {
        announced_start: event.start_date,
        announced_end: event.end_date,
      } as Festival;
      const countdown = computeCountdown(pseudoFestival, today);
      if (countdown.urgency === "tbd") return [];
      return [{
        id: `event:${event.id}`,
        kind: "event",
        title: event.title,
        start: event.start_date,
        end: event.end_date,
        location: event.venue?.name || event.venue?.neighborhood || null,
        imageUrl: event.image_url,
        href: `/${portalSlug}?event=${event.id}`,
        countdownText: countdown.text,
        urgencyColor: getUrgencyColor(countdown.urgency),
      }];
    });

    // Filter out professional conferences / trade shows from the hero briefing
    const NON_CONSUMER_PATTERNS = /\b(dental|medical|healthcare|pharma|radiology|cardiology|dermatology|surgical|clinical|ophthalmology|veterinary)\b/i;

    return [...festivalItems, ...tentpoleItems]
      .filter((item) => !NON_CONSUMER_PATTERNS.test(item.title))
      .sort((a, b) => {
        const aStart = a.start || "9999-12-31";
        const bStart = b.start || "9999-12-31";
        return aStart.localeCompare(bStart);
      })
      .slice(0, 4);
  }, [festivals, tentpoles, today, portalSlug]);

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
  const [parallaxY, setParallaxY] = useState(0);
  const [contentParallax, setContentParallax] = useState({ weather: 0, masthead: 0, meta: 0 });

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
          setParallaxY(offset * 0.4);
          setContentParallax({
            weather: offset * 0.15,
            masthead: offset * 0.08,
            meta: offset * 0.04,
          });
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [feedVisible]);

  // ── Derived state ────────────────────────────────────────────────────────
  const effectiveQuickLinks = quickLinks ?? header.quick_links ?? [];
  const hasBriefingContent = !loading && (bigItems.length > 0 || posts.length > 0);
  const hasFestival = context.active_festivals.length > 0;
  const hasHoliday = context.active_holidays.length > 0;

  const layoutProps: LayoutProps = {
    masthead,
    accentColor: header.accent_color,
    headline: header.headline,
    treatment,
    weather: context.weather,
    quickLinks: effectiveQuickLinks,
    contentParallax,
    liveCount,
    portalSlug,
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
              transform: `translateY(${parallaxY}px)`,
              top: "-15%",
              bottom: "-15%",
            }}
          >
            <Image
              src={header.hero_image_url}
              alt=""
              fill
              priority
              unoptimized={header.hero_image_url.startsWith("http")}
              className="object-cover hero-ken-burns"
              sizes="100vw"
            />
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0" style={treatment.overlay} />

          {/* Universal vignette */}
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 50% 40%, transparent 50%, rgba(9,9,11,0.2) 100%)",
            }}
          />

          {/* Extra vignette (cinematic treatment) */}
          {treatment.vignette && (
            <div className="absolute inset-0" style={treatment.vignette} />
          )}

          {/* Layout variant content */}
          {variant === "centered" && <CenteredLayout {...layoutProps} />}
          {variant === "bottom-left" && <BottomLeftLayout {...layoutProps} />}
          {variant === "split" && <SplitLayout {...layoutProps} />}
          {variant === "editorial" && <EditorialLayout {...layoutProps} />}
        </div>

        {/* Festival alert ribbon */}
        {hasFestival && !hasHoliday && (
          <Link
            href={`/${portalSlug}?view=find&type=events&series=${context.active_festivals[0].slug}`}
            className="w-full flex items-center px-4 py-2.5 border text-left transition-colors hover:bg-[var(--dusk)] mt-2"
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

      {/* ── Zone 2: Briefing card ────────────────────────────────────────── */}
      {loading && (
        <div className="mt-3 rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 overflow-hidden">
          <div className="px-4 pb-4 pt-3">
            <div className="space-y-3">
              <div className="h-3 w-24 rounded bg-[var(--twilight)]/40 animate-pulse" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-2.5 bg-[var(--dusk)]/30">
                  <div className="w-12 h-12 rounded-md bg-[var(--twilight)]/30 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-20 rounded bg-[var(--twilight)]/30 animate-pulse" />
                    <div className="h-4 w-3/4 rounded bg-[var(--twilight)]/40 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {hasBriefingContent && (
        <div className="mt-3 rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 overflow-hidden">
          <div className="md:grid md:grid-cols-2 md:gap-4 px-4 pb-4 pt-3">
            {/* Coming Up — left column (cap at 3 for column balance) */}
            {bigItems.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightning
                    weight="duotone"
                    className="w-3 h-3"
                    style={{ color: "var(--gold)" }}
                  />
                  <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--gold)]">
                    Coming Up
                  </span>
                </div>
                <div className="space-y-1.5">
                  {bigItems.slice(0, 3).map((item) => (
                    <ComingUpCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* News — right column */}
            {posts.length > 0 && (
              <div className={bigItems.length > 0 ? "mt-4 md:mt-0" : ""}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Broadcast
                      weight="duotone"
                      className="w-3 h-3 text-[var(--neon-cyan)]"
                    />
                    <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--neon-cyan)]">
                      Today in Atlanta
                    </span>
                  </div>
                  <Link
                    href={`/${portalSlug}/network`}
                    className="flex items-center gap-0.5 text-xs font-mono text-[var(--neon-cyan)] opacity-70 hover:opacity-100 transition-opacity"
                  >
                    All local news
                    <ArrowRight weight="bold" className="w-2.5 h-2.5" />
                  </Link>
                </div>
                <div className="rounded-lg bg-[var(--dusk)]/40 border border-[var(--twilight)]/30 px-3 py-1">
                  {posts.slice(0, 3).map((post, index) => (
                    <NewsItem
                      key={post.id}
                      post={post}
                      isLast={index === Math.min(posts.length, 3) - 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
