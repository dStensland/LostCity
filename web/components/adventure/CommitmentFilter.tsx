"use client";

import { memo } from "react";
import { ADV } from "@/lib/adventure-tokens";

// ---- Types ---------------------------------------------------------------

export type CommitmentTier = "hour" | "halfday" | "fullday" | "weekend";

export interface CommitmentFilterProps {
  activeTier: CommitmentTier | null;
  onTierChange: (tier: CommitmentTier | null) => void;
  availableTiers?: CommitmentTier[];
}

const TIER_LABELS: Record<CommitmentTier, string> = {
  hour: "1 HR",
  halfday: "HALF DAY",
  fullday: "FULL DAY",
  weekend: "WEEKEND",
};

const ALL_TIERS: CommitmentTier[] = ["hour", "halfday", "fullday", "weekend"];

// ---- Component -----------------------------------------------------------

export const CommitmentFilter = memo(function CommitmentFilter({
  activeTier,
  onTierChange,
  availableTiers,
}: CommitmentFilterProps) {
  const tiers = availableTiers ?? ALL_TIERS;

  return (
    <div
      className="flex gap-0 overflow-x-auto scrollbar-hide"
      role="group"
      aria-label="Filter by time commitment"
    >
      {/* ALL button */}
      {(() => {
        const isActive = activeTier === null;
        return (
          <button
            key="all"
            type="button"
            onClick={() => onTierChange(null)}
            aria-pressed={isActive}
            className="flex-shrink-0 px-4 py-2.5 text-xs font-bold transition-colors"
            style={{
              letterSpacing: "0.12em",
              borderRadius: 0,
              border: `2px solid ${ADV.DARK}30`,
              borderRight: "none",
              backgroundColor: isActive ? ADV.DARK : "transparent",
              color: isActive ? ADV.CREAM : ADV.STONE,
              cursor: "pointer",
            }}
          >
            ALL
          </button>
        );
      })()}

      {tiers.map((tier, idx) => {
        const isActive = activeTier === tier;
        const isLast = idx === tiers.length - 1;

        return (
          <button
            key={tier}
            type="button"
            onClick={() => onTierChange(isActive ? null : tier)}
            aria-pressed={isActive}
            className="flex-shrink-0 px-4 py-2.5 text-xs font-bold transition-colors"
            style={{
              letterSpacing: "0.12em",
              borderRadius: 0,
              border: `2px solid ${ADV.DARK}30`,
              borderRight: isLast ? `2px solid ${ADV.DARK}30` : "none",
              backgroundColor: isActive ? ADV.DARK : "transparent",
              color: isActive ? ADV.CREAM : ADV.STONE,
              cursor: "pointer",
            }}
          >
            {TIER_LABELS[tier]}
          </button>
        );
      })}
    </div>
  );
});

export type { CommitmentTier as CommitmentTierType };
