"use client";

import { useCallback } from "react";

const INTEREST_FILTERS = [
  { id: "food", label: "Food & Dining", icon: "utensils" },
  { id: "music", label: "Music", icon: "music" },
  { id: "arts", label: "Arts & Culture", icon: "palette" },
  { id: "nightlife", label: "Nightlife", icon: "moon" },
  { id: "sports", label: "Sports", icon: "trophy" },
  { id: "wellness", label: "Wellness", icon: "heart" },
  { id: "outdoor", label: "Outdoors", icon: "tree" },
] as const;

interface InterestFilterBarProps {
  activeInterests: string[];
  onToggle: (interest: string) => void;
}

export default function InterestFilterBar({ activeInterests, onToggle }: InterestFilterBarProps) {
  const handleToggle = useCallback(
    (id: string) => {
      onToggle(id);
    },
    [onToggle]
  );

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {INTEREST_FILTERS.map((filter) => {
        const isActive = activeInterests.includes(filter.id);
        return (
          <button
            key={filter.id}
            onClick={() => handleToggle(filter.id)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-body transition-all ${
              isActive
                ? "bg-[var(--hotel-charcoal)] text-white"
                : "bg-[var(--hotel-cream)] text-[var(--hotel-stone)] border border-[var(--hotel-sand)] hover:bg-[var(--hotel-sand)]"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
