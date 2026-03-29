"use client";

import { memo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass, Ticket } from "@phosphor-icons/react";
import type { VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG, LANE_ICONS } from "@/lib/types/discovery";
import { buildLaneOrder } from "@/components/find/FindView";
import { useWeather } from "@/lib/hooks/useWeather";

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
}

export const FindSidebar = memo(function FindSidebar({
  portalSlug,
  portalSettings,
  activeLane,
}: FindSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const laneOrder = buildLaneOrder(portalSettings);

  // Build lane hrefs — clicking the active lane deselects (returns to stream)
  function laneHref(lane: VerticalLane): string {
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
      <div className="relative">
        <MagnifyingGlass
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          weight="regular"
        />
        <input
          type="search"
          placeholder="Search..."
          className="h-9 w-full rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] pl-8 pr-3 font-mono text-sm text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
          readOnly
          onClick={() => {
            router.push(`/${portalSlug}?view=happening`);
          }}
        />
      </div>

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
