"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type ScrollRevealOptions = {
  /** Threshold for intersection (0-1), default 0.1 */
  threshold?: number;
  /** Root margin for earlier/later trigger, default "0px 0px -50px 0px" */
  rootMargin?: string;
  /** Only trigger once (default true) */
  triggerOnce?: boolean;
  /** Delay before revealing in ms (for stagger effects) */
  delay?: number;
};

/**
 * Hook for scroll-triggered reveal animations using Intersection Observer.
 * Respects prefers-reduced-motion preference.
 *
 * @example
 * const { ref, isVisible } = useScrollReveal();
 * return <div ref={ref} className={isVisible ? 'opacity-100' : 'opacity-0'}>...</div>
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: ScrollRevealOptions = {}
) {
  const {
    threshold = 0.1,
    rootMargin = "0px 0px -50px 0px",
    triggerOnce = true,
    delay = 0,
  } = options;

  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial sync with browser API
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    // If reduced motion is preferred, show immediately
    if (prefersReducedMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Accessibility: skip animation for reduced motion
      setIsVisible(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (delay > 0) {
              setTimeout(() => setIsVisible(true), delay);
            } else {
              setIsVisible(true);
            }

            if (triggerOnce) {
              observer.unobserve(entry.target);
            }
          } else if (!triggerOnce) {
            setIsVisible(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce, delay, prefersReducedMotion]);

  return { ref, isVisible, prefersReducedMotion };
}

/**
 * Hook for staggered reveal of multiple items.
 * Returns a function to get delay for each index.
 *
 * @example
 * const { getDelay, baseDelay } = useStaggerReveal(items.length);
 * items.map((item, i) => <Card delay={getDelay(i)} />)
 */
export function useStaggerReveal(
  itemCount: number,
  options: { baseDelay?: number; staggerMs?: number; maxDelay?: number } = {}
) {
  const { baseDelay = 0, staggerMs = 50, maxDelay = 500 } = options;

  const getDelay = useCallback(
    (index: number) => {
      const delay = baseDelay + index * staggerMs;
      return Math.min(delay, maxDelay);
    },
    [baseDelay, staggerMs, maxDelay]
  );

  return { getDelay, baseDelay, staggerMs };
}

/**
 * CSS classes for scroll reveal animations.
 * Use with useScrollReveal hook.
 */
export const scrollRevealClasses = {
  /** Base hidden state */
  hidden: "opacity-0 translate-y-4",
  /** Visible state */
  visible: "opacity-100 translate-y-0",
  /** Transition classes */
  transition: "transition-all duration-500 ease-out",
  /** Combined: apply to element, toggle visible/hidden based on isVisible */
  base: "transition-all duration-500 ease-out",
} as const;

export default useScrollReveal;
