"use client";

import { Suspense, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import { TransitionContainer } from "@/components/ui/TransitionContainer";
import FindFilterBar from "@/components/find/FindFilterBar";
import FindSearchInput from "@/components/find/FindSearchInput";
import {
  useReplaceStateParams,
  useReplaceStateSearch,
} from "@/lib/hooks/useReplaceStateParams";
import EventList from "@/components/EventList";
import { ActiveFiltersRow } from "@/components/filters";
import type { TimelineResponse } from "@/lib/explore-platform/lane-data";

type DisplayMode = "list" | "map" | "calendar";
const EventsMapMode = dynamic(() => import("./EventsMapMode"), {
  loading: () => (
    <div className="h-[420px] rounded-xl border border-[var(--twilight)]/60 bg-[var(--night)]/60 animate-pulse" />
  ),
});
const EventsCalendarMode = dynamic(() => import("./EventsCalendarMode"), {
  loading: () => (
    <div className="p-4 sm:p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-[var(--twilight)] rounded" />
        <div className="h-8 w-20 bg-[var(--twilight)] rounded" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }).map((_, index) => (
          <div key={index} className="aspect-square bg-[var(--twilight)]/50 rounded" />
        ))}
      </div>
    </div>
  ),
});

interface EventsFinderProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
  displayMode: DisplayMode;
  hasActiveFilters: boolean;
  vertical?: string | null;
  showFilters?: boolean; // default true for list mode
  initialTimelinePage?: TimelineResponse | null;
}

/**
 * Inner implementation of EventsFinderFilters — needs access to URL params
 * (useSearchParams) so it lives inside the Suspense boundary.
 */
function EventsFinderFiltersInner({
  portalId,
  portalSlug,
  portalExclusive,
  displayMode,
  hasActiveFilters,
  vertical,
}: EventsFinderProps) {
  const searchParams = useReplaceStateParams();

  return (
    <div className="mt-2.5 pt-2.5 border-t border-[var(--twilight)]/65">
      {/* Search input with typeahead */}
      <div className="mb-3">
        <FindSearchInput
          portalSlug={portalSlug}
          portalId={portalId}
          basePath={`/${portalSlug}/explore`}
          findType="events"
          placeholder="Search events..."
        />
      </div>

      <FindFilterBar
        variant={displayMode === "map" ? "compact" : "full"}
        hideDate={displayMode === "calendar"}
        portalId={portalId}
        portalExclusive={portalExclusive}
        portalSlug={portalSlug}
        vertical={vertical}
        deferMetadata
      />
      {/* Active Filters */}
      {hasActiveFilters && displayMode === "list" && (
        <div className="px-1 pt-2">
          <ActiveFiltersRow />
        </div>
      )}
    </div>
  );
}

/**
 * Re-exported filter block for use in external containers.
 * Wraps EventsFinderFiltersInner in a Suspense boundary.
 */
export function EventsFinderFilters(props: Omit<EventsFinderProps, "showFilters">) {
  return (
    <Suspense fallback={<div className="h-10 bg-[var(--night)] rounded-xl mt-3" />}>
      <EventsFinderFiltersInner {...props} />
    </Suspense>
  );
}

/**
 * Events content area — list, calendar, or map display modes.
 * When showFilters=true (default) and displayMode="list", renders the search
 * bar and filter chips above the content.
 */
export default function EventsFinder({
  portalId,
  portalSlug,
  portalExclusive,
  displayMode,
  hasActiveFilters,
  vertical,
  showFilters = true,
  initialTimelinePage,
}: EventsFinderProps) {
  const renderFilters = showFilters && displayMode === "list";
  // With replaceState-based filter writes, useSearchParams doesn't re-render
  // on filter changes, so isFilterPending is effectively always false.
  // This is intentional — filters update instantly without a dimming transition.
  // The deferred value logic is kept as a fallback for any code paths that
  // still use router.push/replace (e.g., view switching).
  const searchParamsStr = useReplaceStateSearch();
  const deferredSearchParamsStr = useDeferredValue(searchParamsStr);
  const isFilterPending = searchParamsStr !== deferredSearchParamsStr;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {renderFilters && (
        <Suspense fallback={<div className="h-10 bg-[var(--night)] rounded-xl mt-3" />}>
          <EventsFinderFiltersInner
            portalId={portalId}
            portalSlug={portalSlug}
            portalExclusive={portalExclusive}
            displayMode={displayMode}
            hasActiveFilters={hasActiveFilters}
            vertical={vertical}
          />
        </Suspense>
      )}

      {/* List mode */}
      {displayMode === "list" && (
        <TransitionContainer isPending={isFilterPending}>
          <EventList
            hasActiveFilters={hasActiveFilters}
            portalId={portalId}
            portalExclusive={portalExclusive}
            portalSlug={portalSlug}
            initialPage={initialTimelinePage}
          />
        </TransitionContainer>
      )}

      {/* Calendar mode */}
      {displayMode === "calendar" && (
        <EventsCalendarMode
          portalId={portalId}
          portalSlug={portalSlug}
          portalExclusive={portalExclusive}
        />
      )}

      {/* Map mode */}
      {displayMode === "map" && (
        <EventsMapMode
          portalId={portalId}
          portalSlug={portalSlug}
          portalExclusive={portalExclusive}
        />
      )}
    </>
  );
}
