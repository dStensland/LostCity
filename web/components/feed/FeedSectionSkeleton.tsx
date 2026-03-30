"use client";

import { useEffect, useState } from "react";

interface FeedSectionSkeletonProps {
  accentColor: string;
  minHeight?: number;
  /** Minimum ms to show the skeleton even if data arrives faster (prevents flash) */
  minDisplayMs?: number;
  /** Ms after which to show a "taking longer than usual" message with retry */
  timeoutMs?: number;
  onRetry?: () => void;
}

/** Shimmer bar — a rounded rectangle with the skeleton-shimmer animation */
function Bar({ w, h = "h-3", className = "" }: { w: string; h?: string; className?: string }) {
  return <div className={`${h} rounded-full skeleton-shimmer ${className}`} style={{ width: w, opacity: 0.18 }} />;
}

/** Ghost pill — mimics a filter chip */
function Pill({ w }: { w: string }) {
  return (
    <div
      className="h-8 rounded-full skeleton-shimmer flex-shrink-0"
      style={{ width: w, opacity: 0.12 }}
    />
  );
}

/** Ghost event row — mimics a compact event card */
function EventRow({ delay }: { delay: number }) {
  return (
    <div
      className="flex items-center gap-3 py-3 border-b border-[var(--twilight)]/30"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Icon box */}
      <div className="w-8 h-8 rounded-lg skeleton-shimmer flex-shrink-0" style={{ opacity: 0.12 }} />
      {/* Text lines */}
      <div className="flex-1 space-y-2">
        <Bar w={`${60 + Math.round(delay * 0.02)}%`} h="h-3.5" />
        <Bar w={`${35 + Math.round(delay * 0.015)}%`} h="h-2.5" />
      </div>
      {/* Time badge */}
      <div className="w-14 h-5 rounded skeleton-shimmer flex-shrink-0" style={{ opacity: 0.1 }} />
    </div>
  );
}

export default function FeedSectionSkeleton({
  accentColor,
  minHeight = 360,
  minDisplayMs = 250,
  timeoutMs = 12000,
  onRetry,
}: FeedSectionSkeletonProps) {
  const [, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const minTimer = setTimeout(() => setMinElapsed(true), minDisplayMs);
    const timeoutTimer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(timeoutTimer);
    };
  }, [minDisplayMs, timeoutMs]);

  return (
    <div
      className="relative overflow-hidden"
      style={{ minHeight }}
      role="status"
    >
      {/* Section header — mimics FeedSectionHeader */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded skeleton-shimmer" style={{ opacity: 0.15 }} />
          <Bar w="120px" h="h-3" />
        </div>
        <Bar w="50px" h="h-2.5" />
      </div>

      {/* Time tab row — TODAY / THIS WEEK / COMING UP */}
      <div className="flex items-center gap-2 mb-3">
        <Pill w="80px" />
        <Pill w="96px" />
        <Pill w="92px" />
      </div>

      {/* Category chip row — All / Live Music / Comedy / Art / Food */}
      <div className="flex items-center gap-2 mb-5 overflow-hidden">
        <Pill w="52px" />
        <Pill w="88px" />
        <Pill w="76px" />
        <Pill w="48px" />
        <Pill w="84px" />
        <Pill w="100px" />
      </div>

      {/* Sub-label */}
      <div className="mb-3">
        <Bar w="80px" h="h-2.5" />
      </div>

      {/* Event rows */}
      <div className="space-y-0">
        <EventRow delay={0} />
        <EventRow delay={100} />
        <EventRow delay={200} />
        <EventRow delay={300} />
        <EventRow delay={400} />
        <EventRow delay={500} />
      </div>

      {/* "Show more" bar */}
      <div className="mt-4 flex justify-center">
        <Pill w="160px" />
      </div>

      {/* Timeout state */}
      {timedOut && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <span
            className="font-mono text-xs font-medium tracking-[0.15em] uppercase"
            style={{ color: accentColor, opacity: 0.7 }}
          >
            Taking longer than usual...
          </span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-1 px-4 py-1.5 rounded-lg font-mono text-xs font-medium transition-colors"
              style={{
                color: accentColor,
                border: `1px solid color-mix(in srgb, ${accentColor} 40%, transparent)`,
                background: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * Hook for parent components to enforce a minimum skeleton display time.
 * Prevents disorienting micro-flashes when data arrives quickly.
 */
// Re-export from shared hook for backwards compatibility
export { useMinSkeletonDelay } from "@/lib/hooks/useMinSkeletonDelay";
