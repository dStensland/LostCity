"use client";

import { useEffect, useRef, useState } from "react";

/** Check if the browser supports CSS scroll-driven animations */
const supportsScrollTimeline =
  typeof CSS !== "undefined" && CSS.supports("animation-timeline", "view()");

interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Hook to trigger reveal animations when element scrolls into view.
 * On browsers with animation-timeline support, returns a CSS class
 * and skips the IntersectionObserver (let CSS handle it).
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.1,
  rootMargin = "0px 0px -50px 0px",
  triggerOnce = true,
}: UseScrollRevealOptions = {}) {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(supportsScrollTimeline);

  useEffect(() => {
    // If CSS handles it, no JS observer needed
    if (supportsScrollTimeline) return;

    const element = ref.current;
    if (!element) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Accessibility: skip animation for reduced motion
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce]);

  return {
    ref,
    isVisible,
    /** Add this class to the element for CSS-native scroll reveal */
    cssRevealClass: supportsScrollTimeline ? "scroll-reveal" : "",
  };
}

/**
 * Utility classes for scroll reveal animations
 */
export const scrollRevealClasses = {
  hidden: "opacity-0 translate-y-4",
  visible: "opacity-100 translate-y-0",
  transition: "transition-all duration-500 ease-out",
};

/**
 * Get combined classes based on visibility state
 */
export function getScrollRevealClasses(isVisible: boolean, baseClasses: string = ""): string {
  return `${baseClasses} ${scrollRevealClasses.transition} ${
    isVisible ? scrollRevealClasses.visible : scrollRevealClasses.hidden
  }`;
}
