"use client";

import { useEffect, useRef, useState } from "react";

interface Options {
  rootMargin?: string;
  threshold?: number;
  /**
   * Fallback delay (ms). If the observer hasn't fired by then, reveal anyway.
   * Guards against: throttled background tabs (IntersectionObserver pauses in
   * hidden tabs and can leave sections permanently invisible), slow initial
   * render on mobile, and observer edge cases around tall sections that never
   * cross the threshold without extra scroll.
   */
  fallbackDelay?: number;
}

export function useInViewOnce<T extends HTMLElement = HTMLDivElement>(
  {
    // Pre-reveal 120px before the element enters the viewport + 0 threshold.
    // The previous default (-10% bottom + 0.15 threshold) left tall sections
    // invisible until they were roughly half-scrolled into view, producing
    // the viewport-height blank gaps flagged in the 2026-04-16 feed audit.
    rootMargin = "0px 0px 120px 0px",
    threshold = 0,
    fallbackDelay = 800,
  }: Options = {},
) {
  const ref = useRef<T | null>(null);
  // Lazy-init handles the legacy/SSR fallback where IntersectionObserver is
  // unavailable — revealing immediately is the safer default. This avoids a
  // synchronous setState in the effect body (flagged by react-hooks rules).
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;

    // IntersectionObserver fires immediately on observe() if the target is
    // already intersecting — no manual getBoundingClientRect pre-check needed
    // (and that pre-check's setState would violate react-hooks/set-state-in-
    // effect). The fallback timer below still protects against hidden-tab
    // throttling where the observer callback is deferred.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin, threshold },
    );
    observer.observe(node);

    const fallback = window.setTimeout(() => {
      setInView(true);
      observer.disconnect();
    }, fallbackDelay);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [inView, rootMargin, threshold, fallbackDelay]);

  return { ref, inView };
}
