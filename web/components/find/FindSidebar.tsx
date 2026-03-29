"use client";

import { memo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Ticket } from "@phosphor-icons/react";
import type { VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG, LANE_ICONS } from "@/lib/types/discovery";
import { buildLaneOrder } from "@/components/find/FindView";
import { useWeather } from "@/lib/hooks/useWeather";
import FindSearchInput from "@/components/find/FindSearchInput";
import type { FindSpotlight } from "@/lib/find-data";

// -------------------------------------------------------------------------
// Lane → "See all" URL map (mirrors FindStream lane headers)
// -------------------------------------------------------------------------

const LANE_SEE_ALL_URLS: Record<string, string> = {
  arts: "?view=places&tab=things-to-do&venue_type=museum,gallery,arts_center,theater&from=find",
  dining: "?view=places&tab=eat-drink&from=find",
  nightlife: "?view=places&tab=nightlife&from=find",
  outdoors: "?view=places&tab=things-to-do&venue_type=park,trail,recreation,viewpoint,landmark&from=find",
  music: "?view=happening&content=showtimes&vertical=music&from=find",
  entertainment: "?view=places&tab=things-to-do&venue_type=arcade,attraction,entertainment,escape_room,bowling,zoo,aquarium,cinema&from=find",
};

// -------------------------------------------------------------------------
// Context block — date + weather placeholder
// -------------------------------------------------------------------------

function ContextBlock() {
  const weather = useWeather();
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="border-t border-[var(--twilight)] pt-4 space-y-1">
      <p className="font-mono text-xs font-bold text-[var(--cream)]">{dateLabel}</p>
      {!weather.loading && weather.temp > 0 && (
        <p className="text-xs text-[var(--muted)]">
          {Math.round(weather.temp)}°F · {weather.condition} · Atlanta
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// FindSidebar
// -------------------------------------------------------------------------

interface FindSidebarProps {
  portalSlug: string;
  portalSettings: Record<string, unknown>;
  activeLane: string | null;
  spotlights?: FindSpotlight[];
}

export const FindSidebar = memo(function FindSidebar({
  portalSlug,
  portalSettings,
  activeLane,
  spotlights,
}: FindSidebarProps) {
  const searchParams = useSearchParams();
  const laneOrder = buildLaneOrder(portalSettings);

  // Map spotlight data to lane names for count display
  const spotlightCounts = new Map(
    spotlights?.map((s) => [s.category, s.items.length]) ?? []
  );

  // Build lane hrefs — use LANE_SEE_ALL_URLS when available, falling back to
  // the stream lane filter. Clicking the active lane deselects (returns to stream).
  function laneHref(lane: VerticalLane): string {
    const seeAllUrl = LANE_SEE_ALL_URLS[lane];
    if (seeAllUrl && activeLane !== lane) {
      return `/${portalSlug}${seeAllUrl}`;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "find");
    if (activeLane === lane) {
      params.delete("lane");
    } else {
      params.set("lane", lane);
    }
    return `/${portalSlug}?${params.toString()}`;
  }

  return (
    <aside
      className="w-[240px] h-full bg-[var(--night)] border-r border-[var(--twilight)] p-6 flex flex-col gap-6 overflow-y-auto"
      aria-label="Find navigation"
    >
      {/* Title */}
      <h2 className="text-2xl font-bold text-[var(--cream)] leading-none">Find</h2>

      {/* Search bar */}
      <FindSearchInput portalSlug={portalSlug} placeholder="Search..." />

      {/* Lane navigation */}
      <nav className="flex-1">
        <p className="font-mono text-2xs font-bold tracking-[0.14em] uppercase text-[var(--muted)] mb-2">
          Lanes
        </p>
        <ul className="space-y-0.5">
          {laneOrder.map((lane) => {
            const config = LANE_CONFIG[lane];
            const LaneIcon = LANE_ICONS[config.icon] ?? Ticket;
            const isActive = activeLane === lane;

            return (
              <li key={lane}>
                <Link
                  href={laneHref(lane)}
                  className={[
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors",
                    isActive
                      ? "font-semibold"
                      : "text-[var(--soft)] hover:bg-[var(--dusk)]",
                  ].join(" ")}
                  style={
                    isActive
                      ? { backgroundColor: `${config.color}14` }
                      : undefined
                  }
                >
                  <LaneIcon
                    size={16}
                    color={isActive ? config.color : "var(--soft)"}
                    weight="duotone"
                    className="flex-shrink-0"
                  />
                  <span
                    className="flex-1 text-sm"
                    style={isActive ? { color: config.color } : undefined}
                  >
                    {config.label}
                  </span>
                  {spotlightCounts.has(lane) && (
                    <span
                      className="text-2xs font-mono font-bold tabular-nums px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${config.color}20`,
                        color: config.color,
                      }}
                    >
                      {spotlightCounts.get(lane)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Context block */}
      <ContextBlock />
    </aside>
  );
});

export type { FindSidebarProps };
