"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Adds a pointer-following glow effect to a card element.
 * Injects --glow-x and --glow-y CSS variables on pointermove.
 * Pair with .pointer-glow CSS class on the element.
 */
export function usePointerGlow<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
  }, []);

  const handlePointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty("--glow-x");
    el.style.removeProperty("--glow-y");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [handlePointerMove, handlePointerLeave]);

  return ref;
}
