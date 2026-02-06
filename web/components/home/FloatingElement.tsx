"use client";

import { useEffect, useMemo, useRef, useState, useId, ReactNode } from "react";
import ScopedStyles from "@/components/ScopedStyles";

interface FloatingElementProps {
  children: ReactNode;
  className?: string;
  /** Parallax speed multiplier (negative = moves opposite to scroll) */
  speed?: number;
  /** Horizontal drift amount in pixels */
  drift?: number;
  /** Whether to fade as it scrolls */
  fade?: boolean;
  /** Scale effect (0 = no scale, positive = shrink on scroll) */
  scale?: number;
}

/**
 * Creates a floating parallax effect on scroll
 * Elements move at different speeds to create depth
 */
export default function FloatingElement({
  children,
  className = "",
  speed = 0.1,
  drift = 0,
  fade = false,
  scale = 0,
}: FloatingElementProps) {
  const ref = useRef<HTMLDivElement>(null);
  const stepCount = 20;
  const centerStep = Math.round(stepCount / 2);
  const [step, setStep] = useState(centerStep);
  const rawId = useId();
  const instanceClass = `floating-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const css = useMemo(() => {
    const rules = [
      `.${instanceClass} { will-change: transform, opacity; transition: transform 0.1s ease-out, opacity 0.1s ease-out; }`,
    ];
    for (let i = 0; i <= stepCount; i += 1) {
      const fromCenter = (i / stepCount) * 2 - 1;
      const y = fromCenter * speed * 100;
      const x = drift ? Math.sin(fromCenter * Math.PI) * drift : 0;
      const opacity = fade ? Math.max(0.3, 1 - Math.abs(fromCenter) * 0.5) : 1;
      const scaleValue = scale ? 1 - Math.abs(fromCenter) * scale : 1;
      rules.push(
        `.${instanceClass}-step-${i} { transform: translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scaleValue.toFixed(3)}); opacity: ${opacity.toFixed(3)}; }`
      );
    }
    return rules.join("\n");
  }, [instanceClass, stepCount, speed, drift, fade, scale]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check for reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const rect = element.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const elementCenter = rect.top + rect.height / 2;

          // Calculate how far from viewport center (normalized -1 to 1)
          const fromCenter = (elementCenter - viewportHeight / 2) / (viewportHeight / 2);
          const clamped = Math.max(-1, Math.min(1, fromCenter));
          const nextStep = Math.round(((clamped + 1) / 2) * stepCount);

          setStep(nextStep);
          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [speed, drift, fade, scale]);

  return (
    <>
      <ScopedStyles css={css} />
      <div
        ref={ref}
        className={`${instanceClass} ${instanceClass}-step-${step} ${className}`}
      >
        {children}
      </div>
    </>
  );
}
