"use client";

import NeighborhoodsPageClient from "@/components/neighborhoods/NeighborhoodsPageClient";
import NeighborhoodIndexCard from "@/components/neighborhoods/NeighborhoodIndexCard";
import { getNeighborhoodColor } from "@/lib/neighborhood-colors";
import type {
  ExploreLaneComponentProps,
} from "@/lib/explore-platform/types";
import type { NeighborhoodsLaneInitialData } from "@/lib/explore-platform/lane-data";

/**
 * Neighborhoods lane inside the Explore shell.
 *
 * Renders the full neighborhoods index experience — map hero with editorial
 * overlay + mode filter, then the tiered minimalist card grid — as a lane
 * content area. Detail drilldown (`/{portal}/neighborhoods/[slug]`) stays
 * a standalone route, consistent with other lanes where deep-detail routes
 * exit the shell (Events lane → /events/[id], Places lane → /spots/[slug]).
 */
export function ExploreNeighborhoodsLane({
  portalSlug,
  initialData,
}: ExploreLaneComponentProps) {
  const seed = (initialData as NeighborhoodsLaneInitialData | null) ?? null;

  if (!seed) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <p className="text-sm text-[var(--muted)]">Loading neighborhoods…</p>
      </div>
    );
  }

  const {
    activityData,
    tierSections,
    tonightNeighborhoodCount,
    weekNeighborhoodCount,
  } = seed;

  return (
    <div className="max-w-6xl mx-auto px-4 pb-16">
      <section className="py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--cream)]">
          Neighborhoods
        </h1>
        <p className="text-sm text-[var(--soft)] mt-2 max-w-xl">
          Atlanta, block by block — what&apos;s alive tonight and across the week.
        </p>
      </section>

      {activityData.length > 0 && (
        <section className="mb-8">
          <NeighborhoodsPageClient
            activityData={activityData}
            portalSlug={portalSlug}
            tonightNeighborhoodCount={tonightNeighborhoodCount}
            weekNeighborhoodCount={weekNeighborhoodCount}
          />
        </section>
      )}

      {tierSections.map((section) => (
        <section key={section.title} className="mb-8">
          <div className="flex items-center gap-3 py-3 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-xs uppercase tracking-[0.12em] font-bold text-[var(--muted)]">
              {section.title}
            </h2>
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-2xs font-mono bg-[var(--twilight)] text-[var(--soft)] tabular-nums">
              {section.neighborhoods.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {section.neighborhoods.map((n) => {
              const activity = activityData.find((a) => a.slug === n.id);
              return (
                <NeighborhoodIndexCard
                  key={n.id}
                  name={n.name}
                  slug={n.id}
                  portalSlug={portalSlug}
                  color={getNeighborhoodColor(n.name)}
                  eventsTodayCount={activity?.eventsTodayCount ?? 0}
                  eventsWeekCount={activity?.eventsWeekCount ?? 0}
                  venueCount={activity?.venueCount ?? n.count}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
