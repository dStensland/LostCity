"use client";

import { memo } from "react";

export type FilterCategory = "all" | "food" | "drinks" | "coffee" | "music" | "arts" | "fun";

interface CategoryOption {
  value: FilterCategory;
  label: string;
  icon: string;
}

const CATEGORIES: CategoryOption[] = [
  { value: "all", label: "All", icon: "✨" },
  { value: "food", label: "Food", icon: "🍽️" },
  { value: "drinks", label: "Drinks", icon: "🍺" },
  { value: "coffee", label: "Coffee", icon: "☕" },
  { value: "music", label: "Music", icon: "🎵" },
  { value: "arts", label: "Arts", icon: "🎭" },
  { value: "fun", label: "Fun", icon: "🎯" },
];

interface Props {
  selected: FilterCategory;
  onChange: (category: FilterCategory) => void;
  counts?: Partial<Record<FilterCategory, number>>;
  className?: string;
}

function CategoryFilterChips({ selected, onChange, counts, className = "" }: Props) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 scrollbar-hide ${className}`}>
      {CATEGORIES.map((cat) => {
        const isSelected = selected === cat.value;
        const count = counts?.[cat.value];

        return (
          <button
            key={cat.value}
            onClick={() => onChange(cat.value)}
            className={`
              flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
              text-sm font-medium transition-all
              ${
                isSelected
                  ? "bg-[var(--neon-amber)]/20 text-[var(--neon-amber)] border border-[var(--neon-amber)]/40 shadow-[0_0_8px_var(--neon-amber)/15]"
                  : "bg-[var(--twilight)]/50 text-[var(--soft)] border border-[var(--twilight)] hover:border-[var(--muted)] hover:text-[var(--cream)]"
              }
            `}
          >
            <span className="text-base">{cat.icon}</span>
            <span>{cat.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={`
                  font-mono text-xs px-1.5 py-0.5 rounded-full
                  ${
                    isSelected
                      ? "bg-[var(--neon-amber)]/30 text-[var(--neon-amber)]"
                      : "bg-[var(--twilight)] text-[var(--muted)]"
                  }
                `}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default memo(CategoryFilterChips);
