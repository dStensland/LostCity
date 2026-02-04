"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
  disabled?: boolean;
}

interface UsePullToRefreshReturn {
  pullDistance: number;
  isRefreshing: boolean;
  isPulling: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  indicatorStyle: React.CSSProperties;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;

      // Only activate when scrolled to top
      const container = containerRef.current;
      if (!container) return;

      // Check if at top of scroll
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop > 5) return;

      startYRef.current = e.touches[0].clientY;
      currentYRef.current = e.touches[0].clientY;
      setIsPulling(true);
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling || disabled || isRefreshing) return;

      currentYRef.current = e.touches[0].clientY;
      const diff = currentYRef.current - startYRef.current;

      // Only track downward pulls
      if (diff > 0) {
        // Apply resistance curve for natural feel
        const resistance = 0.5;
        const distance = Math.min(diff * resistance, maxPull);
        setPullDistance(distance);

        // Prevent scroll bounce on iOS when pulling
        if (distance > 10) {
          e.preventDefault();
        }
      } else {
        setPullDistance(0);
      }
    },
    [isPulling, disabled, isRefreshing, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold); // Hold at threshold during refresh

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Animate back to 0
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    // Use passive: false to allow preventDefault on touchmove
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  const indicatorStyle: React.CSSProperties = {
    transform: `translateY(${pullDistance}px)`,
    transition: isPulling ? "none" : "transform 0.3s ease-out",
  };

  return {
    pullDistance,
    isRefreshing,
    isPulling,
    containerRef,
    indicatorStyle,
  };
}
