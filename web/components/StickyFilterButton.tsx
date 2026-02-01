"use client";

import { memo, useEffect, useState } from "react";
import { triggerHaptic } from "@/lib/haptics";

interface StickyFilterButtonProps {
  filterCount: number;
  resultCount?: number;
  onClick: () => void;
  scrollThreshold?: number;
}

export const StickyFilterButton = memo(function StickyFilterButton({
  filterCount,
  resultCount,
  onClick,
  scrollThreshold = 200,
}: StickyFilterButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > scrollThreshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollThreshold]);

  const handleClick = () => {
    triggerHaptic("light");
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`fixed bottom-20 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-[var(--coral)] text-[var(--void)] shadow-2xl font-mono text-sm font-medium transition-all duration-300 md:hidden ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
      }`}
      style={{
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
      }}
      aria-label={filterCount > 0 ? `Filters (${filterCount} active)` : "Filters"}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
        />
      </svg>
      <span>Filters</span>
      {filterCount > 0 && (
        <span className="px-2 py-0.5 rounded-full bg-[var(--void)] text-[var(--coral)] text-xs font-bold">
          {filterCount}
        </span>
      )}
      {resultCount !== undefined && (
        <span className="text-xs opacity-80">
          ({resultCount})
        </span>
      )}
    </button>
  );
});

export type { StickyFilterButtonProps };
