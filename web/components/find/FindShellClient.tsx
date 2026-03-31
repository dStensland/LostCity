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

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { FindSidebar } from "./FindSidebar";
import { MobileLaneBar } from "./MobileLaneBar";
import { FindContextProvider } from "./FindContextProvider";
import EventsFinder from "./EventsFinder";
import FindView from "./FindView";
import type { ServerFindData } from "@/lib/find-data";

// Dynamic imports for renderers not needed on every lane
const WhatsOnView = dynamic(() => import("./WhatsOnView"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
const RegularsView = dynamic(() => import("./RegularsView"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
const SpotsFinder = dynamic(() => import("./SpotsFinder"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});

// Valid shell lanes — anything else falls back to launchpad
const SHELL_LANES = new Set([
  "events", "now-showing", "live-music", "stage",
  "regulars", "places", "calendar", "map",
]);

interface FindShellClientProps {
  portalSlug: string;
  portalId: string;
  portalExclusive: boolean;
  serverFindData?: ServerFindData | null;
}

export default function FindShellClient({
  portalSlug,
  portalId,
  portalExclusive,
  serverFindData,
}: FindShellClientProps) {
  const searchParams = useSearchParams();
  const rawLane = searchParams.get("lane");
  const lane = rawLane && SHELL_LANES.has(rawLane) ? rawLane : null;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Desktop sidebar — fixed to viewport, ALWAYS mounted */}
      <div className="hidden lg:block fixed top-[73px] left-0 bottom-0 w-[240px] z-30 overflow-y-auto">
        <FindSidebar
          portalSlug={portalSlug}
          activeLane={lane}
        />
      </div>

      {/* Mobile lane bar — sticky, ALWAYS mounted */}
      <MobileLaneBar portalSlug={portalSlug} activeLane={lane} />

      {/* Content area — offset for sidebar on desktop */}
      <div className="lg:ml-[240px] min-w-0">
        <FindContextProvider portalId={portalId} portalSlug={portalSlug} portalExclusive={portalExclusive}>
          {!lane && (
            <FindView portalSlug={portalSlug} serverFindData={serverFindData ?? null} />
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
          {(lane === "now-showing" || lane === "live-music" || lane === "stage") && (
            <WhatsOnView portalId={portalId} portalSlug={portalSlug} />
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
        </FindContextProvider>
      </div>
    </div>
  );
}
