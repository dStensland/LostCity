"use client";

import { useEffect, useState } from "react";

/**
 * Returns the current offsetTop of the visual viewport.
 *
 * iOS Safari: when software keyboard opens, the viewport scrolls up and
 *   `visualViewport.offsetTop` grows. Subtract this from the overlay's
 *   max-height to keep the input visible.
 *
 * Android Chrome: uses `resize-visual` mode by default, so `100dvh` already
 *   tracks the shrunk viewport. `offsetTop` stays ~0 but the hook still works
 *   as a fallback for the rare `resize-none` configuration.
 *
 * Never use `window.innerHeight` for mobile keyboard handling — unreliable
 * on iOS when the keyboard is open.
 */
export function useVisualViewportHeight(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function handleResize() {
      setOffset(vv!.offsetTop);
    }

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  return offset;
}
