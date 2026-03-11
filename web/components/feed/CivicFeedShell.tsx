"use client";

/**
 * CivicFeedShell — bespoke feed for civic/community portals.
 *
 * Purpose-built for civic engagement: government meetings, volunteer
 * opportunities, school board sessions, civic group channels.
 *
 * Uses the same city-pulse API as CityPulseShell but composes a
 * fundamentally different information hierarchy:
 *   1. CivicHero — editorial masthead with dateline + quick actions
 *   2. InterestChannelsSection — "Your Groups" as the personalization anchor
 *   3. MeetingsTimeline — tabbed timeline (same data, civic framing)
 *   4. UpcomingDeadlinesCard — next N civic actions
 *   5. NetworkFeedSection — local civic news from the network
 *
 * No entertainment sections (cinema, nightlife, festivals).
 * No GreetingBar, no magazine-style hero, no feed customizer.
 */

import { useEffect, useMemo, useState } from "react";
import { useCityPulseFeed } from "@/lib/hooks/useCityPulseFeed";
import { usePortal } from "@/lib/portal-context";
import { CivicOnboarding } from "@/components/civic/CivicOnboarding";
import { getFeedThemeVars } from "@/lib/city-pulse/theme";
import { getVisualPreset } from "@/lib/visual-presets";
import { getDayOfWeek } from "@/lib/city-pulse/time-slots";
import type {
  CityPulseSectionType,
  CityPulseSection,
} from "@/lib/city-pulse/types";

import CivicHero from "./civic/CivicHero";
import { CivicImpactStrip } from "./civic/CivicImpactStrip";
import VolunteerThisWeekCard from "./civic/VolunteerThisWeekCard";
import CommitmentOpportunitiesCard from "./civic/CommitmentOpportunitiesCard";
import SupportResourcesCard from "./civic/SupportResourcesCard";
import UpcomingDeadlinesCard from "./civic/UpcomingDeadlinesCard";
import InterestChannelsSection from "./sections/InterestChannelsSection";
import NetworkFeedSection from "./sections/NetworkFeedSection";
import LineupSection from "./LineupSection";
import LazySection from "./LazySection";
import { CalendarBlank, UsersThree } from "@phosphor-icons/react";

/** Categories visible in the civic network feed */
const CIVIC_NEWS_CATEGORIES = ["news", "civic", "politics", "community"];
const HELPATL_POLICY_CATEGORIES = ["news", "civic", "politics"];

// Section types included in the civic timeline — includes "trending" because
// civic events often land there instead of time-based slots. The LineupSection
// tab system handles temporal grouping from tab_counts.
const TIMELINE_SECTION_TYPES = new Set<CityPulseSectionType>([
  "right_now",
  "tonight",
  "this_weekend",
  "this_week",
  "coming_up",
  "trending",
]);

interface CivicFeedShellProps {
  portalSlug: string;
}

export default function CivicFeedShell({ portalSlug }: CivicFeedShellProps) {
  const { portal } = usePortal();
  const showHelpAtlActionHub = portalSlug === "helpatl";

  // First-run onboarding
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    try {
      return Boolean(localStorage.getItem(`civic_onboarding_${portalSlug}_completed`));
    } catch {
      return false;
    }
  });

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

  // Split timeline sections from the response
  const lineupSections = useMemo(
    () => sections.filter((s) => TIMELINE_SECTION_TYPES.has(s.type)),
    [sections],
  );

  const [volunteerWeekSections, setVolunteerWeekSections] = useState<CityPulseSection[] | null>(null);

  const volunteerCardSections = useMemo(() => {
    if (!showHelpAtlActionHub || !volunteerWeekSections || volunteerWeekSections.length === 0) {
      return lineupSections;
    }
    const withoutWeek = lineupSections.filter((section) => section.type !== "this_week");
    return [...withoutWeek, ...volunteerWeekSections];
  }, [lineupSections, showHelpAtlActionHub, volunteerWeekSections]);

  useEffect(() => {
    if (!showHelpAtlActionHub) return;
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
      .catch(() => {
        // Non-blocking enhancement: the card falls back to the initial feed slice.
      });

    return () => {
      cancelled = true;
    };
  }, [fetchTab, showHelpAtlActionHub]);

  const lineupLoading = isLoading && lineupSections.length === 0;
  const hasAnyTabEvents = tabCounts && (tabCounts.today > 0 || tabCounts.this_week > 0 || tabCounts.coming_up > 0);

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

      {/* 1. Civic Hero — full-width editorial masthead */}
      <CivicHero
        portalSlug={portalSlug}
        tabCounts={tabCounts}
        weather={feedContext.weather}
        cityName={portal.filters?.city ?? "Atlanta"}
        groupCount={groupCount}
        lineupSections={lineupSections}
      />

      {/* 2. Two-column desktop layout */}
      <div className="mt-4 lg:grid lg:grid-cols-[1fr_340px] lg:gap-8">
        {/* ── Main Column ───────────────────────────────────────── */}
        <div className="min-w-0">
          <div className="lg:hidden">
            <CivicImpactStrip portalSlug={portalSlug} variant="strip" />
          </div>

          {/* Immediate action comes first for HelpATL; group subscriptions should not lead the home feed. */}
          {showHelpAtlActionHub && (
            <>
              <VolunteerThisWeekCard
                portalSlug={portalSlug}
                lineupSections={volunteerCardSections}
                isLoading={lineupLoading}
              />

              <section className="mt-4 rounded-2xl border border-[var(--twilight)] bg-[var(--card-bg,var(--night))] p-4 sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-[var(--action-primary)]">
                      Ways To Help
                    </div>
                    <p className="mt-1 max-w-2xl text-sm text-[var(--soft)]">
                      Start with something concrete this week, then decide whether you want a recurring role or support map.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <CommitmentOpportunitiesCard portalSlug={portalSlug} />
                  <SupportResourcesCard portalSlug={portalSlug} />
                </div>
              </section>
            </>
          )}

          {/* Interest Channels — compact in feed, capped to 6 */}
          <div className="mt-4">
            <InterestChannelsSection portalSlug={portalSlug} onSubscriptionChange={refresh} maxVisible={6} compact />
          </div>

          {/* Section divider */}
          <div className="mt-4 mb-3">
            <div
              className="h-px"
              style={{
                background: "linear-gradient(90deg, var(--action-primary) 0%, var(--twilight) 40%, transparent 100%)",
                opacity: 0.6,
              }}
            />
          </div>

          {/* Meetings & Events Timeline */}
          <div className="scroll-mt-28" style={{ minHeight: lineupLoading ? 400 : undefined }}>
            {lineupLoading ? (
              <div
                className="rounded-xl border border-[var(--twilight)] bg-[var(--night)]"
                style={{ minHeight: 400 }}
                role="status"
              >
                <div className="p-5 space-y-3">
                  <div className="h-3 w-3/4 rounded-full skeleton-shimmer" style={{ opacity: 0.2 }} />
                  <div className="h-3 w-1/2 rounded-full skeleton-shimmer" style={{ opacity: 0.15, animationDelay: "200ms" }} />
                  <div className="h-2.5 w-2/3 rounded-full skeleton-shimmer" style={{ opacity: 0.12, animationDelay: "400ms" }} />
                </div>
                <div className="px-5 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-xl skeleton-shimmer" style={{ opacity: 0.1, animationDelay: `${i * 200}ms` }} />
                  ))}
                </div>
                <span className="sr-only">Loading events...</span>
              </div>
            ) : lineupSections.length > 0 || hasAnyTabEvents ? (
              <LineupSection
                sections={lineupSections}
                portalSlug={portalSlug}
                tabCounts={tabCounts}
                fetchTab={fetchTab}
                showCategoryFilters={false}
                sectionTitle="Upcoming"
                sectionAccentColor="var(--action-primary)"
                keepRecurring
                activeInterests={[]}
                vertical="community"
              />
            ) : !isLoading ? (
              <div className="rounded-xl border border-[var(--twilight)] bg-[var(--night)] p-10 text-center">
                <CalendarBlank size={44} weight="duotone" className="mx-auto text-[var(--muted)]/60 mb-4" />
                <p className="text-base font-semibold text-[var(--cream)] mb-1.5">
                  No upcoming events yet
                </p>
                <p className="text-sm text-[var(--muted)] mb-5 max-w-xs mx-auto">
                  Join groups above to customize your civic feed with the topics you care about.
                </p>
                <a
                  href={`/${portalSlug}/groups`}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--action-primary)] px-5 py-2.5 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--action-primary-hover)] transition-colors"
                >
                  <UsersThree weight="bold" className="w-4 h-4" />
                  Browse Groups
                </a>
              </div>
            ) : null}
          </div>

          {/* Civic Updates — local civic news */}
          {showHelpAtlActionHub && (
            <div className="mt-8 scroll-mt-28">
              <div className="mb-5">
                <div
                  className="h-px"
                  style={{
                    background: "linear-gradient(90deg, var(--secondary-color, #1d4ed8) 0%, var(--twilight) 30%, transparent 100%)",
                    opacity: 0.45,
                  }}
                />
              </div>
              <LazySection minHeight={300}>
                <NetworkFeedSection
                  portalSlug={portalSlug}
                  accentColor="var(--secondary-color, #1d4ed8)"
                  sectionTitle="Policy Watch"
                  visibleCategories={HELPATL_POLICY_CATEGORIES}
                  defaultCategory="civic"
                  sourceScope="local"
                />
              </LazySection>
            </div>
          )}

          {/* Civic Updates — local civic news */}
          <div className="mt-8 scroll-mt-28">
            <div className="mb-5">
              <div
                className="h-px"
                style={{
                  background: "linear-gradient(90deg, var(--action-primary) 0%, var(--twilight) 30%, transparent 100%)",
                  opacity: 0.4,
                }}
              />
            </div>
            <LazySection minHeight={300}>
              <NetworkFeedSection
                portalSlug={portalSlug}
                accentColor="var(--action-primary)"
                sectionTitle="Civic Updates"
                visibleCategories={CIVIC_NEWS_CATEGORIES}
              />
            </LazySection>
          </div>
        </div>

        {/* ── Sidebar (desktop only) ────────────────────────────── */}
        <aside className="hidden lg:block space-y-5 border-l border-[var(--twilight)] pl-8">
          {/* Impact Snapshot — civic engagement stats */}
          <CivicImpactStrip portalSlug={portalSlug} variant="card" />

          {/* Upcoming Deadlines — promoted to sidebar */}
          <UpcomingDeadlinesCard
            lineupSections={lineupSections}
            portalSlug={portalSlug}
            minItems={1}
          />
        </aside>
      </div>

      {/* Mobile-only: Upcoming Deadlines (below timeline) */}
      <div className="lg:hidden mt-5">
        <UpcomingDeadlinesCard
          lineupSections={lineupSections}
          portalSlug={portalSlug}
          minItems={1}
        />
      </div>
    </div>
  );
}
