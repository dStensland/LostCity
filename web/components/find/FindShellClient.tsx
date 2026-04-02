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

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { FindSidebar } from "./FindSidebar";
import { MobileLaneBar } from "./MobileLaneBar";
import { FindContextProvider } from "./FindContextProvider";
import EventsFinder from "./EventsFinder";
import { ExploreHome } from "./ExploreHome";
import type { ExploreHomeResponse } from "@/lib/types/explore-home";

// Dynamic imports for renderers not needed on every lane
const ShowsView = dynamic(() => import("./ShowsView").then((m) => m.ShowsView), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
const RegularsView = dynamic(() => import("./RegularsView"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
const SpotsFinder = dynamic(() => import("./SpotsFinder"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
const ClassesView = dynamic(() => import("./ClassesView").then((m) => m.ClassesView), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
const GameDayView = dynamic(() => import("./GameDayView").then(m => m.GameDayView), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});

// Valid shell lanes — anything else falls back to launchpad
const SHELL_LANES = new Set([
  "events", "shows",
  "regulars", "places", "classes", "calendar", "map", "game-day",
]);

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
  const searchParams = useSearchParams();
  const rawLane = searchParams.get("lane");

  // Compute effective lane synchronously — legacy show lanes resolve to "shows"
  const lane = rawLane && rawLane in SHOW_LANE_REDIRECTS
    ? "shows"
    : rawLane && SHELL_LANES.has(rawLane) ? rawLane : null;

  // Side-effect: rewrite legacy lane URLs so bookmarks/sharing get the new URL
  useEffect(() => {
    if (rawLane && rawLane in SHOW_LANE_REDIRECTS) {
      const tab = SHOW_LANE_REDIRECTS[rawLane];
      const url = new URL(window.location.href);
      url.searchParams.set("lane", "shows");
      url.searchParams.set("tab", tab);
      url.searchParams.delete("vertical");
      window.history.replaceState({}, "", url.toString());
    }
  }, [rawLane]);

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
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Desktop sidebar — fixed to viewport, ALWAYS mounted */}
      <div className="hidden lg:block fixed top-[73px] left-0 bottom-0 w-[240px] z-30 overflow-y-auto">
        <FindSidebar
          portalSlug={portalSlug}
          activeLane={lane}
          laneStates={exploreData?.lanes}
        />
      </div>

      {/* Mobile lane bar — sticky, ALWAYS mounted */}
      <MobileLaneBar portalSlug={portalSlug} activeLane={lane} />

      {/* Content area — offset for sidebar on desktop */}
      <div className="lg:ml-[240px] min-w-0">
        <FindContextProvider portalId={portalId} portalSlug={portalSlug} portalExclusive={portalExclusive}>
          {!lane && (
            <ExploreHome
              portalSlug={portalSlug}
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
              hasActiveFilters={false}
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
            />
          )}
          {lane === "map" && (
            <EventsFinder
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
              displayMode="map"
              hasActiveFilters={false}
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
