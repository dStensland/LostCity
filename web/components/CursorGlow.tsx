"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Cursor glow effect - a subtle radial gradient that follows the cursor
 * Optimized to only animate when cursor moves and page is visible
 * Respects user preferences and reduced motion settings
 * Uses direct DOM manipulation to avoid React re-renders on every animation frame
 */
export default function CursorGlow() {
  const [isVisible, setIsVisible] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef({ x: 0, y: 0 });
  const isVisibleRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const lastMoveTimeRef = useRef(0);
  const idleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration pattern
    setMounted(true);

    // Check settings
    const checkSettings = () => {
      try {
        const stored = localStorage.getItem("lostcity-visual-settings");
        if (stored) {
          const settings = JSON.parse(stored);
          setIsEnabled(settings.cursorGlowEnabled !== false && !settings.reducedMotion);
        }
      } catch {
        // ignore
      }
    };

    checkSettings();

    // Listen for settings changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "lostcity-visual-settings") {
        checkSettings();
      }
    };

    window.addEventListener("storage", handleStorage);

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (prefersReducedMotion.matches) {
      setIsEnabled(false);
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!mounted || !isEnabled) return;

    const IDLE_TIMEOUT = 100; // Stop animating after 100ms of no movement
    const THRESHOLD = 0.5; // Stop when within 0.5px of target

    // Smooth animation loop - only runs when needed
    const animate = () => {
      // Stop if page is hidden
      if (document.hidden) {
        isAnimatingRef.current = false;
        rafRef.current = null;
        return;
      }

      const current = currentPosRef.current;
      const target = targetRef.current;
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Stop animating if we're close enough to target
      if (distance < THRESHOLD) {
        current.x = target.x;
        current.y = target.y;
        // Direct DOM update - bypasses React render cycle
        if (glowRef.current) {
          const x = target.x - 200;
          const y = target.y - 200;
          if (!animationRef.current) {
            animationRef.current = glowRef.current.animate(
              [{ transform: `translate3d(${x}px, ${y}px, 0)` }],
              { duration: 0, fill: "forwards" }
            );
          } else {
            (animationRef.current.effect as KeyframeEffect)?.setKeyframes([
              { transform: `translate3d(${x}px, ${y}px, 0)` },
            ]);
            animationRef.current.play();
          }
        }
        isAnimatingRef.current = false;
        rafRef.current = null;
        return;
      }

      // Smooth interpolation
      current.x += dx * 0.15;
      current.y += dy * 0.15;
      // Direct DOM update - bypasses React render cycle
      if (glowRef.current) {
        const x = current.x - 200;
        const y = current.y - 200;
        if (!animationRef.current) {
          animationRef.current = glowRef.current.animate(
            [{ transform: `translate3d(${x}px, ${y}px, 0)` }],
            { duration: 0, fill: "forwards" }
          );
        } else {
          (animationRef.current.effect as KeyframeEffect)?.setKeyframes([
            { transform: `translate3d(${x}px, ${y}px, 0)` },
          ]);
          animationRef.current.play();
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    const startAnimating = () => {
      if (!isAnimatingRef.current && !document.hidden) {
        isAnimatingRef.current = true;
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      lastMoveTimeRef.current = now;

      targetRef.current = { x: e.clientX, y: e.clientY };

      // Show cursor glow
      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        setIsVisible(true);
      }

      // Start animation if not already running
      startAnimating();

      // Clear existing idle timeout
      if (idleTimeoutRef.current !== null) {
        clearTimeout(idleTimeoutRef.current);
      }

      // Set timeout to stop animating when idle
      idleTimeoutRef.current = window.setTimeout(() => {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          isAnimatingRef.current = false;
        }
      }, IDLE_TIMEOUT);
    };

    const handleMouseLeave = () => {
      if (isVisibleRef.current) {
        isVisibleRef.current = false;
        setIsVisible(false);
      }

      // Stop animation
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        isAnimatingRef.current = false;
      }

      if (idleTimeoutRef.current !== null) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
    };

    // Pause animation when tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          isAnimatingRef.current = false;
        }
      } else if (isVisibleRef.current) {
        // Resume animation when tab becomes visible and cursor is over page
        startAnimating();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (animationRef.current) {
        animationRef.current.cancel();
      }
      if (idleTimeoutRef.current !== null) {
        clearTimeout(idleTimeoutRef.current);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mounted, isEnabled]);

  // Don't render on touch devices or if disabled
  if (!mounted || !isEnabled) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden"
      aria-hidden="true"
    >
      <div
        ref={glowRef}
        className={`absolute w-[400px] h-[400px] rounded-full transition-opacity duration-300 cursor-glow ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
