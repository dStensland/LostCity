"use client";

import { useMemo, useId } from "react";
import ScopedStyles from "@/components/ScopedStyles";
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

  const rawId = useId();
  const instanceClass = `constellation-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const lineRules = lines
    .map(
      (line, index) => `.${instanceClass} .line-${index} { animation-duration: ${line.duration}s; animation-delay: ${line.delay}s; }`
    )
    .join("\n");
  const dotRules = dots
    .map(
      (dot, index) => `.${instanceClass} .dot-${index} { animation-duration: ${dot.pulseDuration}s; animation-delay: ${dot.pulseDelay}s; }`
    )
    .join("\n");
  const css = `
    .${instanceClass} .constellation-line {
      animation-name: fade-line;
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
    }
    .${instanceClass} .constellation-dot {
      animation-name: pulse-dot;
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
      transform-origin: center;
    }
    ${lineRules}
    ${dotRules}
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
      .${instanceClass} .constellation-line,
      .${instanceClass} .constellation-dot {
        animation: none !important;
        opacity: ${lineOpacity * 0.5} !important;
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
          {lines.map((line, index) => (
            <line
              key={line.id}
              x1={`${line.x1}%`}
              y1={`${line.y1}%`}
              x2={`${line.x2}%`}
              y2={`${line.y2}%`}
              stroke={lineColor}
              strokeWidth="1"
              opacity={lineOpacity}
              className={`constellation-line line-${index}`}
            />
          ))}
        </g>

        {/* Dots */}
        <g filter="url(#constellation-glow)">
          {dots.map((dot, index) => (
            <circle
              key={dot.id}
              cx={`${dot.x}%`}
              cy={`${dot.y}%`}
              r={dot.size}
              fill={dotColor}
              opacity={dotOpacity}
              className={`constellation-dot dot-${index}`}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
