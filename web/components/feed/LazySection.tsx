"use client";

/**
 * LazySection — defers rendering of below-fold feed sections until
 * they're within rootMargin of the viewport. Reduces initial DOM size.
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

  if (isVisible) {
    return <>{children}</>;
  }

  return (
    <div
      ref={ref}
      style={{ minHeight }}
      aria-hidden
    />
  );
}
