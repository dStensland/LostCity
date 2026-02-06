"use client";

import { useMemo, useId } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import type { PortalAmbientConfig } from "@/lib/portal-context";

interface GrowingGardenAmbientProps {
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

type PlantShape = "circle" | "blob" | "leaf" | "petal";

/**
 * Growing Garden Ambient Effect
 * Botanical shapes that grow, bloom, and fade in continuous cycles.
 * 12-15 elements with staggered animations for continuous motion.
 */
export default function GrowingGardenAmbient({ config }: GrowingGardenAmbientProps) {
  // Animation speed multiplier
  const speedMultiplier = useMemo(() => {
    switch (config.animation_speed) {
      case "slow":
        return 1.5;
      case "fast":
        return 0.6;
      default:
        return 1;
    }
  }, [config.animation_speed]);

  // Intensity affects opacity
  const opacity = useMemo(() => {
    switch (config.intensity) {
      case "subtle":
        return 0.12;
      case "bold":
        return 0.3;
      default:
        return 0.2;
    }
  }, [config.intensity]);

  // Garden color palette
  const colors = useMemo(() => {
    const primary = config.colors?.primary;
    const secondary = config.colors?.secondary;

    if (primary && secondary) {
      return [primary, secondary, "#E8F5D4", "#FFD4C4"];
    }
    return ["#A8D8B9", "#FFF4B8", "#E8F5D4", "#FFD4C4", "#D4F5E4"];
  }, [config.colors]);

  // Generate garden elements
  const plants = useMemo(() => {
    const random = seededRandom(654);
    const plantCount = 14;

    const shapes: PlantShape[] = ["circle", "blob", "leaf", "petal"];

    return Array.from({ length: plantCount }, (_, i) => {
      const shape = shapes[Math.floor(random() * shapes.length)];
      const size = 30 + random() * 80;
      const x = random() * 100;
      const y = random() * 100;
      const color = colors[Math.floor(random() * colors.length)];

      // Each plant has: emerge (3s) → bloom (50s) → fade (5s)
      const totalCycleDuration = (3 + 50 + 5) * speedMultiplier;
      const delay = (random() * totalCycleDuration) * -1; // Stagger start times
      const rotation = random() * 360;

      // Generate organic blob path
      const blobPath = generateBlobPath(size / 2, random);

      return {
        id: i,
        shape,
        size,
        x,
        y,
        color,
        duration: totalCycleDuration,
        delay,
        rotation,
        blobPath,
      };
    });
  }, [colors, speedMultiplier]);

  const rawId = useId();
  const instanceClass = `growing-garden-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const plantRules = plants
    .map(
      (plant) => `.${instanceClass} .plant-${plant.id} { animation-duration: ${plant.duration}s; animation-delay: ${plant.delay}s; }`
    )
    .join("\n");
  const css = `
    .${instanceClass} .plant-group {
      animation-name: bloom-cycle;
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
      transform-origin: center;
    }
    ${plantRules}
    @keyframes bloom-cycle {
      0% {
        transform: scale(0) rotate(0deg);
        opacity: 0;
      }
      5% {
        transform: scale(1) rotate(${5 * speedMultiplier}deg);
        opacity: ${opacity};
      }
      48% {
        transform: scale(1.05) rotate(${-3 * speedMultiplier}deg);
        opacity: ${opacity};
      }
      91% {
        transform: scale(1) rotate(${2 * speedMultiplier}deg);
        opacity: ${opacity};
      }
      100% {
        transform: scale(0) rotate(${10 * speedMultiplier}deg);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .${instanceClass} .plant-group {
        animation: none !important;
        opacity: ${opacity * 0.5} !important;
        transform: scale(1) !important;
      }
    }
  `;

  return (
    <div
      className={`ambient-layer fixed inset-0 pointer-events-none z-0 overflow-hidden ${instanceClass}`}
      aria-hidden="true"
    >
      <ScopedStyles css={css} />
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {plants.map((plant) => (
          <g
            key={plant.id}
            transform={`translate(${plant.x}%, ${plant.y}%) rotate(${plant.rotation})`}
            className={`plant-group plant-${plant.id}`}
          >
            {plant.shape === "circle" && (
              <circle
                cx="0"
                cy="0"
                r={plant.size / 2}
                fill={plant.color}
                opacity={opacity}
              />
            )}
            {plant.shape === "blob" && (
              <path
                d={plant.blobPath}
                fill={plant.color}
                opacity={opacity}
              />
            )}
            {plant.shape === "leaf" && (
              <ellipse
                cx="0"
                cy="0"
                rx={plant.size / 2}
                ry={plant.size / 3}
                fill={plant.color}
                opacity={opacity}
              />
            )}
            {plant.shape === "petal" && (
              <g>
                {[0, 72, 144, 216, 288].map((angle, idx) => (
                  <ellipse
                    key={idx}
                    cx="0"
                    cy="0"
                    rx={plant.size / 4}
                    ry={plant.size / 2.5}
                    fill={plant.color}
                    opacity={opacity}
                    transform={`rotate(${angle}) translate(${plant.size / 4}, 0)`}
                  />
                ))}
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * Generate an organic blob path using bezier curves
 */
function generateBlobPath(radius: number, random: () => number): string {
  const points = 6;
  const angleStep = (Math.PI * 2) / points;

  let path = "";

  for (let i = 0; i < points; i++) {
    const angle = i * angleStep;
    const nextAngle = ((i + 1) % points) * angleStep;

    // Add some randomness to radius
    const r = radius * (0.8 + random() * 0.4);
    const nextR = radius * (0.8 + random() * 0.4);

    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    const nextX = Math.cos(nextAngle) * nextR;
    const nextY = Math.sin(nextAngle) * nextR;

    // Control points for smooth curves
    const cp1x = x + Math.cos(angle + angleStep / 3) * r * 0.5;
    const cp1y = y + Math.sin(angle + angleStep / 3) * r * 0.5;
    const cp2x = nextX - Math.cos(nextAngle - angleStep / 3) * nextR * 0.5;
    const cp2y = nextY - Math.sin(nextAngle - angleStep / 3) * nextR * 0.5;

    if (i === 0) {
      path = `M ${x} ${y}`;
    }
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${nextX} ${nextY}`;
  }

  path += " Z";
  return path;
}
