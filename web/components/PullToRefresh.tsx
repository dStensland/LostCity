"use client";

import { usePullToRefresh } from "@/hooks/usePullToRefresh";

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
  const { pullDistance, isRefreshing, isPulling, containerRef, indicatorStyle } =
    usePullToRefresh({
      onRefresh,
      threshold: 80,
      maxPull: 120,
      disabled,
    });

  const progress = Math.min(pullDistance / 80, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div ref={containerRef} className="relative">
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center pointer-events-none z-30"
        style={{
          top: -50,
          transform: `translateY(${pullDistance}px)`,
          opacity: showIndicator ? 1 : 0,
          transition: isPulling ? "opacity 0.1s" : "transform 0.3s ease-out, opacity 0.2s",
        }}
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
              className="w-5 h-5 text-[var(--coral)] transition-transform duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{
                transform: `rotate(${progress >= 1 ? 180 : 0}deg)`,
              }}
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
      <div style={indicatorStyle}>{children}</div>
    </div>
  );
}
