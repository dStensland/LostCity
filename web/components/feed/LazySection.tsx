"use client";

/**
 * LazySection — defers rendering of below-fold feed sections until
 * they're within rootMargin of the viewport. Reduces initial DOM size.
 *
 * Uses a CSS opacity transition instead of hard-swapping DOM nodes,
 * preventing layout shift when content arrives.
 */

import { useRef, useState, useEffect, type ReactNode } from "react";

interface LazySectionProps {
  children: ReactNode;
  /** Vertical margin to trigger before section is visible. Default 200px. */
  rootMargin?: string;
  /** Minimum height for the placeholder to prevent layout shift. */
  minHeight?: number;
}

export default function LazySection({
  children,
  rootMargin = "200px",
  minHeight = 100,
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasTransitioned, setHasTransitioned] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  // After the fade-in transition completes, drop the minHeight so the
  // container can shrink to its natural size (e.g. when child returns null).
  useEffect(() => {
    if (!isVisible) return;
    const t = setTimeout(() => setHasTransitioned(true), 500);
    return () => clearTimeout(t);
  }, [isVisible]);

  return (
    <div
      ref={ref}
      className=""
      style={{
        minHeight: hasTransitioned ? undefined : minHeight,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
      }}
    >
      {isVisible ? children : null}
    </div>
  );
}
