"use client";

/**
 * CityPulseShell — the main feed container for City Pulse.
 *
 * Layout:
 *  Mobile: single column, everything stacked
 *  Desktop (lg+): two-column — main feed left, sidebar right
 *
 * Main column:
 *  1. GreetingBar (photo hero)
 *  2. Quick links (contextual shortcuts) + FeedCustomizer
 *  3. Dashboard cards + CTA
 *  4. LineupSection (tabbed: Today / This Week / Coming Up)
 *
 * Sidebar (desktop only, sticky):
 *  - Trending / WeatherDiscovery / Browse
 *
 * Mobile stacks everything in main column order, then sidebar sections below.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useCityPulseFeed } from "@/lib/hooks/useCityPulseFeed";
import { useFeedPreferences } from "@/lib/hooks/useFeedPreferences";
import { getFeedThemeVars } from "@/lib/city-pulse/theme";
import { useAuth } from "@/lib/auth-context";
import { usePortal } from "@/lib/portal-context";
import Link from "next/link";
import GreetingBar from "./GreetingBar";
import LineupSection from "./LineupSection";
import QuickLinksBar from "./QuickLinksBar";
import CityPulseSection from "./CityPulseSection";
import TheSceneSection from "./sections/TheSceneSection";
import LazySection from "./LazySection";
import NetworkFeedSection from "./sections/NetworkFeedSection";
import NowShowingSection from "./sections/NowShowingSection";

import FestivalsSection from "./sections/FestivalsSection";

import FeedTimeMachine from "./FeedTimeMachine";
import FeedCustomizer from "./FeedCustomizer";
import type { CityPulseSectionType, TimeSlot } from "@/lib/city-pulse/types";
import { SignIn } from "@phosphor-icons/react";

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
  browse: "browse",
};

interface CityPulseShellProps {
  portalSlug: string;
}

function FeedSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Hero skeleton */}
      <div className="h-60 sm:h-80 bg-[var(--card-bg)] border-b border-[var(--twilight)]" />
      {/* Card skeleton */}
      <div className="flex gap-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-16 rounded-xl skeleton-shimmer" />
        ))}
      </div>
      {/* Tab skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 rounded-full skeleton-shimmer shrink-0" />
        ))}
      </div>
      {/* Section skeletons */}
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-32 skeleton-shimmer rounded" />
          <div className="h-48 rounded-2xl skeleton-shimmer" />
          <div className="space-y-1">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-12 rounded-lg skeleton-shimmer" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
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

export default function CityPulseShell({ portalSlug }: CityPulseShellProps) {
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
    context,
    sections,
    personalization,
    tabCounts,
    categoryCounts,
    isLoading,
    error,
    refresh,
    fetchTab,
  } = useCityPulseFeed({
    portalSlug,
    timeSlotOverride,
    dayOverride,
    interests: savedInterests,
  });

  // Clean up legacy ?tab= param
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("tab")) {
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  }, []);

  // Split sections: lineup (timeline) vs non-timeline, extract Regular Hangs
  const { lineupSections, orderedSections, lineupEventIds, sceneSection, sceneEventIds } = useMemo(() => {
    const lineup = sections.filter(
      (s) => TIMELINE_SECTION_TYPES.has(s.type),
    );

    // Extract Regular Hangs section (rendered inline after Lineup, not in orderedSections)
    const scene = sections.find((s) => s.type === "the_scene" || s.type === "tonights_regulars") ?? null;

    // Collect scene event IDs so Lineup can exclude them
    const sceneIds = new Set<number>();
    if (scene) {
      for (const item of scene.items) {
        if (item.item_type === "event") sceneIds.add(item.event.id);
      }
    }

    // Collect all event IDs from lineup sections for dedup in downstream sections
    const eventIds = new Set<number>();
    for (const s of lineup) {
      for (const item of s.items) {
        if (item.item_type === "event") eventIds.add(item.event.id);
      }
    }

    // Build ordered non-timeline sections, applying user layout if available
    const sectionMap = new Map(sections.map((s) => [s.type, s]));
    const hiddenSet = new Set(
      feedLayout?.hidden_blocks?.map((b) => BLOCK_TO_SECTION[b]).filter(Boolean) || [],
    );

    let sectionOrder: CityPulseSectionType[];
    if (feedLayout?.visible_blocks) {
      sectionOrder = feedLayout.visible_blocks
        .filter((b) => b !== "timeline")
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

    return { lineupSections: lineup, orderedSections: ordered, lineupEventIds: eventIds, sceneSection: scene, sceneEventIds: sceneIds };
  }, [sections, feedLayout]);

  // Theme vars from context
  const themeVars = useMemo(
    () => (context ? getFeedThemeVars(context) : {}),
    [context],
  );

  if (isLoading && !data) {
    return <FeedSkeleton />;
  }

  if (error && !data) {
    return <FeedError onRetry={refresh} />;
  }

  if (!data) {
    return <FeedSkeleton />;
  }

  const header = data.header;
  const dashboardCards = header?.dashboard_cards || [];
  const quickLinks = header?.quick_links || [];

  return (
    <div
      style={{
        ...(themeVars as React.CSSProperties),
        ...(showTimeMachine ? { paddingBottom: "5.5rem" } : {}),
      }}
    >
      {/* 1. GreetingBar — photo hero + headline + pulse */}
      {context && header && (
        <GreetingBar
          header={header}
          context={context}
          portalSlug={portalSlug}
        />
      )}

      {/* 2. Quick links — contextual discovery shortcuts */}
      {quickLinks.length > 0 && (
        <div className="mt-3">
          <QuickLinksBar links={quickLinks} dashboardCards={dashboardCards} />
        </div>
      )}

      {/* Feed Customizer / Sign-in CTA */}
      <div className="mt-2 flex justify-end">
        {isAuthenticated ? (
          <FeedCustomizer
            currentLayout={feedLayout}
            onSave={handleSaveLayout}
            isAuthenticated
          />
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[var(--muted)] hover:text-[var(--soft)] hover:bg-[var(--cream)]/5 transition-colors"
          >
            <SignIn weight="bold" className="w-3.5 h-3.5" />
            <span className="font-mono text-2xs tracking-wide">Sign in to customize</span>
          </Link>
        )}
      </div>

      {/* CTA (if present) */}
      {header?.cta && (
        <div className="mt-2.5">
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

      {/* 3. LineupSection — tabbed Today / This Week / Coming Up */}
      {lineupSections.length > 0 && (
        <div className="mt-4">
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
            excludeEventIds={sceneEventIds}
          />
        </div>
      )}

      {/* 3b. Regular Hangs — recurring activities, directly after Lineup */}
      {sceneSection && (
        <div className="mt-6">
          <TheSceneSection
            section={sceneSection}
            portalSlug={portalSlug}
            excludeEventIds={lineupEventIds}
          />
        </div>
      )}

      {/* 4. Network Feed — indie Atlanta publications */}
      <div className="mt-8">
        <div className="h-px bg-[var(--twilight)]" />
        <div className="pt-6">
          <LazySection minHeight={400}>
            <NetworkFeedSection portalSlug={portalSlug} />
          </LazySection>
        </div>
      </div>

      {/* 5. Now Showing — indie cinema showtimes */}
      <div className="mt-8">
        <div className="h-px bg-[var(--twilight)]" />
        <div className="pt-6">
          <LazySection minHeight={300}>
            <NowShowingSection portalSlug={portalSlug} />
          </LazySection>
        </div>
      </div>

      {/* 6. Festivals — upcoming big events */}
      <div className="mt-8">
        <div className="h-px bg-[var(--twilight)]" />
        <div className="pt-6">
          <LazySection minHeight={200}>
            <FestivalsSection portalSlug={portalSlug} portalId={portal.id} />
          </LazySection>
        </div>
      </div>

      {/* Browse by Category (order customizable) */}
      {orderedSections.map((section) => (
        <div key={section.id} className="mt-8">
          <div className="h-px bg-[var(--twilight)]" />
          <div className="pt-6">
            <LazySection minHeight={SECTION_HEIGHT_ESTIMATES[section.type] || 200}>
              <CityPulseSection
                section={section}
                portalSlug={portalSlug}
                personalization={personalization}
                excludeEventIds={lineupEventIds}
              />
            </LazySection>
          </div>
        </div>
      ))}

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
