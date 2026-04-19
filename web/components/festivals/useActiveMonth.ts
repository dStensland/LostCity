"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks which month section is "active" based on scroll position.
 * A section is active when its top is in the viewport's upper 30% band.
 * Multiple sections may intersect; the one highest up (closest to top) wins.
 */
export function useActiveMonth(monthKeys: string[]): string | null {
  const [active, setActive] = useState<string | null>(monthKeys[0] ?? null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sections = monthKeys
      .map((key) => document.getElementById(`month-${key}`))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (raf.current) cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(() => {
          // Pick the visible section closest to the top of the viewport.
          let best: { key: string; top: number } | null = null;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const key = entry.target.id.replace(/^month-/, "");
            const top = entry.boundingClientRect.top;
            if (!best || Math.abs(top) < Math.abs(best.top)) {
              best = { key, top };
            }
          }
          if (best) setActive(best.key);
        });
      },
      { rootMargin: "-40px 0px -70% 0px" },
    );

    sections.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [monthKeys.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return active;
}
