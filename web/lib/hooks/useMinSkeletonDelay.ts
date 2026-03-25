"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Enforce a minimum display time for loading skeletons.
 * Prevents disorienting micro-flashes when data arrives quickly.
 *
 * @param isLoading - Whether data is currently loading
 * @param minMs - Minimum display time in ms (default 250)
 * @returns Whether the skeleton should still be shown
 */
export function useMinSkeletonDelay(isLoading: boolean, minMs = 250): boolean {
  const [showSkeleton, setShowSkeleton] = useState(isLoading);
  const loadStartRef = useRef<number>(isLoading ? Date.now() : 0);

  useEffect(() => {
    if (isLoading) {
      loadStartRef.current = Date.now();
      setShowSkeleton(true);
    } else if (loadStartRef.current > 0) {
      const elapsed = Date.now() - loadStartRef.current;
      const remaining = minMs - elapsed;
      if (remaining <= 0) {
        setShowSkeleton(false);
        loadStartRef.current = 0;
      } else {
        const t = setTimeout(() => {
          setShowSkeleton(false);
          loadStartRef.current = 0;
        }, remaining);
        return () => clearTimeout(t);
      }
    }
  }, [isLoading, minMs]);

  return showSkeleton;
}
