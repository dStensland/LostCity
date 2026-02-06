"use client";

import { usePullToRefresh } from "@/lib/hooks/usePullToRefresh";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForLength } from "@/lib/css-utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

export default function PullToRefresh({
  onRefresh,
  children,
  disabled = false,
}: PullToRefreshProps) {
  const { pullDistance, isRefreshing, isPulling, containerRef } =
    usePullToRefresh({
      onRefresh,
      threshold: 80,
      maxPull: 120,
      disabled,
    });

  const progress = Math.min(pullDistance / 80, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;
  const pullDistanceClass = createCssVarClassForLength(
    "--pull-distance",
    `${pullDistance}px`,
    "pull-distance"
  );

  return (
    <div ref={containerRef} className="relative">
      <ScopedStyles css={pullDistanceClass?.css} />
      {/* Pull indicator */}
      <div
        className={`absolute left-0 right-0 flex justify-center pointer-events-none z-30 top-[-50px] pull-indicator ${
          pullDistanceClass?.className ?? ""
        } ${isPulling ? "pulling" : "released"} ${showIndicator ? "opacity-100" : "opacity-0"}`}
      >
        <div
          className={`
            flex items-center justify-center w-10 h-10 rounded-full
            bg-[var(--night)] border border-[var(--twilight)]
            shadow-lg shadow-[var(--void)]/50
            ${isRefreshing ? "animate-pulse" : ""}
          `}
        >
          {isRefreshing ? (
            // Loading spinner
            <svg
              className="w-5 h-5 text-[var(--coral)] animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            // Arrow indicator
            <svg
              className={`w-5 h-5 text-[var(--coral)] transition-transform duration-200 ${
                progress >= 1 ? "rotate-180" : "rotate-0"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Content with pull transform */}
      <div
        className={`pull-content ${pullDistanceClass?.className ?? ""} ${
          isPulling ? "pulling" : "released"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
