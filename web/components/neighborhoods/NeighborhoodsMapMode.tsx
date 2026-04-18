"use client";

export type NeighborhoodsMapModeValue = "tonight" | "week" | "all";

interface NeighborhoodsMapModeProps {
  value: NeighborhoodsMapModeValue;
  onChange: (next: NeighborhoodsMapModeValue) => void;
  className?: string;
}

const OPTIONS: { value: NeighborhoodsMapModeValue; label: string }[] = [
  { value: "tonight", label: "Tonight" },
  { value: "week", label: "This Week" },
  { value: "all", label: "All" },
];

/**
 * Mode filter pill for the neighborhoods map. Drives `fill-opacity` on the
 * Mapbox layer via a per-polygon `isActiveTonight` / `isActiveThisWeek` flag
 * (feasibility confirmed 2026-04-18; see NeighborhoodMap.tsx paint expression).
 *
 * Visually follows the FilterChip family but with a segmented-control feel —
 * single-select, no badges, compact. Pill background is deeper than the map
 * surface so it reads as UI on top of atmospheric gradient.
 */
export default function NeighborhoodsMapMode({
  value,
  onChange,
  className,
}: NeighborhoodsMapModeProps) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--twilight)] bg-[var(--void)]/85 p-1 backdrop-blur-none ${className ?? ""}`}
      role="radiogroup"
      aria-label="Map time scope"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`px-3.5 py-1.5 rounded-full font-mono text-xs font-semibold transition-colors ${
              active
                ? "bg-[var(--coral)] text-[var(--void)]"
                : "text-[var(--soft)] hover:text-[var(--cream)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
