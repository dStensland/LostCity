"use client";

import { useMemo, useId } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import type { PortalAmbientConfig } from "@/lib/portal-context";

interface FloatingLeavesAmbientProps {
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
 * Floating Leaves Ambient Effect
 *
 * Gentle floating leaves that drift across the screen.
 * Designed for family-friendly portals with warm autumn colors.
 * Very subtle and non-distracting.
 */
export default function FloatingLeavesAmbient({ config }: FloatingLeavesAmbientProps) {
  // Leaf colors - warm autumn palette
  const leafColors = useMemo(() => {
    const primary = config.colors?.primary || "#7CB77C";
    const secondary = config.colors?.secondary || "#E8956A";
    return [
      primary,           // Green
      secondary,         // Peachy orange
      "#C4956C",         // Tan
      "#D4A574",         // Light brown
      "#9DBF9D",         // Sage green
    ];
  }, [config.colors]);

  // Animation speed
  const speedMultiplier = useMemo(() => {
    switch (config.animation_speed) {
      case "slow": return 1.5;
      case "fast": return 0.6;
      default: return 1;
    }
  }, [config.animation_speed]);

  // Intensity affects opacity and count
  const { opacity, leafCount } = useMemo(() => {
    switch (config.intensity) {
      case "subtle": return { opacity: 0.2, leafCount: 10 };
      case "bold": return { opacity: 0.45, leafCount: 18 };
      default: return { opacity: 0.3, leafCount: 14 };
    }
  }, [config.intensity]);

  // Generate leaves with deterministic properties - positioned around edges
  const leaves = useMemo(() => {
    const random = seededRandom(777);

    return Array.from({ length: leafCount }, (_, i) => {
      const isLarge = random() > 0.75;
      const size = isLarge ? 28 + random() * 18 : 14 + random() * 10;

      // Determine zone: corners, top, sides, bottom
      const zone = random();
      let x: number, y: number;

      if (zone < 0.25) {
        // Top corners
        x = random() > 0.5 ? random() * 15 : 85 + random() * 15;
        y = random() * 15;
      } else if (zone < 0.5) {
        // Left/right sides
        x = random() > 0.5 ? random() * 8 : 92 + random() * 8;
        y = 20 + random() * 60;
      } else if (zone < 0.75) {
        // Bottom corners
        x = random() > 0.5 ? random() * 15 : 85 + random() * 15;
        y = 85 + random() * 15;
      } else {
        // Scattered top edge
        x = 15 + random() * 70;
        y = random() * 10;
      }

      return {
        id: i,
        x,
        y,
        size,
        rotation: random() * 360,
        color: leafColors[Math.floor(random() * leafColors.length)],
        duration: (35 + random() * 45) * speedMultiplier,
        delay: random() * -50,
        // Different leaf shapes
        shape: random() > 0.5 ? "rounded" : "pointed",
        // Drift direction - gentler movement
        driftX: (random() - 0.5) * 40,
        driftY: 15 + random() * 25,
        rotateAmount: (random() - 0.5) * 60,
      };
    });
  }, [leafCount, leafColors, speedMultiplier]);

  const rawId = useId();
  const instanceClass = `floating-leaves-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const leafRules = leaves
    .map(
      (leaf) => `.${instanceClass} .leaf-${leaf.id} { animation-duration: ${leaf.duration}s; animation-delay: ${leaf.delay}s; }`
    )
    .join("\n");
  const css = `
    .${instanceClass} .leaf-group {
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
    }
    .${instanceClass} .leaf-float-0 { animation-name: leaf-float-0; }
    .${instanceClass} .leaf-float-1 { animation-name: leaf-float-1; }
    .${instanceClass} .leaf-float-2 { animation-name: leaf-float-2; }
    ${leafRules}
    @keyframes leaf-float-0 {
      0%, 100% {
        transform: translate(0, 0) rotate(0deg);
        opacity: ${opacity};
      }
      25% {
        transform: translate(${12 * speedMultiplier}px, ${8 * speedMultiplier}px) rotate(10deg);
        opacity: ${opacity * 0.85};
      }
      50% {
        transform: translate(${-8 * speedMultiplier}px, ${18 * speedMultiplier}px) rotate(-8deg);
        opacity: ${opacity * 0.95};
      }
      75% {
        transform: translate(${4 * speedMultiplier}px, ${12 * speedMultiplier}px) rotate(6deg);
        opacity: ${opacity * 0.9};
      }
    }
    @keyframes leaf-float-1 {
      0%, 100% {
        transform: translate(0, 0) rotate(0deg);
        opacity: ${opacity * 0.9};
      }
      30% {
        transform: translate(${-15 * speedMultiplier}px, ${10 * speedMultiplier}px) rotate(-15deg);
        opacity: ${opacity};
      }
      60% {
        transform: translate(${8 * speedMultiplier}px, ${22 * speedMultiplier}px) rotate(10deg);
        opacity: ${opacity * 0.75};
      }
    }
    @keyframes leaf-float-2 {
      0%, 100% {
        transform: translate(0, 0) rotate(0deg);
        opacity: ${opacity * 0.85};
      }
      40% {
        transform: translate(${-10 * speedMultiplier}px, ${14 * speedMultiplier}px) rotate(-12deg);
        opacity: ${opacity * 0.95};
      }
      70% {
        transform: translate(${6 * speedMultiplier}px, ${20 * speedMultiplier}px) rotate(8deg);
        opacity: ${opacity * 0.8};
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .${instanceClass} .leaf-group {
        animation: none !important;
        opacity: ${opacity * 0.5} !important;
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
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Leaf shape definitions - more organic */}
          <path
            id="leaf-rounded"
            d="M0 -12 Q9 -9, 10 -2 Q10 5, 4 10 Q0 13, -4 10 Q-10 5, -10 -2 Q-9 -9, 0 -12 Z"
            filter="url(#leaf-blur)"
          />
          <path
            id="leaf-pointed"
            d="M0 -15 Q11 -6, 8 4 Q4 12, 0 15 Q-4 12, -8 4 Q-11 -6, 0 -15 Z"
            filter="url(#leaf-blur)"
          />
          {/* Subtle blur for softer edges */}
          <filter id="leaf-blur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.3" />
          </filter>
        </defs>

        {leaves.map((leaf) => (
          <g
            key={leaf.id}
            className={`leaf-group leaf-float-${leaf.id % 3} leaf-${leaf.id}`}
          >
            <g transform={`translate(${leaf.x}, ${leaf.y})`}>
              <g transform={`rotate(${leaf.rotation})`}>
                <use
                  href={leaf.shape === "rounded" ? "#leaf-rounded" : "#leaf-pointed"}
                  fill={leaf.color}
                  opacity={opacity}
                  width={leaf.size}
                  height={leaf.size}
                  x={-leaf.size / 2}
                  y={-leaf.size / 2}
                />
                {/* Subtle leaf vein for realism */}
                <line
                  x1="0"
                  y1={-leaf.size * 0.4}
                  x2="0"
                  y2={leaf.size * 0.4}
                  stroke={leaf.color}
                  strokeWidth="0.8"
                  opacity={opacity * 0.4}
                  filter="url(#leaf-blur)"
                />
              </g>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
