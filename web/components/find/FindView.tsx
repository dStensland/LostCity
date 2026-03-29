"use client";

/**
 * FindView — unified discovery stream.
 *
 * Replaces the separate Happening + Places tabs with a single scrollable
 * stream: search bar → Right Now section → lane previews (Arts, Dining, etc.)
 *
 * URL params:
 *   ?lane=<lane>      — drill into a specific vertical lane (Task 4, placeholder)
 *   ?regulars=true    — show the day-of-week RegularsView instead
 */

import { memo, Suspense, lazy } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG } from "@/lib/types/discovery";
import { RightNowSection } from "./RightNowSection";
import { LanePreviewSection } from "./LanePreviewSection";
import { FindSidebar } from "./FindSidebar";

// Lazy-load RegularsView — only needed for ?regulars=true
const RegularsView = lazy(() => import("./RegularsView"));

// Lazy-load LaneView — only needed when ?lane= is present
const LaneView = dynamic(
  () => import("./LaneView").then((m) => ({ default: m.LaneView })),
  { ssr: false },
);

// -------------------------------------------------------------------------
// Default lane order + portal vertical → primary lane mapping
// -------------------------------------------------------------------------

const DEFAULT_LANE_ORDER: VerticalLane[] = [
  "arts",
  "dining",
  "nightlife",
  "outdoors",
  "music",
  "entertainment",
];

const VERTICAL_TO_LANE: Record<string, VerticalLane> = {
  arts: "arts",
  adventure: "outdoors",
  family: "entertainment",
  citizen: "arts",
};

function buildLaneOrder(portalSettings: Record<string, unknown>): VerticalLane[] {
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const laneParam = searchParams.get("lane") as VerticalLane | null;
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

  // ── Lane drill-in ──────────────────────────────────────────────────────
  if (laneParam && laneParam in LANE_CONFIG) {
    return (
      <div className="flex min-h-[50vh]">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden lg:block">
          <FindSidebar
            portalSlug={portalSlug}
            portalSettings={portalSettings}
            activeLane={laneParam}
          />
        </div>
        {/* Main content */}
        <div className="flex-1">
          <LaneView lane={laneParam} portalSlug={portalSlug} />
        </div>
      </div>
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
          activeLane={laneParam}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 space-y-0">
        {/* Search bar — hidden on desktop (sidebar has its own) */}
        <div className="mb-5 lg:hidden">
          <div className="relative">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              weight="regular"
            />
            <input
              type="search"
              placeholder="Search places, events, artists..."
              className="h-11 w-full rounded-card bg-[var(--dusk)] border border-[var(--twilight)] pl-9 pr-3 font-mono text-sm text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              // Read-only for now — full search will use the existing search infrastructure
              readOnly
              onClick={() => {
                router.push(`/${portalSlug}?view=find&q=`);
              }}
            />
          </div>
        </div>

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
