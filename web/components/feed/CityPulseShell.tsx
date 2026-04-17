"use client";

/**
 * CityPulseShell — the main feed container for City Pulse.
 *
 * Progressive rendering strategy:
 *  T=0ms   Shell computed client-side from pure functions (no API call):
 *          GreetingBar + DashboardCards render immediately.
 *  T=0ms   Lineup fetch starts in parallel.
 *  T=~1s   Lineup data arrives → LineupSection renders with real events.
 *          If CMS header overrides exist, they upgrade the shell seamlessly.
 *  scroll  LazySection triggers → self-fetching sections load on demand.
 *
 * Feed blocks (top → bottom):
 *  1. CityBriefing — hero photo + weather + quick links
 *  2. TodayInAtlantaSection — tabbed local news
 *  3. LineupSection — tabbed timeline: Today / This Week / Coming Up (events only)
 *  4. RegularHangsSection — recurring weekly events (trivia, run clubs, etc.)
 *  5. PlacesToGoSection — category-based venue discovery
 *  6. NowShowingSection — film showtimes by theater (carousel)
 *  7. LiveMusicSection — tonight's shows + venue directory with genre filter
 *  8. GameDaySection — sports schedules
 *
 * Section visibility and order are controlled by FeedLayout preferences.
 *
 * Admin-only:
 *  - FeedTimeMachine (?admin flag) — day/time slot override for testing
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCityPulseFeed } from "@/lib/hooks/useCityPulseFeed";
import { useFeedPreferences } from "@/lib/hooks/useFeedPreferences";
import { getFeedThemeVars } from "@/lib/city-pulse/theme";
import { useAuth } from "@/lib/auth-context";
import { usePortal } from "@/lib/portal-context";
import { getVisualPreset } from "@/lib/visual-presets";
import dynamic from "next/dynamic";
import Link from "next/link";
import CityBriefing from "./CityBriefing";
import GreetingBar from "./GreetingBar";
import LineupSection from "./LineupSection";
import CityPulseSection from "./CityPulseSection";
import LazySection from "./LazySection";
const HangFeedSection = dynamic(
  () => import("./sections/HangFeedSection").then(m => ({ default: m.HangFeedSection })),
  { ssr: false },
);
import FeedSectionSkeleton from "@/components/feed/FeedSectionSkeleton";
import { ContentSwap } from "@/components/ui/ContentSwap";
import ActiveContestSection from "./sections/ActiveContestSection";
import { TodayInAtlantaSection } from "./sections/TodayInAtlantaSection";
import RegularHangsSection from "./sections/RegularHangsSection";
import FestivalsSection from "./sections/FestivalsSection";
import HolidayHero from "./HolidayHero";
import type { FeedEventData } from "@/components/EventCard";
import type {
  CityPulseSectionType,
  TimeSlot,
  FeedContext,
  ResolvedHeader,
  CityPulseResponse,
} from "@/lib/city-pulse/types";
import { ENABLE_HANGS_V1 } from "@/lib/launch-flags";

// Client-safe pure functions for instant shell rendering
import { getDayOfWeek, getDayTheme } from "@/lib/city-pulse/time-slots";
import { getEditorialHeadline, getCityPhoto, getDefaultAccentColor } from "@/lib/city-pulse/header-defaults";
import { getDashboardCards } from "@/lib/city-pulse/dashboard-cards";
import { getContextualQuickLinks } from "@/lib/city-pulse/quick-links";

// Below-fold sections: dynamically imported so their JS is in separate chunks
// loaded on demand when LazySection triggers (not bundled in the main feed chunk).
const NowShowingSection = dynamic(() => import("./sections/NowShowingSection"), { ssr: false });
const LiveMusicSection = dynamic(() => import("./sections/MusicTabContent"), { ssr: false });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GameDaySection = dynamic<{ portalSlug: string }>(() => import("./sections/GameDaySection") as any, { ssr: false });
const FeedTimeMachine = dynamic(() => import("./FeedTimeMachine"), { ssr: false });
const YonderRegionalEscapesSection = dynamic(() => import("./sections/YonderRegionalEscapesSection"), { ssr: false });
const YonderDestinationNodeQuestsSection = dynamic(
  () => import("./sections/YonderDestinationNodeQuestsSection"),
  { ssr: false }
);
const PlacesToGoSection = dynamic<{ portalSlug: string }>(
  () => import("./sections/PlacesToGoSection").then((m) => ({ default: m.PlacesToGoSection })),
  { ssr: false },
);

/** Section types that LineupSection absorbs */
const TIMELINE_SECTION_TYPES = new Set<CityPulseSectionType>([
  "right_now",
  "tonight",
  "this_weekend",
  "this_week",
  "coming_up",
]);

// ---------------------------------------------------------------------------
// Client-side default shell — renders at T=0 with no API call
// ---------------------------------------------------------------------------

function buildDefaultContext(timeSlot: TimeSlot, dayOfWeek: string): FeedContext {
  const dayTheme = getDayTheme(dayOfWeek, timeSlot);
  return {
    time_slot: timeSlot,
    day_of_week: dayOfWeek,
    weather: null,
    active_holidays: [],
    active_festivals: [],
    quick_links: [],
    day_theme: dayTheme,
    weather_signal: undefined,
  };
}

function buildDefaultHeader(
  context: FeedContext,
  portalSlug: string,
): ResolvedHeader {
  const quickLinks = getContextualQuickLinks(
    portalSlug,
    context.time_slot,
    context.day_of_week,
    null,
  );
  const dashboardCards = getDashboardCards(context, portalSlug);
  return {
    config_id: null,
    config_slug: null,
    headline: getEditorialHeadline(context),
    hero_image_url: getCityPhoto(context.time_slot, undefined, context.day_of_week),
    accent_color: getDefaultAccentColor(context),
    dashboard_cards: dashboardCards,
    quick_links: quickLinks,
    events_pulse: { total_active: 0, trending_event: null },
    suppressed_event_ids: [],
    boosted_event_ids: [],
  };
}

// ---------------------------------------------------------------------------
// Shell props
// ---------------------------------------------------------------------------

interface CityPulseShellProps {
  portalSlug: string;
  /** Server-computed hero image URL — preloaded in HTML, passed to CityBriefing as initial state. */
  serverHeroUrl?: string;
  /**
   * Server-side pre-fetched city-pulse data.
   * When provided, the initial client fetch is eliminated — events render
   * directly from SSR HTML. Background refetch fires after staleTime (2 min).
   */
  serverFeedData?: CityPulseResponse | null;
  /**
   * Server-side pre-fetched regulars data.
   * Seeds the ["regulars", portalSlug] React Query cache so
   * RegularHangsSection renders without a client-side waterfall.
   */
  serverRegularsData?: { events: FeedEventData[] } | null;
}

function FeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-[var(--muted)] text-sm mb-3">
        Something went wrong loading the feed
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-xs font-mono rounded-lg bg-[var(--action-primary)] text-[var(--btn-primary-text)] hover:bg-[var(--action-primary-hover)] transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

export default function CityPulseShell({ portalSlug, serverHeroUrl, serverFeedData, serverRegularsData }: CityPulseShellProps) {
  const searchParams = useSearchParams();
  const showTimeMachine = searchParams.get("admin") !== null;
  const { user } = useAuth();
  const { portal } = usePortal();
  const queryClient = useQueryClient();
  const isAuthenticated = !!user;

  const [dayOverride, setDayOverride] = useState<string | undefined>();
  const [timeSlotOverride, setTimeSlotOverride] = useState<TimeSlot | undefined>();

  const {
    feedLayout,
    savedInterests,
    handleInterestsChange,
    handleSaveInterests,
  } = useFeedPreferences({ isAuthenticated });

  const handleOverride = useCallback((day: string | undefined, slot: TimeSlot | undefined) => {
    setDayOverride(day);
    setTimeSlotOverride(slot);
  }, []);

  const {
    data,
    context: apiContext,
    sections,
    personalization,
    tabCounts,
    categoryCounts,
    isLoading,
    error,
    refresh,
    fetchTab,
    timeSlot: effectiveTimeSlot,
  } = useCityPulseFeed({
    portalSlug,
    timeSlotOverride,
    dayOverride,
    interests: savedInterests,
    initialData: serverFeedData ?? undefined,
  });

  // Client-side defaults — computed once, zero API calls
  const defaultShell = useMemo(() => {
    const ts = effectiveTimeSlot;
    const dow = getDayOfWeek();
    const ctx = buildDefaultContext(ts, dow);
    const hdr = buildDefaultHeader(ctx, portalSlug);
    return { context: ctx, header: hdr };
  }, [effectiveTimeSlot, portalSlug]);

  // Use API data when available, fall back to client-side defaults
  const context = apiContext ?? defaultShell.context;
  const header = data?.header ?? defaultShell.header;
  const dashboardCards = header.dashboard_cards;
  const quickLinks = header.quick_links;

  // Clean up legacy ?tab= param
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("tab")) {
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  }, []);

  // Seed regulars cache from server-side prefetch.
  // Eliminates client-side fetch for RegularHangsSection when server provided data.
  useEffect(() => {
    if (!serverRegularsData) return;
    queryClient.setQueryData(["regulars", portalSlug], serverRegularsData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Previous shell-level prefetches for regulars + network-feed were removed
  // Wave C / C4. Both sections own their own useQuery with matching cache keys
  // so the shell prefetch was racing the section fetch to the cache with no
  // benefit. Keeping only the server-seed above for the SSR-provided slice.

  // Split sections: timeline sections for LineupSection
  const lineupSections = useMemo(() => {
    return sections.filter((s) => TIMELINE_SECTION_TYPES.has(s.type));
  }, [sections]);

  // Theme vars from context
  const isLightTheme = useMemo(() => {
    const branding = portal?.branding;
    if (branding?.theme_mode === "light") return true;
    if (branding?.visual_preset) {
      return getVisualPreset(branding.visual_preset)?.theme_mode === "light";
    }
    return false;
  }, [portal?.branding]);

  const themeVars = useMemo(
    () => getFeedThemeVars(context, portalSlug, { isLightTheme }),
    [context, portalSlug, isLightTheme],
  );

  // Middle-section render: the feed-block prefs system used to route hangs,
  // cinema, live_music, recurring, sports through a configurable switch. In
  // practice every block other than hangs + sports had been hard-coded into
  // JSX below (and the dispatch cases returned null), so user reorder/hide
  // prefs silently did nothing. System removed Wave C / C3. Hangs + sports
  // are now inline too; see their render sites.

  const hasAnyTabEvents = tabCounts && (tabCounts.today > 0 || tabCounts.this_week > 0 || tabCounts.coming_up > 0);
  const hasLineupContent = lineupSections.length > 0 || hasAnyTabEvents;
  // ContentSwap handles the minimum skeleton display time internally (minDisplayMs=250).
  // Drive swapKey directly from whether we have content — no manual useMinSkeletonDelay needed.
  const showLineupContent = !!hasLineupContent;

  // After initial load failure with no data at all, show error
  if (error && !data && !isLoading) {
    return <FeedError onRetry={refresh} />;
  }

  return (
    <div
      style={{
        ...(themeVars as React.CSSProperties),
        ...(showTimeMachine ? { paddingBottom: "5.5rem" } : {}),
      }}
    >
      {/* 1. City Briefing (Atlanta) or GreetingBar (other portals) */}
      {portal ? (
        <div
          id="city-pulse-briefing"
          data-feed-anchor="true"
          data-index-label="City Briefing"
          data-block-id="briefing"
          className="scroll-mt-28"
        >
          <CityBriefing
            header={header}
            context={context}
            portalSlug={portalSlug}
            portalId={portal.id}
            quickLinks={quickLinks}
            tabCounts={tabCounts}
            categoryCounts={categoryCounts}
            serverHeroUrl={serverHeroUrl}
          />
        </div>
      ) : (
        <GreetingBar
          header={header}
          context={context}
          portalSlug={portalSlug}
          quickLinks={quickLinks}
          dashboardCards={dashboardCards}
        />
      )}
      {/* CTA (if present — only from CMS override, so only after API loads) */}
      {header.cta && (
        <div className="mt-2.5 animate-fade-in">
          <Link
            href={header.cta.href}
            className={`block w-full text-center rounded-xl px-4 py-3 font-mono text-sm font-medium transition-colors ${
              header.cta.style === "ghost"
                ? "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                : "bg-[var(--action-primary)] text-[var(--btn-primary-text)] hover:bg-[var(--action-primary-hover)]"
            }`}
          >
            {header.cta.label}
          </Link>
        </div>
      )}

      {/* 3. Holiday Hero — seasonal card (self-gating, renders null when inactive).
           No wrapper margin — HolidayHero manages its own spacing when active. */}
      <HolidayHero portalSlug={portalSlug} />

      {/* Today in Atlanta — tabbed category news */}
      <TodayInAtlantaSection portalSlug={portalSlug} />

      {/* 4. LineupSection — crossfade skeleton → content */}
      <div
        id="city-pulse-events"
        data-feed-anchor="true"
        data-index-label="The Lineup"
        data-block-id="events"
        className="mt-4 scroll-mt-28"
      >
        <ContentSwap
          swapKey={showLineupContent ? "loaded" : "loading"}
          minHeight={400}
        >
          {!showLineupContent ? (
            <FeedSectionSkeleton accentColor="var(--coral)" minHeight={400} onRetry={refresh} />
          ) : (
            <LineupSection
              sections={lineupSections}
              portalSlug={portalSlug}
              tabCounts={tabCounts}
              categoryCounts={categoryCounts}
              fetchTab={fetchTab}
              activeInterests={feedLayout?.interests}
              savedInterests={savedInterests}
              onInterestsChange={handleInterestsChange}
              onSaveInterests={handleSaveInterests}
              vertical={portal?.settings?.vertical}
              keepRecurring={portal?.settings?.vertical === "community"}
            />
          )}
        </ContentSwap>
      </div>

      {/* The Big Stuff — upcoming festivals and tentpole events. Hard-coded so
           users cannot hide or reorder it — the festival is always surfaced. */}
      {portal?.id && (
        <div
          id="city-pulse-festivals"
          data-feed-anchor="true"
          data-index-label="The Big Stuff"
          data-block-id="festivals"
          className="scroll-mt-28"
        >
          <FestivalsSection portalSlug={portalSlug} portalId={portal.id} />
        </div>
      )}

      {/* Now Showing — film showtimes by theater (carousel). Hard-coded so users
           cannot hide or reorder it — cinema is part of the core Atlanta experience.
           Position: after The Big Stuff, before Live Music (spec 1.1 pos 4). */}
      <div
        id="city-pulse-cinema"
        data-feed-anchor="true"
        data-index-label="Now Showing"
        data-block-id="cinema"
        className="mt-8 scroll-mt-28"
      >
        <div className="h-px bg-[var(--twilight)]" />
        <div className="pt-6">
          <LazySection minHeight={300}>
            <NowShowingSection portalSlug={portalSlug} />
          </LazySection>
        </div>
      </div>

      {/* Live Music — tonight's shows + venue directory with genre filter. Hard-coded
           so users cannot hide or reorder it — live music is part of the core experience.
           Position: after Now Showing, before Regular Hangs (spec 1.1 pos 5). */}
      <div
        id="city-pulse-live-music"
        data-feed-anchor="true"
        data-index-label="Live Music"
        data-block-id="live_music"
        className="mt-8 scroll-mt-28"
      >
        <div className="h-px bg-[var(--twilight)]" />
        <div className="pt-6">
          <LazySection minHeight={300}>
            <LiveMusicSection portalSlug={portalSlug} />
          </LazySection>
        </div>
      </div>

      {/* Regular Hangs — recurring weekly events (trivia, run clubs, karaoke, etc.)
           Position: after Live Music, before Places to Go (spec 1.1 pos 6). */}
      <RegularHangsSection portalSlug={portalSlug} />

      {/* Places to Go — category-based venue discovery */}
      <div id="city-pulse-places-to-go" className="scroll-mt-28 mt-6">
        <LazySection minHeight={400}>
          <PlacesToGoSection portalSlug={portalSlug} />
        </LazySection>
      </div>

      {/* Active Contest card — self-fetching, renders only when a contest is live */}
      <ActiveContestSection portalSlug={portalSlug} />

      {/* Yonder-specific sections.
          TODO(Wave D): extract to a dedicated YonderFeedShell alongside the
          existing CivicFeedShell / ArtsFeedShell / AdventureFeed so this file
          isn't the catch-all for every portal that doesn't fit the default
          pattern. Wave C scope was pruning the dead community branch (civic
          already routes to CivicFeedShell in DefaultTemplate). */}
      {portalSlug === "yonder" && (
        <>
          <YonderRegionalEscapesSection
            portalSlug={portalSlug}
            weatherSignal={context.weather_signal ?? null}
            dayOfWeek={context.day_of_week ?? null}
            timeSlot={context.time_slot ?? null}
          />
          <YonderDestinationNodeQuestsSection portalSlug={portalSlug} />
        </>
      )}

      {/* Hangs — feature-flagged, inline (was dispatched through feed-block
          prefs prior to Wave C). */}
      {ENABLE_HANGS_V1 && (
        <div
          id="city-pulse-hangs"
          data-feed-anchor="true"
          data-index-label="Hangs"
          data-block-id="hangs"
          className="mt-6 scroll-mt-28"
        >
          <LazySection minHeight={200}>
            <HangFeedSection portalSlug={portalSlug} />
          </LazySection>
        </div>
      )}

      {/* Game Day — inline (was dispatched through feed-block prefs prior to Wave C). */}
      <div
        id="city-pulse-sports"
        data-feed-anchor="true"
        data-index-label="Game Day"
        data-block-id="sports"
        className="mt-8 scroll-mt-28"
      >
        <div className="h-px bg-[var(--twilight)]" />
        <div className="pt-6">
          <LazySection minHeight={200}>
            <GameDaySection portalSlug={portalSlug} />
          </LazySection>
        </div>
      </div>

      {/* Portal teasers — hidden until sibling portals are more built out */}

      {/* Admin: Feed Time Machine */}
      {showTimeMachine && (
        <FeedTimeMachine
          currentDay={dayOverride}
          currentTimeSlot={timeSlotOverride}
          onOverride={handleOverride}
        />
      )}

    </div>
  );
}
