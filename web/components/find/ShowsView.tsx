"use client";

import { useCallback } from "react";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";
import ShowtimesView from "./ShowtimesView";
import MusicListingsView from "./MusicListingsView";
import TheaterListingsView from "./TheaterListingsView";
import ComedyListingsView from "./ComedyListingsView";
import type { ShowsLaneInitialData } from "@/lib/explore-platform/lane-data";

type ShowsTab = "film" | "music" | "theater" | "comedy";

const TABS: { key: ShowsTab; label: string; accent: string }[] = [
  { key: "film", label: "Film", accent: "var(--vibe)" },
  { key: "music", label: "Music", accent: "var(--neon-magenta)" },
  { key: "theater", label: "Theater", accent: "var(--neon-cyan)" },
  { key: "comedy", label: "Comedy", accent: "var(--gold)" },
];

const VALID_TABS = new Set<ShowsTab>(["film", "music", "theater", "comedy"]);

function isValidTab(value: string | null): value is ShowsTab {
  return value !== null && VALID_TABS.has(value as ShowsTab);
}

interface ShowsViewProps {
  portalId: string;
  portalSlug: string;
  initialData?: ShowsLaneInitialData | null;
}

export function ShowsView({ portalId, portalSlug, initialData }: ShowsViewProps) {
  const state = useExploreUrlState();
  const rawTab = state.params.get("tab");
  const activeTab: ShowsTab = isValidTab(rawTab) ? rawTab : "film";

  const handleTabChange = useCallback(
    (tab: ShowsTab) => {
      state.setLaneParams({ tab }, "replace");
    },
    [state],
  );

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide border-b border-[var(--twilight)]/30 px-4 sm:px-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className="shrink-0 px-4 py-3 text-sm font-semibold transition-colors relative"
            style={{ color: activeTab === tab.key ? tab.accent : "var(--soft)" }}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div
                className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                style={{ backgroundColor: tab.accent }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "film" && (
        <ShowtimesView
          portalId={portalId}
          portalSlug={portalSlug}
          initialData={initialData?.tab === "film" ? initialData : null}
        />
      )}
      {activeTab === "music" && (
        <MusicListingsView
          portalId={portalId}
          portalSlug={portalSlug}
          initialData={initialData?.tab === "music" ? initialData : null}
        />
      )}
      {activeTab === "theater" && (
        <TheaterListingsView
          portalId={portalId}
          portalSlug={portalSlug}
          initialData={initialData?.tab === "theater" ? initialData : null}
        />
      )}
      {activeTab === "comedy" && (
        <ComedyListingsView
          portalId={portalId}
          portalSlug={portalSlug}
          initialData={initialData?.tab === "comedy" ? initialData : null}
        />
      )}
    </div>
  );
}

export type { ShowsViewProps };
