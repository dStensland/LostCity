"use client";

import { memo } from "react";
import Link from "next/link";
import { ArrowLeft, Ticket } from "@phosphor-icons/react";
import type { VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG, LANE_ICONS } from "@/lib/types/discovery";

// -------------------------------------------------------------------------
// LaneFilterBar
// -------------------------------------------------------------------------

interface LaneFilterBarProps {
  lane: VerticalLane;
  portalSlug: string;
  totalCount: number;
  openCount: number;
}

export const LaneFilterBar = memo(function LaneFilterBar({
  lane,
  portalSlug,
  totalCount,
  openCount,
}: LaneFilterBarProps) {
  const config = LANE_CONFIG[lane];
  const LaneIcon = LANE_ICONS[config.icon] ?? Ticket;

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/${portalSlug}?view=find`}
        className="flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg border border-[var(--twilight)] bg-[var(--night)] px-2 text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
        aria-label="Back to Find"
      >
        <ArrowLeft size={16} weight="regular" />
        <span className="text-xs text-[var(--soft)]">Find</span>
      </Link>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <LaneIcon size={16} color={config.color} weight="duotone" />
        <span className="font-mono text-sm font-bold text-[var(--cream)] truncate">
          {config.label}
        </span>
      </div>

      {/* Summary */}
      <span className="font-mono text-xs text-[var(--muted)] flex-shrink-0">
        {totalCount > 0 && `${totalCount} places`}
        {openCount > 0 && (
          <>
            {totalCount > 0 ? " · " : ""}
            <span style={{ color: "#00D9A0" }}>{openCount} open</span>
          </>
        )}
      </span>
    </div>
  );
});

export type { LaneFilterBarProps };
