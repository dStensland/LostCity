"use client";

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { useMemo } from "react";
import type { ExploreHomePayload, ExploreLaneDefinition } from "@/lib/explore-platform/types";
import { EXPLORE_EVENTS_UTILITY_VIEWS } from "@/lib/explore-platform/registry";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";

interface ExploreSidebarProps {
  lanes: ExploreLaneDefinition[];
  homeData: ExploreHomePayload | null;
  onLaneHover?: (laneId: ExploreLaneDefinition["id"]) => void;
}

export function ExploreSidebar({
  lanes,
  homeData,
  onLaneHover,
}: ExploreSidebarProps) {
  const state = useExploreUrlState();
  const laneCounts = homeData?.lanes ?? null;
  const activeLane = state.lane;

  const activeUtility = useMemo(() => {
    if (activeLane !== "events") return null;
    return state.display;
  }, [activeLane, state.display]);

  return (
    <aside
      className="w-[240px] h-full border-r border-[var(--twilight)] bg-[linear-gradient(180deg,rgba(8,11,18,0.96),rgba(10,14,24,0.88))]"
      aria-label="Explore navigation"
    >
      <div className="p-6 flex flex-col gap-6 h-full">
        <button
          type="button"
          onClick={() => state.goHome("push")}
          className={`text-left text-2xl font-bold leading-none transition-colors ${
            !activeLane && !state.q
              ? "text-[var(--coral)]"
              : "text-[var(--cream)] hover:text-[var(--coral)]"
          }`}
        >
          Explore
        </button>

        <button
          type="button"
          onClick={() =>
            state.replaceParams((next) => {
              next.delete("lane");
              next.delete("display");
              next.delete("q");
              next.set("focus", "search");
            })
          }
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[var(--void)]/55 border border-[var(--twilight)]/40 text-[var(--muted)] text-sm hover:border-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
        >
          <MagnifyingGlass size={14} weight="duotone" />
          <span>Search anything...</span>
        </button>

        <nav className="flex-1">
          <p className="font-mono text-2xs font-bold tracking-[0.14em] uppercase text-[var(--muted)] mb-2">
            Discovery Modes
          </p>
          <ul className="space-y-1">
            {lanes.map((lane) => {
              const Icon = lane.icon;
              const summary = laneCounts?.[lane.id];
              const isActive = activeLane === lane.id;
              return (
                <li key={lane.id}>
                  <button
                    type="button"
                    onClick={() => state.setLane(lane.id)}
                    onMouseEnter={() => onLaneHover?.(lane.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left"
                    style={
                      isActive
                        ? {
                            backgroundColor: `color-mix(in srgb, ${lane.accentToken} 12%, transparent)`,
                            color: lane.accentToken,
                          }
                        : undefined
                    }
                  >
                    <Icon
                      size={16}
                      weight="duotone"
                      color={isActive ? lane.accentToken : "var(--soft)"}
                      className="flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--cream)]">
                        {lane.label}
                      </div>
                      {summary && summary.count > 0 && (
                        <div className="text-2xs font-mono text-[var(--muted)] truncate">
                          {summary.copy}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6">
            <p className="font-mono text-2xs font-bold tracking-[0.14em] uppercase text-[var(--muted)] mb-2">
              Event Views
            </p>
            <div className="space-y-1">
              {EXPLORE_EVENTS_UTILITY_VIEWS.map((utility) => {
                const Icon = utility.icon;
                const isActive = activeUtility === utility.id;
                return (
                  <button
                    key={utility.id}
                    type="button"
                    onClick={() => state.setDisplay(utility.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left"
                    style={
                      isActive
                        ? {
                            backgroundColor: `color-mix(in srgb, ${utility.accentToken} 10%, transparent)`,
                            color: utility.accentToken,
                          }
                        : undefined
                    }
                  >
                    <Icon
                      size={15}
                      weight="duotone"
                      color={isActive ? utility.accentToken : "var(--soft)"}
                    />
                    <span className="text-sm text-[var(--soft)]">{utility.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}
