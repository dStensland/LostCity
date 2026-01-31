"use client";

import { useMemo } from "react";
import type { PortalAmbientConfig } from "@/lib/portal-context";

interface FlowingStreetsAmbientProps {
  config: Partial<PortalAmbientConfig>;
}

/**
 * Deterministic pseudo-random number generator (seeded)
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Flowing Streets Ambient Effect
 * Organic flowing lines like Atlanta's winding streets.
 * 5-7 SVG path elements with bezier curves and gentle wave animations.
 */
export default function FlowingStreetsAmbient({ config }: FlowingStreetsAmbientProps) {
  // Animation speed multiplier
  const speedMultiplier = useMemo(() => {
    switch (config.animation_speed) {
      case "slow":
        return 2;
      case "fast":
        return 0.5;
      default:
        return 1;
    }
  }, [config.animation_speed]);

  // Intensity affects opacity and stroke width
  const { opacity, strokeWidth } = useMemo(() => {
    switch (config.intensity) {
      case "subtle":
        return { opacity: 0.15, strokeWidth: 1.5 };
      case "bold":
        return { opacity: 0.35, strokeWidth: 3 };
      default:
        return { opacity: 0.25, strokeWidth: 2 };
    }
  }, [config.intensity]);

  // Generate flowing paths
  const paths = useMemo(() => {
    const random = seededRandom(321);
    const pathCount = 6;

    return Array.from({ length: pathCount }, (_, i) => {
      // Generate organic bezier curves
      const startX = random() * 30;
      const startY = random() * 100;

      // Create a winding path with multiple curves
      const segments = 3 + Math.floor(random() * 3);
      let pathData = `M ${startX} ${startY}`;

      let currentX = startX;
      let currentY = startY;

      for (let s = 0; s < segments; s++) {
        const cp1x = currentX + 15 + random() * 30;
        const cp1y = currentY + (random() - 0.5) * 40;
        const cp2x = cp1x + 10 + random() * 20;
        const cp2y = cp1y + (random() - 0.5) * 40;
        const endX = cp2x + 15 + random() * 25;
        const endY = cp2y + (random() - 0.5) * 30;

        pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

        currentX = endX;
        currentY = endY;
      }

      // Gradient colors
      const gradientId = `street-gradient-${i}`;
      const colors = config.colors?.primary && config.colors?.secondary
        ? [config.colors.primary, config.colors.secondary]
        : ["#FFF4B8", "#A8D8B9", "#A8C4F7"];

      return {
        id: i,
        pathData,
        duration: (40 + random() * 40) * speedMultiplier,
        delay: random() * -50,
        gradientId,
        gradientColors: [
          colors[Math.floor(random() * colors.length)],
          colors[Math.floor(random() * colors.length)],
          colors[Math.floor(random() * colors.length)],
        ],
      };
    });
  }, [config.colors, speedMultiplier]);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {paths.map((path) => (
            <linearGradient
              key={path.gradientId}
              id={path.gradientId}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={path.gradientColors[0]} stopOpacity={opacity} />
              <stop offset="50%" stopColor={path.gradientColors[1]} stopOpacity={opacity} />
              <stop offset="100%" stopColor={path.gradientColors[2]} stopOpacity={opacity} />
            </linearGradient>
          ))}
        </defs>

        {paths.map((path) => (
          <path
            key={path.id}
            d={path.pathData}
            fill="none"
            stroke={`url(#${path.gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{
              animation: `flow-wave ${path.duration}s ease-in-out infinite`,
              animationDelay: `${path.delay}s`,
              transformOrigin: "center",
            }}
          />
        ))}
      </svg>

      {/* Keyframes injected via style tag */}
      <style>{`
        @keyframes flow-wave {
          0%, 100% {
            transform: translateY(0) translateX(0) scale(1);
            opacity: ${opacity};
          }
          25% {
            transform: translateY(${-5 * speedMultiplier}px) translateX(${3 * speedMultiplier}px) scale(1.02);
            opacity: ${opacity * 0.8};
          }
          50% {
            transform: translateY(${2 * speedMultiplier}px) translateX(${-2 * speedMultiplier}px) scale(0.98);
            opacity: ${opacity * 1.1};
          }
          75% {
            transform: translateY(${-3 * speedMultiplier}px) translateX(${2 * speedMultiplier}px) scale(1.01);
            opacity: ${opacity * 0.9};
          }
        }

        @media (prefers-reduced-motion: reduce) {
          svg path {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
