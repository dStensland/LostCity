"use client";

import FilterChip, {
  type FilterChipVariant,
} from "@/components/filters/FilterChip";
import type { BigStuffType } from "@/lib/big-stuff/types";

export type FilterValue = BigStuffType | "all";

const BUCKETS: Array<{ value: Exclude<FilterValue, "all" | "other">; label: string; variant: FilterChipVariant }> = [
  { value: "festival", label: "Festivals", variant: "date" },
  { value: "convention", label: "Conventions", variant: "vibe" },
  { value: "sports", label: "Sports", variant: "access" },
  { value: "community", label: "Community", variant: "free" },
];

export interface BigStuffFilterChipsProps {
  counts: Record<BigStuffType, number>;
  active: FilterValue;
  onChange: (next: FilterValue) => void;
}

export default function BigStuffFilterChips({
  counts,
  active,
  onChange,
}: BigStuffFilterChipsProps) {
  const totalAll =
    counts.festival + counts.convention + counts.sports + counts.community + counts.other;

  return (
    <div
      role="tablist"
      aria-label="Filter by event type"
      className="flex flex-wrap items-center gap-2"
    >
      <div
        role="tab"
        aria-selected={active === "all"}
        onClick={() => onChange("all")}
        className="inline-flex items-center cursor-pointer focus-ring rounded-full"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onChange("all"); }}
      >
        <FilterChip
          label={`All ${totalAll}`}
          variant="default"
          active={active === "all"}
        />
      </div>
      {BUCKETS.filter((b) => counts[b.value] >= 2).map((b) => (
        <div
          key={b.value}
          role="tab"
          aria-selected={active === b.value}
          onClick={() => onChange(active === b.value ? "all" : b.value)}
          className="inline-flex items-center cursor-pointer focus-ring rounded-full"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              onChange(active === b.value ? "all" : b.value);
            }
          }}
        >
          <FilterChip
            label={`${b.label} ${counts[b.value]}`}
            variant={b.variant}
            active={active === b.value}
          />
        </div>
      ))}
    </div>
  );
}
