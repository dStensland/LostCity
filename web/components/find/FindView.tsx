"use client";

/**
 * FindView — unified discovery stream (pure presentation component).
 *
 * Data arrives server-side via `serverFindData` prop from the async
 * ServerFindView RSC wrapper in page.tsx. No client-side data fetching.
 *
 * URL params:
 *   ?regulars=true    — show the day-of-week RegularsView instead
 */

import { memo, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { VerticalLane } from "@/lib/types/discovery";
import { DEFAULT_LANE_ORDER } from "@/lib/types/discovery";
import type { ServerFindData } from "@/lib/find-data";
import { FindSidebar } from "./FindSidebar";
import FindSearchInput from "@/components/find/FindSearchInput";
import { FindToolChipRow } from "./FindToolChipRow";

// Lazy-load RegularsView — only needed for ?regulars=true
const RegularsView = dynamic(() => import("./RegularsView"), {
  loading: () => (
    <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">
      Loading...
    </div>
  ),
});

// -------------------------------------------------------------------------
// Portal vertical → primary lane mapping + lane order builder
// -------------------------------------------------------------------------

const VERTICAL_TO_LANE: Record<string, VerticalLane> = {
  arts: "arts",
  adventure: "outdoors",
  family: "entertainment",
  citizen: "arts",
};

export function buildLaneOrder(portalSettings: Record<string, unknown>): VerticalLane[] {
  const vertical = portalSettings?.vertical as string | undefined;
  if (!vertical) return DEFAULT_LANE_ORDER;

  const primaryLane = VERTICAL_TO_LANE[vertical];
  if (!primaryLane) return DEFAULT_LANE_ORDER;

  // Move the primary lane to front, keep everything else in order
  return [
    primaryLane,
    ...DEFAULT_LANE_ORDER.filter((l) => l !== primaryLane),
  ];
}

// -------------------------------------------------------------------------
// FindView
// -------------------------------------------------------------------------

interface FindViewProps {
  portalSlug: string;
  portalSettings: Record<string, unknown>;
  serverFindData: ServerFindData | null;
}

// Default export required for dynamic import compatibility
export default memo(function FindView({
  portalSlug,
  portalSettings,
  serverFindData,
}: FindViewProps) {
  const searchParams = useSearchParams();
  const regularsParam = searchParams.get("regulars");

  // ── Regulars view ──────────────────────────────────────────────────────
  if (regularsParam === "true") {
    return (
      <Suspense
        fallback={
          <div className="py-16 text-center font-mono text-sm text-[var(--muted)]">
            Loading...
          </div>
        }
      >
        <RegularsView portalId={""} portalSlug={portalSlug} />
      </Suspense>
    );
  }

  // ── Unified discovery stream ───────────────────────────────────────────

  return (
    <div className="flex min-h-[50vh]">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:block">
        <FindSidebar
          portalSlug={portalSlug}
          portalSettings={portalSettings}
          activeLane={null}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 space-y-0">
        {/* Search bar */}
        <div className="px-4 pt-2 pb-1">
          <FindSearchInput portalSlug={portalSlug} placeholder="Search places, events, artists..." />
        </div>

        {/* Tool chip row */}
        <FindToolChipRow portalSlug={portalSlug} />

        {/* Debug output: proves server data is flowing correctly */}
        {serverFindData && (
          <pre className="text-xs text-[var(--muted)] p-4 overflow-auto">
            {JSON.stringify({
              rightNow: serverFindData.rightNow.length,
              pulse: serverFindData.pulse,
              spotlights: serverFindData.spotlights.map((s) => s.label),
            }, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
});
