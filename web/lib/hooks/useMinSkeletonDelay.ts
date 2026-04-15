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
  // Initialize to 0; the useEffect below sets it to Date.now() on the first
  // isLoading=true render. Keeping Date.now() out of the initializer satisfies
  // react-hooks/purity — the ref is only read inside the effect, never during
  // render, so the brief render-to-effect gap where it's 0 is invisible.
  const loadStartRef = useRef<number>(0);

  /* eslint-disable react-hooks/set-state-in-effect --
     Minimum-skeleton-display coordinator: flips showSkeleton true when
     loading starts, false when elapsed >= minMs. Cascade bounded —
     showSkeleton is not in the dep array ([isLoading, minMs]). */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  return showSkeleton;
}
