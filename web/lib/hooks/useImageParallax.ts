"use client";

import { useRef, useEffect } from "react";

/**
 * Lightweight mouse-tracking parallax hook for card image panels.
 * Follows the CursorGlow pattern: direct DOM manipulation via refs,
 * no React re-renders per frame.
 *
 * Usage:
 *   const { containerRef, imageRef } = useImageParallax();
 *   <div ref={containerRef}> ... <div ref={imageRef}><Image /><gradient /></div> ... </div>
 */
export function useImageParallax<
  TContainer extends HTMLElement = HTMLDivElement,
  TImage extends HTMLElement = HTMLDivElement
>() {
  const containerRef = useRef<TContainer>(null);
  const imageRef = useRef<TImage>(null);

  useEffect(() => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;

    // Respect reduced motion preference
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const MAX_OFFSET = 6; // px — subtle but perceptible
    const BASE_SCALE = 1.03;
    const HOVER_SCALE = 1.08;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      // Normalized position from center: -1 to 1
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

      // Move image opposite to cursor direction for depth illusion
      const tx = -nx * MAX_OFFSET;
      const ty = -ny * MAX_OFFSET;

      image.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${HOVER_SCALE})`;
    };

    const handleMouseLeave = () => {
      image.style.transform = `translate3d(0, 0, 0) scale(${BASE_SCALE})`;
    };

    // Set initial transform and transition
    image.style.transition = "transform 300ms ease";
    image.style.transform = `translate3d(0, 0, 0) scale(${BASE_SCALE})`;

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    // Clean up if reduced motion changes
    const handleMotionChange = () => {
      if (mq.matches) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", handleMouseLeave);
        image.style.transform = "";
        image.style.transition = "";
      }
    };
    mq.addEventListener("change", handleMotionChange);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      mq.removeEventListener("change", handleMotionChange);
    };
  }, []);

  return { containerRef, imageRef };
}
