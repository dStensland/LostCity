"use client";

/**
 * FindShellClient — the persistent Explore shell.
 *
 * Client component that owns navigation. Sidebar and MobileLaneBar persist
 * permanently across lane switches (never unmount). Lane content is rendered
 * conditionally based on the `lane` URL param — zero server round-trips.
 *
 * Only the launchpad (no lane) fetches data — via client-side API call.
 * All lane renderers (EventsFinder, WhatsOnView, etc.) fetch their own data.
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useReplaceStateParams } from "@/lib/hooks/useReplaceStateParams";
import dynamic from "next/dynamic";
import { FindSidebar } from "./FindSidebar";
import { MobileLaneBar } from "./MobileLaneBar";
import { FindContextProvider } from "./FindContextProvider";
import EventsFinder from "./EventsFinder";
import { ExploreHome } from "./ExploreHome";
import type { ExploreHomeResponse } from "@/lib/types/explore-home";
import { SHELL_LANE_SET } from "@/lib/explore-lane-meta";

function LaneSkeleton() {
  return (
    <div className="space-y-4 py-6 px-2 animate-pulse">
      <div className="h-10 bg-[var(--twilight)]/30 rounded-xl" />
      <div className="h-10 bg-[var(--twilight)]/20 rounded-xl" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-[var(--twilight)]/15 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

const showsImport = () => import("./ShowsView").then((m) => m.ShowsView);
const regularsImport = () => import("./RegularsView");
const spotsImport = () => import("./SpotsFinder");
const classesImport = () => import("./ClassesView").then((m) => m.ClassesView);
const gameDayImport = () => import("./GameDayView").then((m) => m.GameDayView);

const ShowsView = dynamic(showsImport, { loading: LaneSkeleton });
const RegularsView = dynamic(regularsImport, { loading: LaneSkeleton });
const SpotsFinder = dynamic(spotsImport, { loading: LaneSkeleton });
const ClassesView = dynamic(classesImport, { loading: LaneSkeleton });
const GameDayView = dynamic(gameDayImport, { loading: LaneSkeleton });

const LANE_PRELOADS: Record<string, () => void> = {
  shows: () => void showsImport(),
  regulars: () => void regularsImport(),
  places: () => void spotsImport(),
  classes: () => void classesImport(),
  "game-day": () => void gameDayImport(),
};

// Valid shell lanes — anything else falls back to launchpad
const SHELL_LANES = SHELL_LANE_SET;

// Legacy lane params that should redirect to the consolidated shows lane
const SHOW_LANE_REDIRECTS: Record<string, string> = {
  "now-showing": "film",
  "live-music": "music",
  "stage": "theater",
};

interface FindShellClientProps {
  portalSlug: string;
  portalId: string;
  portalExclusive: boolean;
}

export default function FindShellClient({
  portalSlug,
  portalId,
  portalExclusive,
}: FindShellClientProps) {
  // Lane is client-only state — the server component doesn't use it.
  // Using router.push for lane changes triggers a server round-trip that
  // returns identical output, causing useSearchParams to not update.
  // Instead: React state is the source of truth, pushState keeps URL in sync.
  const initialSearchParams = useSearchParams();
  const liveParams = useReplaceStateParams(); // for filter state reads (search, categories, etc.)

  function resolveLane(raw: string | null): string | null {
    if (raw && raw in SHOW_LANE_REDIRECTS) return "shows";
    if (raw && SHELL_LANES.has(raw)) return raw;
    return null;
  }

  const [lane, setLane] = useState<string | null>(() => {
    const raw = (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : initialSearchParams
    ).get("lane");
    return resolveLane(raw);
  });

  // Back/forward navigation: read lane from URL when browser history changes
  useEffect(() => {
    const onPopState = () => {
      const raw = new URLSearchParams(window.location.search).get("lane");
      setLane(resolveLane(raw));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Rewrite legacy lane URLs on mount
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("lane");
    if (raw && raw in SHOW_LANE_REDIRECTS) {
      const tab = SHOW_LANE_REDIRECTS[raw];
      const url = new URL(window.location.href);
      url.searchParams.set("lane", "shows");
      url.searchParams.set("tab", tab);
      url.searchParams.delete("vertical");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Lane change handler — passed to sidebar and mobile bar
  const handleLaneChange = useCallback((laneId: string | null) => {
    setLane(laneId);
    const url = new URL(window.location.href);
    if (laneId) {
      url.searchParams.set("view", "find");
      url.searchParams.set("lane", laneId);
    } else {
      url.searchParams.delete("lane");
    }
    // pushState (not replaceState) so back/forward between lanes works
    window.history.pushState({}, "", url.toString());
  }, []);

  const hasActiveFilters = !!(
    liveParams.get("search") ||
    liveParams.get("categories") ||
    liveParams.get("date") ||
    liveParams.get("genres") ||
    liveParams.get("tags") ||
    liveParams.get("vibes") ||
    liveParams.get("price") ||
    liveParams.get("free")
  );

  const [exploreData, setExploreData] = useState<ExploreHomeResponse | null>(null);
  const [exploreLoading, setExploreLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    // Only fetch when showing Explore Home (no lane selected)
    if (lane) {
      setExploreLoading(false);
      return;
    }

    let retryCount = 0;
    const MAX_RETRIES = 2;
    let cancelled = false;

    async function fetchExploreData() {
      setExploreLoading(true);

      while (retryCount <= MAX_RETRIES && !cancelled) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const res = await fetch(`/api/portals/${portalSlug}/explore-home`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          const json = await res.json();
          if (!cancelled) {
            setExploreData(json as ExploreHomeResponse);
            setExploreLoading(false);
          }
          return; // Success — exit retry loop
        } catch {
          retryCount++;
          if (retryCount <= MAX_RETRIES && !cancelled) {
            // Wait before retry: 750ms, then 1750ms
            await new Promise((r) => setTimeout(r, retryCount * 500 + 250));
          }
        }
      }

      // All retries exhausted
      if (!cancelled) {
        setExploreLoading(false);
      }
    }

    fetchExploreData();

    return () => {
      cancelled = true;
    };
  }, [portalSlug, lane, retryKey]);

  return (
    <div>
      {/* Desktop sidebar — fixed to viewport, ALWAYS mounted */}
      <div className="hidden lg:block fixed top-[73px] left-0 bottom-0 w-[240px] z-30 overflow-y-auto">
        <FindSidebar
          portalSlug={portalSlug}
          activeLane={lane}
          laneStates={exploreData?.lanes}
          onLaneChange={handleLaneChange}
          onLaneHover={(laneId) => LANE_PRELOADS[laneId]?.()}
        />
      </div>

      {/* Mobile lane bar — sticky, ALWAYS mounted */}
      <MobileLaneBar portalSlug={portalSlug} activeLane={lane} onLaneChange={handleLaneChange} />

      {/* Content area — offset for sidebar on desktop */}
      <div className="lg:ml-[240px] min-w-0">
        <FindContextProvider portalId={portalId} portalSlug={portalSlug} portalExclusive={portalExclusive}>
          {!lane && (
            <ExploreHome
              portalSlug={portalSlug}
              portalId={portalId}
              data={exploreData}
              loading={exploreLoading}
              onRetry={() => setRetryKey((k) => k + 1)}
            />
          )}
          {lane === "events" && (
            <EventsFinder
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
              displayMode="list"
              hasActiveFilters={hasActiveFilters}
            />
          )}
          {lane === "shows" && (
            <ShowsView portalId={portalId} portalSlug={portalSlug} />
          )}
          {lane === "regulars" && (
            <RegularsView portalId={portalId} portalSlug={portalSlug} />
          )}
          {lane === "places" && (
            <SpotsFinder
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
              displayMode="list"
            />
          )}
          {lane === "classes" && (
            <ClassesView portalId={portalId} portalSlug={portalSlug} />
          )}
          {lane === "calendar" && (
            <EventsFinder
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
              displayMode="calendar"
              hasActiveFilters={false}
              showFilters={false}
            />
          )}
          {lane === "map" && (
            <EventsFinder
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
              displayMode="map"
              hasActiveFilters={false}
              showFilters={false}
            />
          )}
          {lane === "game-day" && (
            <GameDayView portalId={portalId} portalSlug={portalSlug} />
          )}
        </FindContextProvider>
      </div>
    </div>
  );
}
