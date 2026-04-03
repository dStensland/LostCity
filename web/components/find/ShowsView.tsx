"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

function TabSkeleton() {
  return (
    <div className="px-4 py-6 space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-xl bg-[var(--twilight)]/40 animate-pulse" />
      ))}
    </div>
  );
}

const ShowtimesView = dynamic(() => import("./ShowtimesView"), { loading: () => <TabSkeleton /> });
const MusicListingsView = dynamic(() => import("./MusicListingsView"), { loading: () => <TabSkeleton /> });
const TheaterListingsView = dynamic(() => import("./TheaterListingsView"), { loading: () => <TabSkeleton /> });
const ComedyListingsView = dynamic(() => import("./ComedyListingsView"), { loading: () => <TabSkeleton /> });

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
}

export function ShowsView({ portalId, portalSlug }: ShowsViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams?.get("tab");
  const activeTab: ShowsTab = isValidTab(rawTab) ? rawTab : "film";

  const handleTabChange = useCallback(
    (tab: ShowsTab) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("tab", tab);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
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
      {activeTab === "film" && <ShowtimesView portalId={portalId} portalSlug={portalSlug} />}
      {activeTab === "music" && <MusicListingsView portalId={portalId} portalSlug={portalSlug} />}
      {activeTab === "theater" && <TheaterListingsView portalId={portalId} portalSlug={portalSlug} />}
      {activeTab === "comedy" && <ComedyListingsView portalId={portalId} portalSlug={portalSlug} />}
    </div>
  );
}

export type { ShowsViewProps };
