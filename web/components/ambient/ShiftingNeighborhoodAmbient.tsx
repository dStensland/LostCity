"use client";

import { useMemo } from "react";
import type { PortalAmbientConfig } from "@/lib/portal-context";

interface ShiftingNeighborhoodAmbientProps {
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
 * Shifting Neighborhood Ambient Effect
 * Abstract cityscape with geometric building shapes that slide and rearrange.
 * 15-20 simple rectangular/triangular SVG shapes with staggered horizontal translations.
 */
export default function ShiftingNeighborhoodAmbient({ config }: ShiftingNeighborhoodAmbientProps) {
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

  // Intensity affects opacity
  const opacity = useMemo(() => {
    switch (config.intensity) {
      case "subtle":
        return 0.03;
      case "bold":
        return 0.08;
      default:
        return 0.05;
    }
  }, [config.intensity]);

  // Pastel color palette
  const colors = useMemo(() => {
    const primary = config.colors?.primary;
    const secondary = config.colors?.secondary;

    // Default to soft pastels if no colors provided
    if (primary && secondary) {
      return [primary, secondary, "#F5E6D3", "#D4E4F7", "#E8F5D4"];
    }
    return ["#FFF4B8", "#D4F5E4", "#D4E4F7", "#F5E6D3", "#E8F5D4"];
  }, [config.colors]);

  // Generate buildings with deterministic properties
  const buildings = useMemo(() => {
    const random = seededRandom(789);
    const buildingCount = 18;

    return Array.from({ length: buildingCount }, (_, i) => {
      const isTriangle = random() > 0.7;
      const width = 40 + random() * 80;
      const height = 60 + random() * 120;
      const left = random() * 100;
      const bottom = random() * 30;
      const duration = (20 + random() * 40) * speedMultiplier;
      const delay = random() * -30;
      const distance = 30 + random() * 70;
      const color = colors[Math.floor(random() * colors.length)];

      return {
        id: i,
        isTriangle,
        width,
        height,
        left,
        bottom,
        duration,
        delay,
        distance,
        color,
      };
    });
  }, [colors, speedMultiplier]);

  return (
    <div
      className="ambient-layer fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {buildings.map((building) => (
          <g
            key={building.id}
            style={{
              animation: `shift-building ${building.duration}s ease-in-out infinite`,
              animationDelay: `${building.delay}s`,
              transformOrigin: "center",
            }}
          >
            {building.isTriangle ? (
              <polygon
                points={`${building.left},${100 - building.bottom} ${building.left + building.width / 2},${100 - building.bottom - building.height} ${building.left + building.width},${100 - building.bottom}`}
                fill={building.color}
                opacity={opacity}
              />
            ) : (
              <rect
                x={`${building.left}%`}
                y={`${100 - building.bottom - building.height}%`}
                width={building.width}
                height={building.height}
                fill={building.color}
                opacity={opacity}
              />
            )}
          </g>
        ))}
      </svg>

      {/* Keyframes injected via style tag */}
      <style>{`
        @keyframes shift-building {
          0%, 100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(15px);
          }
          50% {
            transform: translateX(-8px);
          }
          75% {
            transform: translateX(10px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          svg g {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
