"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { usePortal } from "@/lib/portal-context";
import { getEnabledExploreLanes } from "@/lib/explore-platform/registry";
import { ExploreUrlStateProvider, useExploreUrlState } from "@/lib/explore-platform/url-state";
import type { ExploreHomePayload, ExploreLaneId } from "@/lib/explore-platform/types";
import type { ExploreLaneInitialDataMap } from "@/lib/explore-platform/lane-data";
import { ExploreSidebar } from "./ExploreSidebar";
import { ExploreMobileBar } from "./ExploreMobileBar";
import { ExploreHomeScreen } from "./ExploreHomeScreen";
import { ExploreSearchHero } from "./ExploreSearchHero";

function ExploreLaneBranchSkeleton() {
  return (
    <div className="space-y-4 py-6 px-2 animate-pulse">
      <div className="h-10 rounded-xl bg-[var(--twilight)]/30" />
      <div className="h-10 rounded-xl bg-[var(--twilight)]/20" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-[var(--twilight)]/15" />
        ))}
      </div>
    </div>
  );
}

function ExploreSearchBranchSkeleton() {
  return (
    <div className="space-y-3 py-4 animate-pulse">
      <div className="h-5 w-48 rounded bg-[var(--twilight)]/30" />
      <div className="grid gap-2 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-[var(--twilight)]/20" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-[var(--twilight)]/15" />
        ))}
      </div>
    </div>
  );
}

const DeferredExploreLaneHost = dynamic(
  () => import("./ExploreLaneHost").then((mod) => mod.ExploreLaneHost),
  {
    loading: () => <ExploreLaneBranchSkeleton />,
  },
);

const DeferredExploreSearchResults = dynamic(
  () => import("./ExploreSearchResults").then((mod) => mod.ExploreSearchResults),
  {
    loading: () => <ExploreSearchBranchSkeleton />,
  },
);

interface ExploreShellClientProps {
  portalSlug: string;
  portalId: string;
  portalExclusive: boolean;
  initialHomeData: ExploreHomePayload | null;
  initialHomeDataStale?: boolean;
  initialLaneId: ExploreLaneId | null;
  initialLaneData: ExploreLaneInitialDataMap[ExploreLaneId] | null;
  portalChromeVisible?: boolean;
}

function ExploreShellInner({
  portalSlug,
  portalId,
  portalExclusive,
  initialHomeData,
  initialHomeDataStale = false,
  initialLaneId,
  initialLaneData,
  portalChromeVisible,
}: ExploreShellClientProps) {
  const { portal } = usePortal();
  const state = useExploreUrlState();
  const lanes = useMemo(() => getEnabledExploreLanes(portal), [portal]);
  const activeLane = lanes.find((lane) => lane.id === state.lane) ?? null;
  const chromeTopClass = portalChromeVisible === false ? "top-0" : "top-[73px]";

  const [homeData, setHomeData] = useState<ExploreHomePayload | null>(
    initialHomeData,
  );
  const [homeLoading, setHomeLoading] = useState(!initialHomeData);
  const [homeRetryKey, setHomeRetryKey] = useState(0);

  useEffect(() => {
    if (state.lane || state.q) return;
    if (initialHomeData && !initialHomeDataStale && homeRetryKey === 0) return;

    const controller = new AbortController();

    fetch(`/api/portals/${portalSlug}/explore-home`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return (await response.json()) as ExploreHomePayload;
      })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setHomeData(payload);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && !initialHomeData) {
          setHomeData(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setHomeLoading(false);
        }
      });

    return () => controller.abort();
  }, [homeRetryKey, initialHomeData, initialHomeDataStale, portalSlug, state.lane, state.q]);

  useEffect(() => {
    if (!state.lane || typeof window === "undefined") return;
    performance.mark(`explore-lane-nav-start:${state.lane}`);
  }, [state.lane]);

  return (
    <div>
      <div className={`hidden lg:block fixed ${chromeTopClass} left-0 bottom-0 w-[240px] z-30 overflow-y-auto`}>
        <ExploreSidebar
          lanes={lanes}
          homeData={homeData}
          portalSlug={portalSlug}
          onLaneHover={(laneId) => {
            const lane = lanes.find((entry) => entry.id === laneId);
            void lane?.preload();
          }}
        />
      </div>

      <ExploreMobileBar lanes={lanes} portalSlug={portalSlug} portalChromeVisible={portalChromeVisible} />

      <div className="lg:ml-[240px] min-w-0">
        {!state.lane && (
          <div className="flex flex-col gap-5 max-w-5xl mx-auto px-4 py-5 sm:py-6 min-h-[calc(100vh-5rem)]">
            <ExploreSearchHero portalSlug={portalSlug} portalId={portalId} />
            {!state.q ? (
              <ExploreHomeScreen
                portalSlug={portalSlug}
                data={homeData}
                loading={homeLoading}
                onRetry={() => {
                  setHomeLoading(true);
                  setHomeRetryKey((value) => value + 1);
                }}
              />
            ) : (
              <DeferredExploreSearchResults portalSlug={portalSlug} />
            )}
          </div>
        )}

        {activeLane && (
          <div className="px-4 py-4 lg:px-5">
            <DeferredExploreLaneHost
              lane={activeLane}
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
              initialData={
                initialLaneId === activeLane.id ? initialLaneData : null
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExploreShellClient(props: ExploreShellClientProps) {
  return (
    <ExploreUrlStateProvider pathname={`/${props.portalSlug}/explore`}>
      <ExploreShellInner {...props} />
    </ExploreUrlStateProvider>
  );
}
