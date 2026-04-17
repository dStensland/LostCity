"use client";

/**
 * CityBriefing — full-bleed cinematic hero for the Atlanta feed.
 *
 * One canonical bottom-left layout. Day/time variety comes from the photo +
 * accent color + masthead text, not from shuffling layout geometry.
 *
 * Features:
 *  - Festival ribbon composed into the top edge of the hero image
 *  - Photo crossfade through curated time-slot photos every ~17s
 *  - Multi-layer scroll parallax for real depth
 *  - Named-event SummaryLine with strong title contrast
 *  - Live badge that names a specific venue when a high-confidence pick exists
 *
 * Self-fetches:
 *   - /api/portals/[slug]/happening-now?countOnly=true → live count + topLive
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import WarpedNoiseBackground from "@/components/ambient/WarpedNoiseBackground";
import {
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
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import type {
  FeedContext,
  ResolvedHeader,
  FlagshipEvent,
  TimeSlot,
  TextTreatment,
  QuickLink,
} from "@/lib/city-pulse/types";

import { SignalStrip } from "./SignalStrip";
import { SummaryLine } from "./SummaryLine";
import { useFeedVisible } from "@/lib/feed-visibility";
import { getCityPhotoPool } from "@/lib/city-pulse/header-defaults";

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
  /** Optional — kept for CityBriefingIsland signature; not used by the component. */
  portalId?: string;
  quickLinks?: QuickLink[];
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
  categoryCounts?: { today: Record<string, number> } | null;
  /** Server-computed hero URL — available before JS hydrates, used as initial state. */
  serverHeroUrl?: string;
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
  // Softened: bottom stops pulled back so the photo breathes in the lower third.
  standard: [
    "linear-gradient(to bottom,",
    "rgba(9,9,11,0.30) 0%,",
    "rgba(9,9,11,0.15) 10%,",
    "rgba(9,9,11,0.05) 25%,",
    "rgba(9,9,11,0.03) 42%,",
    "rgba(9,9,11,0.08) 58%,",
    "rgba(9,9,11,0.25) 72%,",
    "rgba(9,9,11,0.5) 84%,",
    "rgba(9,9,11,0.75) 94%,",
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/35 border border-white/[0.30] transition-all hover:bg-black/50 hover:border-white/[0.40]"
          >
            {IconComp && (
              <IconComp
                weight="duotone"
                className="w-3.5 h-3.5 opacity-80"
                style={{ color: link.accent_color }}
              />
            )}
            <span
              className="font-sans text-xs font-medium tracking-normal"
              style={{ color: link.accent_color }}
            >
              {link.label}
              {count != null && count > 0 && (
                <span className="ml-1 opacity-70 tabular-nums">{count}</span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ── Live count / named-live badge ─────────────────────────────────────────────

interface TopLive {
  id: number;
  title: string | null;
  venue_name: string | null;
  href: string;
}

function LiveBadge({
  liveCount,
  topLive,
  portalSlug,
  offsetBelow,
}: {
  liveCount: number | null;
  topLive: TopLive | null;
  portalSlug: string;
  offsetBelow?: boolean;
}) {
  if (!liveCount || liveCount <= 0) return null;
  const named = topLive?.venue_name ?? null;
  const href = topLive?.href ?? `/${portalSlug}/happening-now`;
  return (
    <div
      className={`absolute left-4 z-10 ${offsetBelow ? "top-[3.25rem]" : "top-4"}`}
    >
      <Link
        href={href}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 bg-[var(--neon-red)]/20 border border-[var(--neon-red)]/40 transition-colors hover:bg-[var(--neon-red)]/30 max-w-[240px]"
      >
        <span className="relative flex items-center justify-center shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)]" />
          <span className="absolute inset-0 rounded-full bg-[var(--neon-red)]/50 animate-ping" />
        </span>
        {named ? (
          <span className="font-sans text-xs font-semibold text-[var(--neon-red)] truncate">
            {named}
          </span>
        ) : (
          <span className="font-mono text-xs font-bold text-[var(--neon-red)] uppercase tracking-wide">
            {liveCount} Live
          </span>
        )}
      </Link>
    </div>
  );
}

// ── Festival ribbon — composes into the hero's empty top edge ─────────────────

function FestivalRibbon({
  festivalName,
  portalSlug,
  festivalSlug,
}: {
  festivalName: string;
  portalSlug: string;
  festivalSlug: string;
}) {
  return (
    <Link
      href={`/${portalSlug}?festival=${festivalSlug}`}
      className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-3 pl-4 pr-3 py-2.5 border-l-2 transition-colors group animate-fade-in"
      style={{
        borderLeftColor: "var(--gold)",
        backgroundColor: "color-mix(in srgb, var(--gold) 12%, rgba(9,9,11,0.6))",
      }}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--gold)] shrink-0">
          Festival week
        </span>
        <span className="font-sans text-xs text-[var(--cream)] truncate">
          {festivalName}
        </span>
      </span>
      <ArrowRight
        weight="bold"
        className="w-3.5 h-3.5 text-[var(--gold)] shrink-0 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
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

// ── Canonical layout ──────────────────────────────────────────────────────────

interface LayoutProps {
  masthead: { line1: string; line2: string };
  accentColor: string;
  headline: string;
  treatment: TreatmentStyle;
  quickLinks?: QuickLink[];
  liveCount: number | null;
  topLive: TopLive | null;
  portalSlug: string;
  context: FeedContext;
  sportsTentpole?: ResolvedHeader["sports_tentpole"];
  namedEvent?: ResolvedHeader["named_event"];
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
  categoryCounts?: { today: Record<string, number> } | null;
  hasFestivalRibbon?: boolean;
  /** Parent-owned ref — parent writes parallax transform directly, no React re-render. */
  contentRef: React.RefObject<HTMLDivElement | null>;
}

function CanonicalHero({
  masthead, accentColor, headline, treatment, quickLinks,
  liveCount, topLive, portalSlug, context, sportsTentpole, namedEvent,
  tabCounts, categoryCounts, hasFestivalRibbon, contentRef,
}: LayoutProps) {
  return (
    <div className="relative z-10 flex flex-col justify-end min-h-[320px] sm:min-h-[480px] px-6 sm:px-10 pb-8 pt-5">
      <LiveBadge
        liveCount={liveCount}
        topLive={topLive}
        portalSlug={portalSlug}
        offsetBelow={hasFestivalRibbon}
      />

      {/* Content layer — gets slight forward parallax (feels close to the viewer) */}
      <div
        ref={contentRef}
        className={`mt-auto will-change-transform ${treatment.contentClass || ""}`}
        style={treatment.contentStyle}
      >
        <div className="animate-fade-in hero-stagger-2">
          <div className="mb-3">
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
          <SummaryLine
            tabCounts={tabCounts}
            categoryCounts={categoryCounts}
            weather={context.weather}
            namedEvent={namedEvent}
          />
        </div>

        <div className="animate-fade-in hero-stagger-3 mt-3">
          <HeroQuickLinks links={quickLinks} categoryCounts={categoryCounts?.today} />
        </div>
      </div>
    </div>
  );
}

// ── Flagship event hero content ───────────────────────────────────────────────

function FlagshipHeroContent({
  flagship,
  liveCount,
  topLive,
  portalSlug,
  quickLinks,
  context,
  sportsTentpole,
  categoryCounts,
  hasFestivalRibbon,
  contentRef,
}: {
  flagship: FlagshipEvent;
  liveCount: number | null;
  topLive: TopLive | null;
  portalSlug: string;
  quickLinks?: QuickLink[];
  context: FeedContext;
  sportsTentpole?: ResolvedHeader["sports_tentpole"];
  categoryCounts?: { today: Record<string, number> } | null;
  hasFestivalRibbon?: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="relative z-10 flex flex-col justify-end min-h-[320px] sm:min-h-[480px] px-6 sm:px-10 pb-8 pt-5">
      <LiveBadge
        liveCount={liveCount}
        topLive={topLive}
        portalSlug={portalSlug}
        offsetBelow={hasFestivalRibbon}
      />

      <div ref={contentRef} className="mt-auto will-change-transform">
        <div className="animate-fade-in hero-stagger-2">
          <div className="mb-3">
            <SignalStrip context={context} sportsTentpole={sportsTentpole} portalSlug={portalSlug} />
          </div>
          <span
            className="font-mono text-2xs uppercase tracking-[1.2px] text-[var(--gold)]"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}
          >
            HAPPENING NOW
          </span>

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

        <div className="animate-fade-in hero-stagger-3 mt-3">
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
  const [topLive, setTopLive] = useState<TopLive | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/portals/${portalSlug}/happening-now?countOnly=true`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (controller.signal.aborted) return;
        const count = (data.eventCount || 0) + (data.spotCount || 0);
        setLiveCount(count);
        setTopLive(data.topLive ?? null);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [portalSlug]);

  const feedVisible = useFeedVisible();

  const treatment = useMemo(
    () => getTreatmentStyle(header.text_treatment || "auto"),
    [header.text_treatment],
  );

  const masthead = useMemo(() => getMastheadText(context), [context]);

  // ── Multi-layer parallax — real depth with lerp smoothing ───────────────
  // Three layers, each with its own scroll coefficient. Farther-away layers
  // move slower on scroll (higher lag), creating a parallax stack:
  //
  //   bg      — 0.50 (deepest, most lag + 1.0→1.08 scale for zoom-in feel)
  //   noise   — 0.35 (atmospheric shader, mid-depth)
  //   content — 0.10 forward-lag (content feels close to the viewer)
  //
  // Smoothness: rather than writing the target offset directly on each scroll
  // event, we run a continuous rAF loop that eases current toward target
  // (lerp factor 0.18). This creates momentum — scroll stops and the layers
  // glide into place instead of snapping. All three layers share the same
  // loop so they stay perfectly in sync.
  //
  // Everything is written directly to DOM refs (no React state) so scroll
  // never triggers a re-render.
  const heroRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const noiseRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!feedVisible) return;
    if (typeof window === "undefined") return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let targetOffset = 0;
    let currentOffset = 0;
    let rafId = 0;
    let running = false;

    const LERP = 0.18; // 0 = no easing, 1 = instant. 0.18 ≈ ~6 frames to converge.

    const frame = () => {
      const diff = targetOffset - currentOffset;
      // Snap when essentially converged — avoids endless tiny rAF calls.
      if (Math.abs(diff) < 0.3) {
        currentOffset = targetOffset;
        running = false;
      } else {
        currentOffset += diff * LERP;
      }

      const bg = bgRef.current;
      if (bg) {
        // Scale 1 → 1.08 over ~1200px of scroll — more felt zoom.
        const scale = 1 + Math.min(0.08, Math.max(0, currentOffset / 1200));
        bg.style.transform = `translate3d(0, ${currentOffset * 0.5}px, 0) scale(${scale})`;
      }
      const noise = noiseRef.current;
      if (noise) {
        noise.style.transform = `translate3d(0, ${currentOffset * 0.35}px, 0)`;
      }
      const content = contentRef.current;
      if (content) {
        // Content lags forward — capped so it never leaves the readability wash zone.
        const shift = Math.max(-40, Math.min(0, currentOffset * -0.10));
        content.style.transform = `translate3d(0, ${shift}px, 0)`;
      }

      if (running) {
        rafId = requestAnimationFrame(frame);
      }
    };

    const ensureRunning = () => {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(frame);
    };

    const readScroll = () => {
      const hero = heroRef.current;
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      // Only animate while the hero is in (or near) viewport.
      if (rect.bottom > -200 && rect.top < window.innerHeight + 200) {
        targetOffset = -rect.top;
        ensureRunning();
      }
    };

    readScroll(); // initial

    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", readScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", readScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [feedVisible]);

  // ── Flagship takeover (rare — only when CMS curates) ─────────────────────
  const flagship = header.flagship_event ?? null;

  const atmosphericImageUrl = header.hero_image_url;
  const initialHeroUrl = serverHeroUrl ?? atmosphericImageUrl;

  // ── Photo crossfade ──────────────────────────────────────────────────────
  const photoPool = useMemo(() => {
    const pool = getCityPhotoPool(
      context.time_slot,
      context.weather_signal ?? undefined,
    );
    if (!initialHeroUrl) return pool;
    const idx = pool.indexOf(initialHeroUrl);
    if (idx > 0) return [...pool.slice(idx), ...pool.slice(0, idx)];
    if (idx === 0) return pool;
    return [initialHeroUrl, ...pool];
  }, [initialHeroUrl, context.time_slot, context.weather_signal]);

  const [idxA, setIdxA] = useState(0);
  const [idxB, setIdxB] = useState(1);
  const [activeIsA, setActiveIsA] = useState(true);

  useEffect(() => {
    if (!feedVisible) return;
    if (photoPool.length < 2) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tick = setInterval(() => {
      setActiveIsA((prev) => {
        const next = !prev;
        setTimeout(() => {
          if (next) {
            setIdxB((b) => (b + 2) % photoPool.length);
          } else {
            setIdxA((a) => (a + 2) % photoPool.length);
          }
        }, 1300);
        return next;
      });
    }, 17000);

    return () => clearInterval(tick);
  }, [feedVisible, photoPool]);

  const effectiveQuickLinks = quickLinks ?? header.quick_links ?? [];
  const hasFestival = context.active_festivals.length > 0;
  const hasHoliday = context.active_holidays.length > 0;
  const showFestivalRibbon = hasFestival && !hasHoliday;

  const layoutProps: LayoutProps = {
    masthead,
    accentColor: header.accent_color,
    headline: header.headline,
    treatment,
    quickLinks: effectiveQuickLinks,
    liveCount,
    topLive,
    portalSlug,
    context,
    sportsTentpole: header.sports_tentpole,
    namedEvent: header.named_event,
    tabCounts,
    categoryCounts,
    hasFestivalRibbon: showFestivalRibbon,
    contentRef,
  };

  return (
    <section aria-label="City Briefing">
      <div style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}>
        <div
          ref={heroRef}
          className="relative overflow-hidden"
        >
          {/* Skeleton gradient while image loads */}
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--night)] via-[var(--dusk)] to-[var(--night)]" />

          {/* Background photo layer — deepest, most scroll lag + slight scale */}
          <div
            ref={bgRef}
            className="absolute inset-0 will-change-transform"
            style={{
              top: "-15%",
              bottom: "-15%",
              transformOrigin: "center 60%",
            }}
          >
            {/* Crossfade layer A */}
            <div
              className="absolute inset-0 transition-opacity duration-[1200ms] ease-in-out"
              style={{ opacity: activeIsA ? 1 : 0 }}
            >
              <SmartImage
                src={photoPool[idxA] ?? initialHeroUrl}
                alt=""
                fill
                priority
                className="object-cover hero-ken-burns"
                style={{ objectPosition: "center 70%" }}
                sizes="100vw"
              />
            </div>
            {/* Crossfade layer B */}
            {photoPool.length > 1 && (
              <div
                className="absolute inset-0 transition-opacity duration-[1200ms] ease-in-out"
                style={{ opacity: activeIsA ? 0 : 1 }}
                aria-hidden
              >
                <SmartImage
                  src={photoPool[idxB] ?? initialHeroUrl}
                  alt=""
                  fill
                  className="object-cover hero-ken-burns"
                  style={{ objectPosition: "center 70%" }}
                  sizes="100vw"
                />
              </div>
            )}
          </div>

          {/* Warm color wash */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(9,9,11,0.05)", mixBlendMode: "multiply" }}
          />

          {/* Atmospheric noise shader — mid-depth parallax layer */}
          <div ref={noiseRef} className="absolute inset-0 will-change-transform">
            <WarpedNoiseBackground
              color1={[1.0, 0.42, 0.48]}
              color2={[0.29, 0.1, 0.26]}
              intensity={0.25}
              speed={0.6}
              resolutionScale={0.4}
              className="absolute inset-0 mix-blend-soft-light opacity-60"
            />
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0" style={treatment.overlay} />

          {/* Soft center vignette */}
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 50% 40%, transparent 60%, rgba(9,9,11,0.15) 100%)",
            }}
          />

          {/* Localized text-readability wash — darkens ONLY the bottom-left
              zone where content sits, leaving the upper two-thirds of the
              photo bright and legible. Desktop and mobile get slightly
              different ellipse sizes to match where the masthead actually
              lands. Sits above the main gradient so text always has a dark
              bed regardless of photo content. */}
          <div
            className="absolute inset-0 pointer-events-none hidden sm:block"
            style={{
              background:
                "radial-gradient(ellipse 55% 45% at 25% 85%, rgba(9,9,11,0.55) 0%, rgba(9,9,11,0.32) 40%, transparent 75%)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none sm:hidden"
            style={{
              background:
                "radial-gradient(ellipse 90% 50% at 30% 82%, rgba(9,9,11,0.6) 0%, rgba(9,9,11,0.35) 45%, transparent 80%)",
            }}
          />

          {treatment.vignette && (
            <div className="absolute inset-0" style={treatment.vignette} />
          )}

          {/* Festival ribbon — pinned into the top edge of the hero */}
          {showFestivalRibbon && (
            <FestivalRibbon
              festivalName={context.active_festivals[0].name}
              festivalSlug={context.active_festivals[0].slug}
              portalSlug={portalSlug}
            />
          )}

          {flagship ? (
            <FlagshipHeroContent
              flagship={flagship}
              liveCount={liveCount}
              topLive={topLive}
              portalSlug={portalSlug}
              quickLinks={effectiveQuickLinks}
              context={context}
              sportsTentpole={header.sports_tentpole}
              categoryCounts={categoryCounts}
              hasFestivalRibbon={showFestivalRibbon}
              contentRef={contentRef}
            />
          ) : (
            <CanonicalHero {...layoutProps} />
          )}
        </div>
      </div>
    </section>
  );
}
