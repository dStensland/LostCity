"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Cursor glow effect - a subtle radial gradient that follows the cursor
 * Respects user preferences and reduced motion settings
 */
export default function CursorGlow() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const isVisibleRef = useRef(false);

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

    // Smooth animation loop
    const animate = () => {
      setPosition((prev) => ({
        x: prev.x + (targetRef.current.x - prev.x) * 0.15,
        y: prev.y + (targetRef.current.y - prev.y) * 0.15,
      }));
      rafRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
      // Only update state if visibility actually changes
      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        setIsVisible(true);
      }
    };

    const handleMouseLeave = () => {
      if (isVisibleRef.current) {
        isVisibleRef.current = false;
        setIsVisible(false);
      }
    };

    // Start animation loop
    rafRef.current = requestAnimationFrame(animate);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
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
        className="absolute w-[400px] h-[400px] rounded-full transition-opacity duration-300"
        style={{
          left: position.x - 200,
          top: position.y - 200,
          background: `radial-gradient(circle, rgba(255, 107, 122, 0.06) 0%, rgba(255, 107, 122, 0.02) 40%, transparent 70%)`,
          opacity: isVisible ? 1 : 0,
          filter: "blur(40px)",
        }}
      />
    </div>
  );
}
