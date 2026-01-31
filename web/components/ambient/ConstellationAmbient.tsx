"use client";

import { useMemo } from "react";
import type { PortalAmbientConfig } from "@/lib/portal-context";

interface ConstellationAmbientProps {
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
 * Constellation Connections Ambient Effect
 * Dots connected by lines that fade in/out, resembling venue locations.
 * 30-40 fixed-position dots with lines connecting nearby dots.
 */
export default function ConstellationAmbient({ config }: ConstellationAmbientProps) {
  const dotColor = config.colors?.primary || "#FFA959";
  const lineColor = config.colors?.secondary || "#A8D8B9";

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
  const { dotOpacity, lineOpacity } = useMemo(() => {
    switch (config.intensity) {
      case "subtle":
        return { dotOpacity: 0.3, lineOpacity: 0.1 };
      case "bold":
        return { dotOpacity: 0.8, lineOpacity: 0.3 };
      default:
        return { dotOpacity: 0.5, lineOpacity: 0.2 };
    }
  }, [config.intensity]);

  // Generate dots and connections
  const { dots, lines } = useMemo(() => {
    const random = seededRandom(456);
    const dotCount = 35;
    const connectionDistance = 200;

    // Generate dots
    const generatedDots = Array.from({ length: dotCount }, (_, i) => ({
      id: i,
      x: random() * 100,
      y: random() * 100,
      size: 2 + random() * 3,
      pulseDuration: (2 + random() * 3) * speedMultiplier,
      pulseDelay: random() * -5,
    }));

    // Generate connections between nearby dots
    const generatedLines = [];
    for (let i = 0; i < generatedDots.length; i++) {
      for (let j = i + 1; j < generatedDots.length; j++) {
        const dot1 = generatedDots[i];
        const dot2 = generatedDots[j];

        // Calculate distance (rough approximation for viewport percentage)
        const dx = dot2.x - dot1.x;
        const dy = dot2.y - dot1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only connect if within threshold
        if (distance < connectionDistance / 10) {
          generatedLines.push({
            id: `${i}-${j}`,
            x1: dot1.x,
            y1: dot1.y,
            x2: dot2.x,
            y2: dot2.y,
            duration: (10 + random() * 10) * speedMultiplier,
            delay: random() * -20,
          });
        }
      }
    }

    return { dots: generatedDots, lines: generatedLines };
  }, [speedMultiplier]);

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
          <filter id="constellation-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection lines */}
        <g>
          {lines.map((line) => (
            <line
              key={line.id}
              x1={`${line.x1}%`}
              y1={`${line.y1}%`}
              x2={`${line.x2}%`}
              y2={`${line.y2}%`}
              stroke={lineColor}
              strokeWidth="1"
              opacity={lineOpacity}
              style={{
                animation: `fade-line ${line.duration}s ease-in-out infinite`,
                animationDelay: `${line.delay}s`,
              }}
            />
          ))}
        </g>

        {/* Dots */}
        <g filter="url(#constellation-glow)">
          {dots.map((dot) => (
            <circle
              key={dot.id}
              cx={`${dot.x}%`}
              cy={`${dot.y}%`}
              r={dot.size}
              fill={dotColor}
              opacity={dotOpacity}
              style={{
                animation: `pulse-dot ${dot.pulseDuration}s ease-in-out infinite`,
                animationDelay: `${dot.pulseDelay}s`,
              }}
            />
          ))}
        </g>
      </svg>

      {/* Keyframes injected via style tag */}
      <style>{`
        @keyframes fade-line {
          0%, 100% {
            opacity: ${lineOpacity * 0.3};
          }
          50% {
            opacity: ${lineOpacity};
          }
        }

        @keyframes pulse-dot {
          0%, 100% {
            opacity: ${dotOpacity * 0.6};
            transform: scale(1);
          }
          50% {
            opacity: ${dotOpacity};
            transform: scale(1.2);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          svg line,
          svg circle {
            animation: none !important;
            opacity: ${lineOpacity * 0.5} !important;
          }
        }
      `}</style>
    </div>
  );
}
