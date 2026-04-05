"use client";

import { useMemo } from "react";
import EventsFinder from "@/components/find/EventsFinder";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";
import type { ExploreLaneComponentProps } from "@/lib/explore-platform/types";
import { hasActiveFindFilters } from "@/lib/find-filter-schema";
import type { EventsLaneInitialData } from "@/lib/explore-platform/lane-data";

export function ExploreEventsLane({
  portalId,
  portalSlug,
  portalExclusive,
  initialData,
}: ExploreLaneComponentProps) {
  const seededData = (initialData as EventsLaneInitialData | null) ?? null;
  const state = useExploreUrlState();
  const hasActiveFilters = useMemo(
    () => hasActiveFindFilters(state.params, "events"),
    [state.params],
  );
  const displayMode = state.display === "map" ? "map" : state.display === "calendar" ? "calendar" : "list";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Events
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[
            { id: "list", label: "List" },
            { id: "map", label: "Map" },
            { id: "calendar", label: "Calendar" },
          ].map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() =>
                state.setDisplay(
                  view.id as "list" | "map" | "calendar",
                  "replace",
                )
              }
              className={`px-3 py-1.5 rounded-full text-xs font-mono transition-colors ${
                displayMode === view.id
                  ? "bg-[var(--coral)]/15 text-[var(--coral)]"
                  : "border border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)]"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <EventsFinder
        portalId={portalId}
        portalSlug={portalSlug}
        portalExclusive={portalExclusive}
        displayMode={displayMode}
        hasActiveFilters={hasActiveFilters}
        showFilters={displayMode === "list"}
        initialTimelinePage={seededData?.initialPage ?? null}
      />
    </div>
  );
}
