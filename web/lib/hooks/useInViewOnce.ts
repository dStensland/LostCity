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
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

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
