"use client";

/**
 * FindView — unified discovery stream.
 *
 * Replaces the separate Happening + Places tabs with a single scrollable
 * stream: search bar → Right Now section → lane previews (Arts, Dining, etc.)
 *
 * URL params:
 *   ?regulars=true    — show the day-of-week RegularsView instead
 */

import { memo, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { VerticalLane } from "@/lib/types/discovery";
import { DEFAULT_LANE_ORDER } from "@/lib/types/discovery";
import { RightNowSection } from "./RightNowSection";
import { LanePreviewSection } from "./LanePreviewSection";
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
  portalId: string;
  portalSlug: string;
  portalSettings: Record<string, unknown>;
}

// Default export required for dynamic import in page.tsx
export default memo(function FindView({
  portalId,
  portalSlug,
  portalSettings,
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
        <RegularsView portalId={portalId} portalSlug={portalSlug} />
      </Suspense>
    );
  }

  // ── Unified discovery stream ───────────────────────────────────────────
  const laneOrder = buildLaneOrder(portalSettings);

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

        {/* Right Now section */}
        <RightNowSection portalSlug={portalSlug} />

        {/* Lane previews */}
        {laneOrder.map((lane) => (
          <div key={lane}>
            <div className="my-5 border-t border-[var(--twilight)] opacity-50" />
            <LanePreviewSection lane={lane} portalSlug={portalSlug} />
          </div>
        ))}
      </div>
    </div>
  );
});
