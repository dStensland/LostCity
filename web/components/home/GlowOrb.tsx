"use client";

import { useEffect, useState, useId } from "react";
import ScopedStyles from "@/components/ScopedStyles";

interface GlowOrbProps {
  color?: "cyan" | "pink" | "purple";
  size?: number;
  className?: string;
  /** Position from top in vh */
  top?: number;
  /** Position from left in % */
  left?: number;
  /** Blur amount in px */
  blur?: number;
  /** Pulse animation */
  pulse?: boolean;
}

/**
 * Ambient glow orb that adds atmospheric lighting
 * Subtly moves with scroll for depth
 */
export default function GlowOrb({
  color = "cyan",
  size = 300,
  className = "",
  top = 50,
  left = 50,
  blur = 100,
  pulse = true,
}: GlowOrbProps) {
  const [offset, setOffset] = useState(0);
  const rawId = useId();
  const instanceClass = `glow-orb-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrolled = window.scrollY;
          setOffset(scrolled * 0.05);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const colors = {
    cyan: "rgba(0, 229, 255, 0.15)",
    pink: "rgba(255, 107, 157, 0.15)",
    purple: "rgba(176, 107, 255, 0.12)",
  };

  const css = `
    .${instanceClass} {
      top: calc(${top}vh + ${offset}px);
      left: ${left}%;
      width: ${size}px;
      height: ${size}px;
      background: radial-gradient(circle, ${colors[color]} 0%, transparent 70%);
      filter: blur(${blur}px);
      transform: translate(-50%, -50%);
      animation: ${pulse ? "glow-pulse 8s ease-in-out infinite" : "none"};
    }
  `;

  return (
    <>
      <ScopedStyles css={css} />
      <div className={`fixed pointer-events-none z-0 ${instanceClass} ${className}`} />
    </>
  );
}
