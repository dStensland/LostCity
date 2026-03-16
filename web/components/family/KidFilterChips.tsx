"use client";

import { memo } from "react";
import type { KidProfile } from "@/lib/types/kid-profiles";

const WARM_STONE = "#756E63";
const SAGE = "#5E7A5E";
const AMBER = "#C48B1D";
const SKY = "#78B7D0";

type GenericFilter = "weekend" | "free" | "indoor" | "outdoor";

interface GenericFilterConfig {
  id: GenericFilter;
  label: string;
  color: string;
}

const GENERIC_FILTERS: GenericFilterConfig[] = [
  { id: "weekend", label: "This Weekend", color: AMBER },
  { id: "free",    label: "Free",         color: SAGE },
  { id: "indoor",  label: "Indoor",       color: SKY },
  { id: "outdoor", label: "Outdoor",      color: SAGE },
];

interface KidFilterChipsProps {
  kids: KidProfile[];
  activeKidIds: string[];
  onToggleKid: (id: string) => void;
  activeGenericFilters?: GenericFilter[];
  onToggleGeneric?: (filter: GenericFilter) => void;
  /** Whether to show the generic filters (weekend, free, indoor, outdoor). Default: true */
  showGenericFilters?: boolean;
  className?: string;
}

export const KidFilterChips = memo(function KidFilterChips({
  kids,
  activeKidIds,
  onToggleKid,
  activeGenericFilters = [],
  onToggleGeneric,
  showGenericFilters = true,
  className = "",
}: KidFilterChipsProps) {
  const hasAnything = kids.length > 0 || showGenericFilters;
  if (!hasAnything) return null;

  return (
    <div
      className={`flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5 ${className}`}
      role="group"
      aria-label="Filter by kid or category"
    >
      {/* Kid chips */}
      {kids.map((kid) => {
        const isActive = activeKidIds.includes(kid.id);
        return (
          <button
            key={kid.id}
            type="button"
            onClick={() => onToggleKid(kid.id)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 min-h-[36px] whitespace-nowrap"
            style={
              isActive
                ? {
                    backgroundColor: `${kid.color}20`,
                    borderColor: `${kid.color}60`,
                    color: kid.color,
                  }
                : {
                    backgroundColor: "transparent",
                    borderColor: `${WARM_STONE}35`,
                    color: WARM_STONE,
                  }
            }
            aria-pressed={isActive}
          >
            {/* Color dot */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: kid.color }}
              aria-hidden="true"
            />
            {kid.emoji && (
              <span aria-hidden="true">{kid.emoji}</span>
            )}
            <span>
              {kid.nickname}
              <span
                className="ml-1 font-normal"
                style={{ opacity: 0.7 }}
              >
                ({kid.age})
              </span>
            </span>
          </button>
        );
      })}

      {/* Divider between kid chips and generic filters */}
      {kids.length > 0 && showGenericFilters && (
        <div
          className="flex-shrink-0 h-5 w-px mx-0.5"
          style={{ backgroundColor: `${WARM_STONE}30` }}
          aria-hidden="true"
        />
      )}

      {/* Generic filters */}
      {showGenericFilters &&
        GENERIC_FILTERS.map((filter) => {
          const isActive = activeGenericFilters.includes(filter.id);
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onToggleGeneric?.(filter.id)}
              className="flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 min-h-[36px] whitespace-nowrap"
              style={
                isActive
                  ? {
                      backgroundColor: `${filter.color}20`,
                      borderColor: `${filter.color}60`,
                      color: filter.color,
                    }
                  : {
                      backgroundColor: "transparent",
                      borderColor: `${WARM_STONE}35`,
                      color: WARM_STONE,
                    }
              }
              aria-pressed={isActive}
            >
              {filter.label}
            </button>
          );
        })}
    </div>
  );
});

export type { KidFilterChipsProps, GenericFilter };
