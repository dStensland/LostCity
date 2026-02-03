"use client";

import { memo } from "react";

// Muted palette for skeleton categories - subtle colors that don't distract
// Uses low opacity versions of warm colors to work across dark portals
const SKELETON_COLORS = [
  "rgba(244, 114, 182, 0.4)", // Music - muted pink
  "rgba(248, 113, 113, 0.4)", // Theaters - muted red
  "rgba(251, 191, 36, 0.4)",  // Comedy - muted amber
  "rgba(196, 181, 253, 0.4)", // Arts - muted violet
  "rgba(165, 180, 252, 0.4)", // Film - muted indigo
  "rgba(110, 231, 183, 0.4)", // Community - muted emerald
  "rgba(251, 146, 60, 0.4)",  // Food - muted orange
  "rgba(192, 132, 252, 0.4)", // Bars - muted purple
  "rgba(249, 168, 212, 0.4)", // Sports - muted rose
  "rgba(167, 139, 250, 0.4)", // Fitness - muted violet
  "rgba(232, 121, 249, 0.4)", // Nightlife - muted magenta
  "rgba(253, 186, 116, 0.4)", // Events - muted peach
];

interface CategorySkeletonProps {
  /** Number of category rows to show */
  count?: number;
  /** Title for the section */
  title?: string;
  /** Subtitle for the section */
  subtitle?: string;
  /** Whether to show sort buttons */
  showSortButtons?: boolean;
}

// Deterministic width pattern to avoid Math.random() during render
const WIDTH_PATTERN = [55, 42, 68, 51, 63, 47, 58, 44, 66, 52, 61, 49];

/**
 * A skeleton loader that mimics collapsed category headers with a rainbow color palette.
 * Creates a visually appealing loading state that matches the actual content structure.
 */
function CategorySkeleton({
  count = 8,
  title,
  subtitle,
  showSortButtons = true,
}: CategorySkeletonProps) {
  // Use a subset of colors based on count, cycling through if needed
  const colors = Array.from({ length: count }, (_, i) => SKELETON_COLORS[i % SKELETON_COLORS.length]);

  return (
    <div className="py-6 animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            {title ? (
              <h2 className="text-xl font-semibold text-[var(--cream)]">{title}</h2>
            ) : (
              <div className="h-6 w-24 rounded skeleton-shimmer" />
            )}
            {subtitle ? (
              <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>
            ) : (
              <div className="h-4 w-48 rounded skeleton-shimmer mt-2" style={{ animationDelay: "0.1s" }} />
            )}
          </div>
          {showSortButtons && (
            <div className="flex items-center gap-1">
              <div className="h-6 w-16 rounded skeleton-shimmer" style={{ animationDelay: "0.05s" }} />
              <div className="h-6 w-12 rounded skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
              <div className="h-6 w-10 rounded skeleton-shimmer" style={{ animationDelay: "0.15s" }} />
            </div>
          )}
        </div>
      </div>

      {/* Category rows with rainbow colors */}
      <div className="space-y-1">
        {colors.map((color, i) => (
          <CategoryRowSkeleton
            key={i}
            color={color}
            delay={i * 0.08}
            widthPercent={WIDTH_PATTERN[i % WIDTH_PATTERN.length]}
          />
        ))}
      </div>
    </div>
  );
}

interface CategoryRowSkeletonProps {
  color: string;
  delay: number;
  widthPercent: number;
}

/**
 * A single category row skeleton with colored dot and shimmer effect
 */
const CategoryRowSkeleton = memo(function CategoryRowSkeleton({
  color,
  delay,
  widthPercent,
}: CategoryRowSkeletonProps) {
  return (
    <div
      className="flex items-center gap-2 py-3 px-1"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Colored dot - subtle glow */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 6px ${color}`,
          animationDelay: `${delay}s`,
          animationDuration: "2s",
        }}
      />

      {/* Category label skeleton - subtle tint */}
      <div
        className="h-3 rounded flex-1"
        style={{
          maxWidth: `${widthPercent}%`,
          background: `linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.06) 100%)`,
          backgroundSize: "200% 100%",
          animation: `skeleton-shimmer 1.5s ease-in-out infinite`,
          animationDelay: `${delay}s`,
        }}
      />

      {/* Count badge skeleton */}
      <div
        className="h-3 w-6 rounded skeleton-shimmer flex-shrink-0"
        style={{ animationDelay: `${delay + 0.1}s` }}
      />

      {/* Chevron placeholder */}
      <div
        className="w-4 h-4 rounded skeleton-shimmer flex-shrink-0"
        style={{ animationDelay: `${delay + 0.15}s` }}
      />
    </div>
  );
});

export default memo(CategorySkeleton);

// Also export colors for reuse
export { SKELETON_COLORS };
