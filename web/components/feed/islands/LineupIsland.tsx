"use client";

/**
 * LineupIsland — client island that owns the Lineup section's data plumbing.
 *
 * Wraps `useCityPulseFeed` (seeded by the manifest's city-pulse loader) and
 * `useFeedPreferences` so the section's tabs, chips, and category counts all
 * work without a shell parent. Drops into `CityPulseServerShell` via the
 * manifest; outside that shell it's self-contained.
 */
import { useMemo } from "react";
import { useCityPulseFeed } from "@/lib/hooks/useCityPulseFeed";
import { useFeedPreferences } from "@/lib/hooks/useFeedPreferences";
import { useFeedAdminOverrides } from "../FeedAdminOverrideContext";
import { useAuth } from "@/lib/auth-context";
import { usePortal } from "@/lib/portal-context";
import LineupSection from "../LineupSection";
import FeedSectionSkeleton from "../FeedSectionSkeleton";
import { ContentSwap } from "@/components/ui/ContentSwap";
import type {
  CityPulseResponse,
  CityPulseSectionType,
} from "@/lib/city-pulse/types";

/** Section types that LineupSection absorbs — same set as the legacy shell. */
const TIMELINE_SECTION_TYPES = new Set<CityPulseSectionType>([
  "right_now",
  "tonight",
  "this_weekend",
  "this_week",
  "coming_up",
]);

interface LineupIslandProps {
  portalSlug: string;
  initialData?: CityPulseResponse | null;
}

export default function LineupIsland({ portalSlug, initialData }: LineupIslandProps) {
  const { user } = useAuth();
  const { portal } = usePortal();
  const isAuthenticated = !!user;

  const {
    feedLayout,
    savedInterests,
    handleInterestsChange,
    handleSaveInterests,
  } = useFeedPreferences({ isAuthenticated });

  const { dayOverride, timeSlotOverride } = useFeedAdminOverrides();
  const {
    sections,
    tabCounts,
    categoryCounts,
    refresh,
    fetchTab,
  } = useCityPulseFeed({
    portalSlug,
    interests: savedInterests,
    initialData: initialData ?? undefined,
    dayOverride,
    timeSlotOverride,
  });

  const lineupSections = useMemo(
    () => sections.filter((s) => TIMELINE_SECTION_TYPES.has(s.type)),
    [sections],
  );

  const hasAnyTabEvents =
    tabCounts &&
    (tabCounts.today > 0 || tabCounts.this_week > 0 || tabCounts.coming_up > 0);
  const hasLineupContent = lineupSections.length > 0 || hasAnyTabEvents;
  const showLineupContent = !!hasLineupContent;

  return (
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
  );
}
