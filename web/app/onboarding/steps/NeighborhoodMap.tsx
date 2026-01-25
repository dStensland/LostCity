"use client";

import { useState, useMemo } from "react";
import { PREFERENCE_NEIGHBORHOODS } from "@/lib/preferences";
import type { OnboardingSwipeEvent } from "@/lib/types";

interface NeighborhoodMapProps {
  likedEvents: OnboardingSwipeEvent[];
  onComplete: (neighborhoods: string[]) => void;
  onSkip: () => void;
}

// Approximate positions for Atlanta neighborhoods (relative to container)
const NEIGHBORHOOD_POSITIONS: Record<string, { x: number; y: number }> = {
  Buckhead: { x: 45, y: 8 },
  Midtown: { x: 42, y: 28 },
  "Virginia-Highland": { x: 58, y: 32 },
  "Poncey-Highland": { x: 52, y: 38 },
  "Inman Park": { x: 60, y: 45 },
  "Old Fourth Ward": { x: 48, y: 42 },
  Downtown: { x: 35, y: 50 },
  "Little Five Points": { x: 65, y: 50 },
  "East Atlanta": { x: 58, y: 65 },
  "East Atlanta Village": { x: 62, y: 72 },
  "Grant Park": { x: 45, y: 68 },
  Kirkwood: { x: 72, y: 55 },
  Edgewood: { x: 55, y: 55 },
  "West End": { x: 25, y: 65 },
  Westside: { x: 20, y: 45 },
  Decatur: { x: 82, y: 48 },
};

export function NeighborhoodMap({ likedEvents, onComplete, onSkip }: NeighborhoodMapProps) {
  // Pre-select neighborhoods from liked events
  const initialNeighborhoods = useMemo(() => {
    const neighborhoods = new Set<string>();
    likedEvents.forEach((event) => {
      if (event.venue?.neighborhood) {
        neighborhoods.add(event.venue.neighborhood);
      }
    });
    return Array.from(neighborhoods);
  }, [likedEvents]);

  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>(initialNeighborhoods);

  const toggleNeighborhood = (neighborhood: string) => {
    setSelectedNeighborhoods((prev) =>
      prev.includes(neighborhood)
        ? prev.filter((n) => n !== neighborhood)
        : [...prev, neighborhood]
    );
  };

  const handleContinue = () => {
    onComplete(selectedNeighborhoods);
  };

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-120px)] px-4 py-6">
      {/* Header */}
      <div className="text-center mb-6 animate-fadeIn">
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--cream)] mb-1">
          Where do you explore?
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Tap neighborhoods to customize your feed
        </p>
      </div>

      {/* Visual map */}
      <div className="relative w-full max-w-md aspect-square mb-6 bg-[var(--dusk)]/30 rounded-2xl border border-[var(--twilight)]">
        {/* Grid lines for visual effect */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--twilight)" strokeWidth="0.2" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
        </svg>

        {/* Neighborhood bubbles */}
        {PREFERENCE_NEIGHBORHOODS.map((neighborhood) => {
          const pos = NEIGHBORHOOD_POSITIONS[neighborhood] || { x: 50, y: 50 };
          const isSelected = selectedNeighborhoods.includes(neighborhood);
          const hasLikedEvent = likedEvents.some(
            (e) => e.venue?.neighborhood === neighborhood
          );

          return (
            <button
              key={neighborhood}
              onClick={() => toggleNeighborhood(neighborhood)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
                isSelected
                  ? "z-20 scale-110"
                  : "z-10 hover:scale-105"
              }`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
            >
              <div
                className={`px-3 py-1.5 rounded-full text-xs font-mono whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-[var(--coral)] text-[var(--void)] shadow-lg shadow-[var(--coral)]/30"
                    : hasLikedEvent
                    ? "bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/50"
                    : "bg-[var(--twilight)] text-[var(--muted)] hover:bg-[var(--dusk)] hover:text-[var(--cream)]"
                }`}
              >
                {neighborhood}
                {hasLikedEvent && !isSelected && (
                  <span className="ml-1 text-[var(--coral)]">*</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {initialNeighborhoods.length > 0 && (
        <p className="text-xs text-[var(--muted)] mb-4 text-center">
          <span className="text-[var(--coral)]">*</span> From events you liked
        </p>
      )}

      {/* Selection count */}
      <p className="text-sm text-[var(--soft)] mb-4">
        {selectedNeighborhoods.length} neighborhood
        {selectedNeighborhoods.length !== 1 ? "s" : ""} selected
      </p>

      {/* Action buttons */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={handleContinue}
          className="w-full py-3 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded-lg hover:bg-[var(--rose)] transition-colors"
        >
          {selectedNeighborhoods.length > 0
            ? `Continue with ${selectedNeighborhoods.length} area${selectedNeighborhoods.length !== 1 ? "s" : ""}`
            : "Continue"}
        </button>

        <button
          onClick={onSkip}
          className="w-full py-3 text-center font-mono text-sm text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
        >
          Surprise me
        </button>
      </div>
    </div>
  );
}
