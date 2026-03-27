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
 *  1. GreetingBar — photo hero + headline + pulse text
 *  2. CTA banner (optional, from CMS header override)
 *  3. InterestChannelsSection — join/follow groups for civic/topic routing
 *  4. LineupSection — tabbed timeline: Today / This Week / Coming Up
 *  5. TheSceneSection (Regular Hangs) — self-fetching, lazy-loaded
 *  6. FestivalsSection — self-fetching, lazy-loaded
 *  7. NetworkFeedSection — self-fetching, lazy-loaded
 *  8. SeeShowsSection — Film/Music/Stage tabs, self-fetching, lazy-loaded
 *  9. Browse by Category — orderedSections (user-customizable order)
 *
 * Section visibility and order are controlled by FeedLayout preferences.
 * The FeedPageIndex TOC doubles as the customizer (auth-gated edit mode).
 *
 * Admin-only:
 *  - FeedTimeMachine (?admin flag) — day/time slot override for testing
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
import InterestChannelsSection from "./sections/InterestChannelsSection";
const HangFeedSection = dynamic(
  () => import("./sections/HangFeedSection").then(m => ({ default: m.HangFeedSection })),
  { ssr: false },
);
import FeedSectionSkeleton from "@/components/feed/FeedSectionSkeleton";
import { ContentSwap } from "@/components/ui/ContentSwap";
import ActiveContestSection from "./sections/ActiveContestSection";
import HolidayHero from "./HolidayHero";
import { DestinationsSection } from "./sections/DestinationsSection";
import FeedPageIndex from "./FeedPageIndex";
import type {
  FeedBlockId,
  CityPulseSectionType,
  TimeSlot,
  FeedContext,
  ResolvedHeader,
  CityPulseResponse,
} from "@/lib/city-pulse/types";
import { DEFAULT_FEED_ORDER, ALWAYS_VISIBLE_BLOCKS, FIXED_LAST_BLOCKS } from "@/lib/city-pulse/types";
import { ENABLE_HANGS_V1 } from "@/lib/launch-flags";

// Client-safe pure functions for instant shell rendering
import { getDayOfWeek, getDayTheme } from "@/lib/city-pulse/time-slots";
import { getEditorialHeadline, getCityPhoto, getDefaultAccentColor } from "@/lib/city-pulse/header-defaults";
import { getDashboardCards } from "@/lib/city-pulse/dashboard-cards";
import { getContextualQuickLinks } from "@/lib/city-pulse/quick-links";

// Below-fold sections: dynamically imported so their JS is in separate chunks
// loaded on demand when LazySection triggers (not bundled in the main feed chunk).
const TheSceneSection = dynamic(() => import("./sections/TheSceneSection"), { ssr: false });
const SeeShowsSection = dynamic(() => import("./sections/SeeShowsSection"), { ssr: false });
const PlanningHorizonSection = dynamic(() => import("./sections/PlanningHorizonSection"), { ssr: false });
const PortalTeasersSection = dynamic(
  () => import("./sections/PortalTeasersSection").then((m) => ({ default: m.PortalTeasersSection })),
  { ssr: false }
);
const FeedTimeMachine = dynamic(() => import("./FeedTimeMachine"), { ssr: false });
const YonderRegionalEscapesSection = dynamic(() => import("./sections/YonderRegionalEscapesSection"), { ssr: false });
const YonderDestinationNodeQuestsSection = dynamic(
  () => import("./sections/YonderDestinationNodeQuestsSection"),
  { ssr: false }
);

/** Section types that LineupSection absorbs */
const TIMELINE_SECTION_TYPES = new Set<CityPulseSectionType>([
  "right_now",
  "tonight",
  "this_weekend",
  "this_week",
  "coming_up",
]);

/** The non-timeline sections we render, in order */
const DEFAULT_SECTION_ORDER: CityPulseSectionType[] = [
  "browse",
];

/** Estimated heights per section type to reduce CLS when lazy loading */
const SECTION_HEIGHT_ESTIMATES: Record<string, number> = {
  browse: 400,
};

/** Map FeedBlockId → CityPulseSectionType for layout application */
const BLOCK_TO_SECTION: Record<string, CityPulseSectionType> = {
  horizon: "planning_horizon",
  browse: "browse",
};

/** Middle blocks = everything except always-first and always-last */
const MIDDLE_BLOCK_IDS: FeedBlockId[] = DEFAULT_FEED_ORDER.filter(
  (b) => !ALWAYS_VISIBLE_BLOCKS.includes(b) && !FIXED_LAST_BLOCKS.includes(b),
);


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

export default function CityPulseShell({ portalSlug, serverHeroUrl, serverFeedData }: CityPulseShellProps) {
  const searchParams = useSearchParams();
  const showTimeMachine = searchParams.get("admin") !== null;
  const { user } = useAuth();
  const { portal } = usePortal();
  const isAuthenticated = !!user;

  const [dayOverride, setDayOverride] = useState<string | undefined>();
  const [timeSlotOverride, setTimeSlotOverride] = useState<TimeSlot | undefined>();

  const {
    feedLayout,
    savedInterests,
    handleSaveLayout,
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

  // Compute hidden block set and middle section order from feedLayout
  const hiddenBlockSet = useMemo(() => {
    if (!feedLayout?.hidden_blocks) return new Set<FeedBlockId>();
    return new Set<FeedBlockId>(feedLayout.hidden_blocks);
  }, [feedLayout]);

  const middleSectionOrder = useMemo(() => {
    if (!feedLayout?.visible_blocks) return MIDDLE_BLOCK_IDS;
    // Extract middle blocks from visible_blocks, preserving user order
    return feedLayout.visible_blocks.filter(
      (b) => !ALWAYS_VISIBLE_BLOCKS.includes(b) && !FIXED_LAST_BLOCKS.includes(b),
    );
  }, [feedLayout]);

  // Split sections: lineup (timeline) vs non-timeline
  const { lineupSections, planningHorizonSection, orderedSections } = useMemo(() => {
    const lineup = sections.filter(
      (s) => TIMELINE_SECTION_TYPES.has(s.type),
    );
    const horizon = sections.find((s) => s.type === "planning_horizon") ?? null;

    // Build ordered non-timeline sections, applying user layout
    const sectionMap = new Map(sections.map((s) => [s.type, s]));
    const hiddenSet = new Set(
      feedLayout?.hidden_blocks?.map((b) => BLOCK_TO_SECTION[b]).filter(Boolean) || [],
    );

    let sectionOrder: CityPulseSectionType[];
    if (feedLayout?.visible_blocks) {
      sectionOrder = feedLayout.visible_blocks
        .filter((b) => b !== "events")
        .map((b) => BLOCK_TO_SECTION[b])
        .filter((t): t is CityPulseSectionType => !!t);
      if (!sectionOrder.includes("browse")) {
        sectionOrder.push("browse");
      }
    } else {
      sectionOrder = DEFAULT_SECTION_ORDER;
    }

    const ordered = sectionOrder
      .filter((type) => !hiddenSet.has(type))
      .map((type) => sectionMap.get(type))
      .filter(Boolean) as typeof sections;

    return { lineupSections: lineup, planningHorizonSection: horizon, orderedSections: ordered };
  }, [sections, feedLayout]);

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

  /** Render a middle section by blockId */
  const renderMiddleSection = (blockId: FeedBlockId) => {
    switch (blockId) {
      case "hangs":
        return ENABLE_HANGS_V1 ? (
          <div
            key="city-pulse-hangs"
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
        ) : null;

      case "recurring":
        // Regular Hangs absorbed into RecurringStrip inside the Lineup
        return null;

      case "cinema":
        return (
          <div
            key="city-pulse-cinema"
            id="city-pulse-cinema"
            data-feed-anchor="true"
            data-index-label="See Shows"
            data-block-id="cinema"
            className="mt-8 scroll-mt-28"
          >
            <div className="h-px bg-[var(--twilight)]" />
            <div className="pt-6">
              <LazySection minHeight={300}>
                <SeeShowsSection portalSlug={portalSlug} />
              </LazySection>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

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

      {/* 5. Destinations — contextual venue suggestions.
           When city-pulse embeds destinations, renders immediately with no extra fetch.
           Falls back to self-fetch when initialData is undefined (e.g. cache miss). */}
      <LazySection minHeight={280}>
        <DestinationsSection
          portalSlug={portalSlug}
          initialData={data?.destinations}
        />
      </LazySection>

      {/* 6. Interest Channels — only on civic portals where groups are meaningful */}
      {portal?.settings?.vertical === "community" && (
        <InterestChannelsSection portalSlug={portalSlug} onSubscriptionChange={refresh} compact />
      )}

      {/* Active Contest card — self-fetching, renders only when a contest is live */}
      <ActiveContestSection portalSlug={portalSlug} />

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

      {/* Middle sections — order + visibility controlled by feedLayout */}
      {middleSectionOrder.map((blockId) => {
        if (hiddenBlockSet.has(blockId)) return null;
        return renderMiddleSection(blockId);
      })}

      {/* Portal teasers — cross-portal headlines */}
      <div className="mt-8">
        <div className="h-px bg-[var(--twilight)]" />
        <div className="pt-6">
          <LazySection minHeight={200}>
            <PortalTeasersSection portalSlug={portalSlug} />
          </LazySection>
        </div>
      </div>

      {/* Planning Horizon — big future events with urgency signals */}
      {planningHorizonSection && !hiddenBlockSet.has("horizon") && (
        <div
          id="city-pulse-horizon"
          data-feed-anchor="true"
          data-index-label="On the Horizon"
          data-block-id="horizon"
          className="mt-8 scroll-mt-28"
        >
          <div className="h-px bg-[var(--twilight)]" />
          <div className="pt-6">
            <PlanningHorizonSection
              section={planningHorizonSection}
              portalSlug={portalSlug}
            />
          </div>
        </div>
      )}

      {/* Browse — Places to Go + Things to Do (always last) */}
      {!hiddenBlockSet.has("browse") && (
        <div
          id="city-pulse-browse"
          data-feed-anchor="true"
          data-index-label="Browse"
          data-block-id="browse"
          className="scroll-mt-28"
        >
          {orderedSections.map((section) => (
            <div key={section.id} className="mt-8">
              <div className="h-px bg-[var(--twilight)]" />
              <div className="pt-6">
                <LazySection minHeight={SECTION_HEIGHT_ESTIMATES[section.type] || 200}>
                  <CityPulseSection
                    section={section}
                    portalSlug={portalSlug}
                    personalization={personalization}
                  />
                </LazySection>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin: Feed Time Machine */}
      {showTimeMachine && (
        <FeedTimeMachine
          currentDay={dayOverride}
          currentTimeSlot={timeSlotOverride}
          onOverride={handleOverride}
        />
      )}

      <FeedPageIndex
        portalSlug={portalSlug}
        loading={isLoading}
        isAuthenticated={isAuthenticated}
        feedLayout={feedLayout}
        onSaveLayout={handleSaveLayout}
      />
    </div>
  );
}
