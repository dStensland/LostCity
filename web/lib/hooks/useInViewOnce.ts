"use client";

import { useEffect, useRef, useState } from "react";

interface Options {
  rootMargin?: string;
  threshold?: number;
}

export function useInViewOnce<T extends HTMLElement = HTMLDivElement>(
  { rootMargin = "0px 0px -10% 0px", threshold = 0.15 }: Options = {},
) {
  const ref = useRef<T | null>(null);
  // Lazy-init handles the legacy/SSR fallback where IntersectionObserver is
  // unavailable — revealing immediately is the safer default. This avoids a
  // synchronous setState in the effect body (flagged by react-hooks rules).
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;

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
    return () => observer.disconnect();
  }, [inView, rootMargin, threshold]);

  return { ref, inView };
}
