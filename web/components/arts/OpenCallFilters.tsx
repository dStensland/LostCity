"use client";

import { memo } from "react";
import FilterChip from "@/components/filters/FilterChip";
import {
  CALL_TYPE_FILTER_OPTIONS,
  CONFIDENCE_TIER_FILTER_OPTIONS,
} from "@/lib/open-calls-utils";

interface OpenCallFiltersProps {
  activeType: string;
  activeTier: string;
  onTypeChange: (value: string) => void;
  onTierChange: (value: string) => void;
}

/**
 * Filter bar for the Open Calls Board.
 * Horizontally scrollable on mobile.
 * Uses window.history.replaceState for instant filter toggling
 * (NOT router.push — avoids Suspense re-render cycle).
 */
export const OpenCallFilters = memo(function OpenCallFilters({
  activeType,
  activeTier,
  onTypeChange,
  onTierChange,
}: OpenCallFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Call type row */}
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[var(--muted)] uppercase tracking-[0.12em] hidden sm:block">
          {"// type"}
        </span>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {CALL_TYPE_FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              variant="search"
              active={activeType === opt.value}
              onClick={() => onTypeChange(opt.value)}
            />
          ))}
        </div>
      </div>

      {/* Confidence tier row */}
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[var(--muted)] uppercase tracking-[0.12em] hidden sm:block">
          {"// source"}
        </span>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {CONFIDENCE_TIER_FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              variant="default"
              active={activeTier === opt.value}
              onClick={() => onTierChange(opt.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export type { OpenCallFiltersProps };
