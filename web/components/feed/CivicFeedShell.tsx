"use client";

/**
 * CivicFeedShell — bespoke feed for civic/community portals.
 *
 * Purpose-built for civic engagement: government meetings, volunteer
 * opportunities, school board sessions, civic group channels.
 *
 * Five-section layout (down from ten):
 *   Desktop: CivicHero / ThisWeekSection / WaysToHelpSection / CivicNewsSection
 *            + sidebar: ChannelsStrip / AboutHelpATLCard
 *   Mobile:  ChannelsStrip (horizontal) → CivicHero → ThisWeek → WaysToHelp → CivicNews
 */

import { useEffect, useMemo, useState } from "react";
import { useCityPulseFeed } from "@/lib/hooks/useCityPulseFeed";
import { usePortal } from "@/lib/portal-context";
import { CivicOnboarding } from "@/components/civic/CivicOnboarding";
import { CivicTabBar } from "@/components/civic/CivicTabBar";
import { getFeedThemeVars } from "@/lib/city-pulse/theme";
import { getVisualPreset } from "@/lib/visual-presets";
import { getDayOfWeek } from "@/lib/city-pulse/time-slots";
import type {
  CityPulseSectionType,
  CityPulseSection,
} from "@/lib/city-pulse/types";

import CivicHero from "./civic/CivicHero";
import { ThisWeekSection } from "./civic/ThisWeekSection";
import { WaysToHelpSection } from "./civic/WaysToHelpSection";
import { CivicNewsSection } from "./civic/CivicNewsSection";
import { ChannelsStrip } from "./civic/ChannelsStrip";
import { getVolunteerThisWeekItems } from "@/lib/civic-volunteer-utils";

// Section types included in the civic timeline — includes "trending" because
// civic events often land there instead of time-based slots.
const TIMELINE_SECTION_TYPES = new Set<CityPulseSectionType>([
  "right_now",
  "tonight",
  "this_weekend",
  "this_week",
  "coming_up",
  "trending",
]);

// ---------------------------------------------------------------------------
// AboutHelpATLCard — inline dismissible sidebar card
// ---------------------------------------------------------------------------

function AboutHelpATLCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="rounded-lg border border-[var(--twilight)]/30 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--cream)]">About HelpATL</h3>
        <button
          onClick={onDismiss}
          className="text-xs opacity-50 hover:opacity-100 transition-opacity text-[var(--soft)]"
        >
          Dismiss
        </button>
      </div>
      <p className="text-xs text-[var(--muted)] leading-relaxed">
        HelpATL aggregates volunteer opportunities, government meetings, and civic news across Atlanta.
        Find your way to get involved.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

interface CivicFeedShellProps {
  portalSlug: string;
}

export default function CivicFeedShell({ portalSlug }: CivicFeedShellProps) {
  const { portal } = usePortal();

  // First-run onboarding
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    try {
      return Boolean(localStorage.getItem(`civic_onboarding_${portalSlug}_completed`));
    } catch {
      return false;
    }
  });

  // AboutHelpATL sidebar card — dismissed via localStorage
  const [showAboutCard, setShowAboutCard] = useState(() => {
    try {
      return !localStorage.getItem("helpatl_about_dismissed");
    } catch {
      return true;
    }
  });

  function dismissAbout() {
    try {
      localStorage.setItem("helpatl_about_dismissed", "1");
    } catch {
      // ignore
    }
    setShowAboutCard(false);
  }

  const {
    data,
    context: apiContext,
    sections,
    tabCounts,
    isLoading,
    error,
    refresh,
    fetchTab,
    timeSlot: effectiveTimeSlot,
  } = useCityPulseFeed({ portalSlug });

  // Group count for CivicHero pathway pill — lightweight one-off fetch
  const [groupCount, setGroupCount] = useState<number | undefined>(undefined);
  useEffect(() => {
    fetch(`/api/portals/${portalSlug}/channels`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.channels) setGroupCount(data.channels.length);
      })
      .catch(() => {/* non-critical */});
  }, [portalSlug]);

  // Light theme detection for feed theme vars
  const isLightTheme = useMemo(() => {
    const branding = portal?.branding;
    if (branding?.theme_mode === "light") return true;
    if (branding?.visual_preset) {
      return getVisualPreset(branding.visual_preset)?.theme_mode === "light";
    }
    return false;
  }, [portal]);

  // Build a minimal feed context for theme vars
  const feedContext = useMemo(() => {
    if (apiContext) return apiContext;
    return {
      time_slot: effectiveTimeSlot,
      day_of_week: getDayOfWeek(),
      weather: null,
      active_holidays: [],
      active_festivals: [],
      quick_links: [],
      day_theme: undefined,
    };
  }, [apiContext, effectiveTimeSlot]);

  const themeVars = useMemo(
    () => getFeedThemeVars(feedContext, portalSlug, { isLightTheme }),
    [feedContext, portalSlug, isLightTheme],
  );

  // Lineup sections (used for CivicHero + ThisWeekSection)
  const lineupSections = useMemo(
    () => sections.filter((s) => TIMELINE_SECTION_TYPES.has(s.type)),
    [sections],
  );

  // Supplementary this_week fetch — more events for volunteer count
  const [volunteerWeekSections, setVolunteerWeekSections] = useState<CityPulseSection[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchTab("this_week")
      .then((response) => {
        if (cancelled) return;
        const weekSections = (response.sections || []).filter(
          (section) => section.type === "this_week",
        );
        if (weekSections.length === 0) return;
        setVolunteerWeekSections(weekSections);
      })
      .catch(() => {/* non-blocking enhancement */});

    return () => {
      cancelled = true;
    };
  }, [fetchTab]);

  // Build enriched section list for volunteer counting (merges this_week fetch)
  const enrichedSections = useMemo<CityPulseSection[]>(() => {
    if (!volunteerWeekSections || volunteerWeekSections.length === 0) return lineupSections;
    const withoutWeek = lineupSections.filter((s) => s.type !== "this_week");
    return [...withoutWeek, ...volunteerWeekSections];
  }, [lineupSections, volunteerWeekSections]);

  // Volunteer count — passed to WaysToHelpSection
  const volunteerCount = useMemo(
    () => getVolunteerThisWeekItems(enrichedSections).length,
    [enrichedSections],
  );

  const lineupLoading = isLoading && lineupSections.length === 0;

  if (error && !data && !isLoading) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--muted)] text-sm mb-4">
          Something went wrong loading the feed
        </p>
        <button
          onClick={refresh}
          className="px-5 py-2.5 text-xs font-medium rounded-lg bg-[var(--action-primary)] text-[var(--btn-primary-text)] hover:bg-[var(--action-primary-hover)] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div style={themeVars as React.CSSProperties} className="civic-feed">
      {/* First-run onboarding overlay */}
      {!onboardingComplete && (
        <CivicOnboarding
          portalSlug={portalSlug}
          portalName={portal.name}
          onComplete={() => setOnboardingComplete(true)}
        />
      )}

      {/* Mobile channels strip — above the two-column layout */}
      <div className="lg:hidden mb-6">
        <ChannelsStrip portalSlug={portalSlug} variant="horizontal" />
      </div>

      {/* Two-column layout */}
      <div className="flex gap-8">
        {/* Main column */}
        <div className="flex-1 min-w-0 space-y-8">
          <CivicHero
            portalSlug={portalSlug}
            tabCounts={tabCounts}
            weather={feedContext.weather}
            cityName={portal.filters?.city ?? "Atlanta"}
            groupCount={groupCount}
            lineupSections={lineupSections}
          />

          <ThisWeekSection
            portalSlug={portalSlug}
            events={lineupSections}
            isLoading={lineupLoading}
          />

          <WaysToHelpSection
            portalSlug={portalSlug}
            volunteerCount={volunteerCount}
          />

          <CivicNewsSection portalSlug={portalSlug} />
        </div>

        {/* Sidebar — desktop only */}
        <div className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-24 space-y-6">
            <ChannelsStrip portalSlug={portalSlug} variant="vertical" />
            {showAboutCard && <AboutHelpATLCard onDismiss={dismissAbout} />}
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <CivicTabBar portalSlug={portalSlug} />
    </div>
  );
}
